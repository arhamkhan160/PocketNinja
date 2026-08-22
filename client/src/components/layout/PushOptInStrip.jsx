import React from "react";
import { BellRing, BellOff, Check } from "lucide-react";
import Button from "../ui/Button";
import usePush from "../../hooks/usePush";

/**
 * The push opt-in banner. Replaces the old hard-coded strip whose button did
 * nothing — this one actually registers the service worker, asks for
 * permission and stores the subscription against the signed-in user.
 */
const PushOptInStrip = () => {
  const { supported, permission, isSubscribed, isReady, isBusy, error, enable, disable } =
    usePush();

  // Say nothing until we know whether this browser is already subscribed,
  // otherwise the banner flashes on every page load for opted-in users.
  if (!isReady) return null;

  if (!supported) {
    return (
      <div className="lm-card p-4 sm:p-5 border-l-4 border-l-[#A8A29E] flex items-center gap-3 mb-6">
        <BellOff size={20} className="text-[#78716C] shrink-0" />
        <p className="text-sm text-[#78716C]">
          This browser doesn&apos;t support push notifications. Upcoming bills still
          appear in the bell menu.
        </p>
      </div>
    );
  }

  if (isSubscribed) {
    return (
      <div className="lm-card p-4 sm:p-5 border-l-4 border-l-[#0D9488] flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 mb-6">
        <div className="flex items-center gap-2 flex-1">
          <Check size={18} className="text-[#0D9488] shrink-0" />
          <p className="text-sm text-[#1C1917]">
            Push notifications are on for this device.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={disable} disabled={isBusy}>
          {isBusy ? "Turning off…" : "Turn off"}
        </Button>
      </div>
    );
  }

  const isBlocked = permission === "denied";

  return (
    <div className="lm-card p-4 sm:p-5 border-l-4 border-l-[#0D9488] flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 mb-6">
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-[#1C1917] flex items-center gap-2">
          <BellRing size={18} className="text-[#0D9488]" />
          Enable Push Notifications
        </h3>
        <p className="text-sm text-[#78716C]">
          {isBlocked
            ? "Notifications are blocked for this site. Allow them in your browser settings, then reload."
            : "Get alerted about recurring bills and budget limits, even when PocketNinja is closed."}
        </p>
        {error && <p className="text-sm text-[#EF4444] mt-1">{error}</p>}
      </div>

      <Button onClick={enable} disabled={isBusy || isBlocked} className="shrink-0">
        {isBusy ? "Setting up…" : "Setup Notifications"}
      </Button>
    </div>
  );
};

export default PushOptInStrip;
