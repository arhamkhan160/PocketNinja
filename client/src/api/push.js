import api from "./axios";

// Push subscription endpoints (PROJECT_PLAN.md §6 — owner: Apon).

/** The VAPID public key the browser needs to create a subscription. */
export const getVapidPublicKey = () =>
  api.get("/push/vapidPublicKey").then((res) => res.data.publicKey);

/** Stores this browser's subscription against the signed-in user. */
export const savePushSubscription = (subscription) =>
  api.post("/push/subscribe", { subscription }).then((res) => res.data);

/**
 * Removes one device. DELETE carries its body under `data` in axios — the
 * server reads req.body.endpoint.
 */
export const removePushSubscription = (endpoint) =>
  api.delete("/push/subscribe", { data: { endpoint } }).then((res) => res.data);
