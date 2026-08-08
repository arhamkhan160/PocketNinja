const webpush = require("web-push");
const PushSubscription = require("../models/PushSubscription");

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const STALE_STATUS_CODES = [404, 410];

const sendPushNotification = async (userId, payload) => {
  const subscriptions = await PushSubscription.find({ userId });

  if (subscriptions.length === 0) return;

  const stringPayload =
    typeof payload === "string" ? payload : JSON.stringify(payload);

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(sub.subscription, stringPayload)
    )
  );

  const staleIds = [];

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const statusCode = result.reason?.statusCode;
      if (STALE_STATUS_CODES.includes(statusCode)) {
        staleIds.push(subscriptions[index]._id);
      } else {
        console.error(
          `Push failed for subscription ${subscriptions[index]._id}:`,
          result.reason?.message || result.reason
        );
      }
    }
  });

  if (staleIds.length > 0) {
    await PushSubscription.deleteMany({ _id: { $in: staleIds } });
    console.log(`Purged ${staleIds.length} stale push subscription(s)`);
  }
};

module.exports = { sendPushNotification, webpush };
