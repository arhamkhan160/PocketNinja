import { useCallback, useEffect, useState } from "react";
import {
  getVapidPublicKey,
  savePushSubscription,
  removePushSubscription,
} from "../api/push";
import { errorMessage } from "../utils/format";

const SW_URL = "/sw.js";

/** Push needs all three: without any one of them the opt-in must not be offered. */
export const isPushSupported = () =>
  typeof navigator !== "undefined" &&
  "serviceWorker" in navigator &&
  typeof window !== "undefined" &&
  "PushManager" in window &&
  "Notification" in window;

/**
 * VAPID keys travel as base64url text; PushManager wants the raw bytes.
 * Padding is re-added because base64url strips it.
 */
export const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);

  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
};

/**
 * Owns the browser side of web push: service worker registration, the
 * permission prompt, and keeping the server's PushSubscription list in step
 * with what this browser actually holds.
 */
export default function usePush() {
  const [supported] = useState(isPushSupported);
  const [permission, setPermission] = useState(() =>
    isPushSupported() ? Notification.permission : "unsupported",
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState(null);

  // Register up front so a push can arrive even before the user opts in again,
  // and so we can tell whether this browser already holds a subscription.
  useEffect(() => {
    if (!supported) {
      setIsReady(true);
      return;
    }

    let cancelled = false;

    navigator.serviceWorker
      .register(SW_URL)
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (!cancelled) setIsSubscribed(Boolean(subscription));
      })
      .catch(() => {
        if (!cancelled) setIsSubscribed(false);
      })
      .finally(() => {
        if (!cancelled) setIsReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [supported]);

  const enable = useCallback(async () => {
    if (!supported) return false;

    setIsBusy(true);
    setError(null);

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== "granted") {
        setError(
          result === "denied"
            ? "Notifications are blocked for this site. Allow them in your browser settings, then try again."
            : "Notification permission was dismissed.",
        );
        return false;
      }

      const registration = await navigator.serviceWorker.register(SW_URL);
      const publicKey = await getVapidPublicKey();

      if (!publicKey) {
        setError("The server has no VAPID key configured.");
        return false;
      }

      // Reuse an existing browser subscription — re-subscribing would orphan
      // the old endpoint on the server.
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));

      await savePushSubscription(subscription.toJSON());
      setIsSubscribed(true);
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [supported]);

  const disable = useCallback(async () => {
    if (!supported) return false;

    setIsBusy(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.register(SW_URL);
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Drop the server record first: a browser-side unsubscribe that the
        // server never hears about leaves it pushing into a dead endpoint
        // until the 410 purge catches it.
        await removePushSubscription(subscription.endpoint).catch(() => {});
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [supported]);

  return { supported, permission, isSubscribed, isReady, isBusy, error, enable, disable };
}
