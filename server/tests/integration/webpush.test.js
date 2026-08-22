require("../helpers/env");
const { test, describe, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../helpers/db");
const { makeUser } = require("../helpers/client");
const PushSubscription = require("../../models/PushSubscription");
const { sendPushNotification, webpush } = require("../../push/webpush");

const subscriptionFor = (endpoint) => ({
  endpoint,
  keys: { p256dh: "test-p256dh", auth: "test-auth" },
});

describe("push/webpush — sendPushNotification", () => {
  let owner;
  let other;
  let sent;
  let originalSend;
  let originalError;
  let originalLog;

  before(async () => db.connect());

  beforeEach(async () => {
    await db.clear();
    owner = await makeUser();
    other = await makeUser();

    // Stub the network call — web-push would otherwise try to reach a real
    // push service over HTTPS.
    sent = [];
    originalSend = webpush.sendNotification;
    webpush.sendNotification = async (subscription, payload) => {
      sent.push({ subscription, payload });
      return { statusCode: 201 };
    };

    originalError = console.error;
    originalLog = console.log;
    console.error = () => {};
    console.log = () => {};
  });

  afterEach(() => {
    webpush.sendNotification = originalSend;
    console.error = originalError;
    console.log = originalLog;
  });

  after(async () => db.disconnect());

  test("returns without sending when the user has no subscriptions", async () => {
    await sendPushNotification(owner.userId, { title: "hi" });

    assert.equal(sent.length, 0);
  });

  test("sends to the user's single registered device", async () => {
    await PushSubscription.create({
      userId: owner.userId,
      subscription: subscriptionFor("https://push.test/a"),
    });

    await sendPushNotification(owner.userId, { title: "Reminder" });

    assert.equal(sent.length, 1);
    assert.equal(sent[0].subscription.endpoint, "https://push.test/a");
  });

  test("fans out to every device the user has registered", async () => {
    await PushSubscription.create({
      userId: owner.userId,
      subscription: subscriptionFor("https://push.test/phone"),
    });
    await PushSubscription.create({
      userId: owner.userId,
      subscription: subscriptionFor("https://push.test/laptop"),
    });

    await sendPushNotification(owner.userId, { title: "Reminder" });

    assert.equal(sent.length, 2);
  });

  test("never sends to another user's device", async () => {
    await PushSubscription.create({
      userId: other.userId,
      subscription: subscriptionFor("https://push.test/theirs"),
    });

    await sendPushNotification(owner.userId, { title: "Reminder" });

    assert.equal(sent.length, 0);
  });

  test("serialises an object payload to JSON", async () => {
    await PushSubscription.create({
      userId: owner.userId,
      subscription: subscriptionFor("https://push.test/a"),
    });

    await sendPushNotification(owner.userId, { title: "Reminder", body: "Rent due" });

    assert.equal(typeof sent[0].payload, "string");
    assert.deepEqual(JSON.parse(sent[0].payload), {
      title: "Reminder",
      body: "Rent due",
    });
  });

  test("passes a string payload through untouched", async () => {
    await PushSubscription.create({
      userId: owner.userId,
      subscription: subscriptionFor("https://push.test/a"),
    });

    await sendPushNotification(owner.userId, "plain text");

    assert.equal(sent[0].payload, "plain text");
  });

  test("purges a subscription the push service reports as gone (410)", async () => {
    await PushSubscription.create({
      userId: owner.userId,
      subscription: subscriptionFor("https://push.test/dead"),
    });

    webpush.sendNotification = async () => {
      throw Object.assign(new Error("Gone"), { statusCode: 410 });
    };

    await sendPushNotification(owner.userId, { title: "hi" });

    assert.equal(await PushSubscription.countDocuments({ userId: owner.userId }), 0);
  });

  test("purges a 404 subscription too", async () => {
    await PushSubscription.create({
      userId: owner.userId,
      subscription: subscriptionFor("https://push.test/dead"),
    });

    webpush.sendNotification = async () => {
      throw Object.assign(new Error("Not Found"), { statusCode: 404 });
    };

    await sendPushNotification(owner.userId, { title: "hi" });

    assert.equal(await PushSubscription.countDocuments({ userId: owner.userId }), 0);
  });

  test("keeps a subscription that failed for a transient reason (500)", async () => {
    // A server-side blip must not cost the user their device registration.
    await PushSubscription.create({
      userId: owner.userId,
      subscription: subscriptionFor("https://push.test/flaky"),
    });

    webpush.sendNotification = async () => {
      throw Object.assign(new Error("Internal Error"), { statusCode: 500 });
    };

    await sendPushNotification(owner.userId, { title: "hi" });

    assert.equal(await PushSubscription.countDocuments({ userId: owner.userId }), 1);
  });

  test("purges only the dead device and keeps the healthy one", async () => {
    await PushSubscription.create({
      userId: owner.userId,
      subscription: subscriptionFor("https://push.test/alive"),
    });
    await PushSubscription.create({
      userId: owner.userId,
      subscription: subscriptionFor("https://push.test/dead"),
    });

    webpush.sendNotification = async (subscription) => {
      if (subscription.endpoint.endsWith("/dead")) {
        throw Object.assign(new Error("Gone"), { statusCode: 410 });
      }
      return { statusCode: 201 };
    };

    await sendPushNotification(owner.userId, { title: "hi" });

    const remaining = await PushSubscription.find({ userId: owner.userId });
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].subscription.endpoint, "https://push.test/alive");
  });

  test("one failing device does not stop the others being notified", async () => {
    await PushSubscription.create({
      userId: owner.userId,
      subscription: subscriptionFor("https://push.test/bad"),
    });
    await PushSubscription.create({
      userId: owner.userId,
      subscription: subscriptionFor("https://push.test/good"),
    });

    const delivered = [];
    webpush.sendNotification = async (subscription) => {
      if (subscription.endpoint.endsWith("/bad")) throw new Error("boom");
      delivered.push(subscription.endpoint);
      return { statusCode: 201 };
    };

    await sendPushNotification(owner.userId, { title: "hi" });

    assert.deepEqual(delivered, ["https://push.test/good"]);
  });

  test("does not reject when every send fails", async () => {
    await PushSubscription.create({
      userId: owner.userId,
      subscription: subscriptionFor("https://push.test/a"),
    });

    webpush.sendNotification = async () => {
      throw new Error("total failure");
    };

    await assert.doesNotReject(() => sendPushNotification(owner.userId, { title: "hi" }));
  });

  test("accepts a string userId as well as an ObjectId", async () => {
    await PushSubscription.create({
      userId: owner.userId,
      subscription: subscriptionFor("https://push.test/a"),
    });

    await sendPushNotification(String(owner.userId), { title: "hi" });

    assert.equal(sent.length, 1);
  });
});
