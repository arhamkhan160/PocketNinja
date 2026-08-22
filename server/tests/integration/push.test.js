require("../helpers/env");
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../helpers/db");
const { startServer } = require("../helpers/app");
const { makeClient, makeUser } = require("../helpers/client");
const PushSubscription = require("../../models/PushSubscription");

const subscriptionFor = (endpoint) => ({
  endpoint,
  expirationTime: null,
  keys: { p256dh: "test-p256dh-key", auth: "test-auth-key" },
});

describe("/api/push", () => {
  let api;
  let server;
  let owner;
  let other;

  before(async () => {
    await db.connect();
    server = await startServer();
    api = makeClient(server.baseUrl);
  });

  beforeEach(async () => {
    await db.clear();
    owner = await makeUser();
    other = await makeUser();
  });

  after(async () => {
    await server.close();
    await db.disconnect();
  });

  describe("GET /push/vapidPublicKey", () => {
    test("returns the configured public key", async () => {
      const res = await api.get("/push/vapidPublicKey");

      assert.equal(res.status, 200);
      assert.equal(res.body.publicKey, process.env.VAPID_PUBLIC_KEY);
    });

    test("never exposes the private key", async () => {
      const res = await api.get("/push/vapidPublicKey");

      assert.equal(
        JSON.stringify(res.body).includes(process.env.VAPID_PRIVATE_KEY),
        false,
        "the private VAPID key must never leave the server",
      );
    });
  });

  describe("POST /push/subscribe", () => {
    test("stores a new subscription with 201", async () => {
      const res = await api.post(
        "/push/subscribe",
        { subscription: subscriptionFor("https://push.test/abc") },
        { token: owner.token },
      );

      assert.equal(res.status, 201);
      assert.equal(await PushSubscription.countDocuments({ userId: owner.userId }), 1);
    });

    test("requires authentication", async () => {
      const res = await api.post("/push/subscribe", {
        subscription: subscriptionFor("https://push.test/abc"),
      });
      assert.equal(res.status, 401);
    });

    test("re-subscribing the same endpoint updates rather than duplicating", async () => {
      const endpoint = "https://push.test/abc";
      await api.post(
        "/push/subscribe",
        { subscription: subscriptionFor(endpoint) },
        { token: owner.token },
      );

      const second = await api.post(
        "/push/subscribe",
        { subscription: { ...subscriptionFor(endpoint), keys: { p256dh: "rotated", auth: "x" } } },
        { token: owner.token },
      );

      assert.equal(second.status, 200);
      assert.match(second.body.message, /updated/);
      assert.equal(await PushSubscription.countDocuments({ userId: owner.userId }), 1);

      const stored = await PushSubscription.findOne({ userId: owner.userId });
      assert.equal(stored.subscription.keys.p256dh, "rotated");
    });

    test("one user may register several devices", async () => {
      await api.post(
        "/push/subscribe",
        { subscription: subscriptionFor("https://push.test/phone") },
        { token: owner.token },
      );
      await api.post(
        "/push/subscribe",
        { subscription: subscriptionFor("https://push.test/laptop") },
        { token: owner.token },
      );

      assert.equal(await PushSubscription.countDocuments({ userId: owner.userId }), 2);
    });

    test("two users may hold the same endpoint independently", async () => {
      const endpoint = "https://push.test/shared";
      await api.post("/push/subscribe", { subscription: subscriptionFor(endpoint) }, { token: owner.token });
      await api.post("/push/subscribe", { subscription: subscriptionFor(endpoint) }, { token: other.token });

      assert.equal(await PushSubscription.countDocuments({}), 2);
    });

    test("rejects a missing subscription or one without an endpoint", async () => {
      for (const body of [{}, { subscription: null }, { subscription: {} }, { subscription: { keys: {} } }]) {
        const res = await api.post("/push/subscribe", body, { token: owner.token });
        assert.equal(res.status, 400, `${JSON.stringify(body)} should be 400`);
        assert.match(res.body.error, /Invalid subscription/);
      }
    });

    test("ownership comes from the token, not the body", async () => {
      await api.post(
        "/push/subscribe",
        {
          subscription: subscriptionFor("https://push.test/abc"),
          userId: String(other.userId),
        },
        { token: owner.token },
      );

      const stored = await PushSubscription.findOne({});
      assert.equal(String(stored.userId), String(owner.userId));
    });
  });

  describe("DELETE /push/subscribe", () => {
    const endpoint = "https://push.test/abc";

    beforeEach(async () => {
      await api.post("/push/subscribe", { subscription: subscriptionFor(endpoint) }, { token: owner.token });
    });

    test("removes the caller's subscription", async () => {
      const res = await api.del("/push/subscribe", { endpoint }, { token: owner.token });

      assert.equal(res.status, 200);
      assert.match(res.body.message, /removed/);
      assert.equal(await PushSubscription.countDocuments({ userId: owner.userId }), 0);
    });

    test("rejects a missing endpoint with 400", async () => {
      const res = await api.del("/push/subscribe", {}, { token: owner.token });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /Endpoint is required/);
    });

    test("returns 404 for an endpoint the caller never registered", async () => {
      const res = await api.del(
        "/push/subscribe",
        { endpoint: "https://push.test/unknown" },
        { token: owner.token },
      );
      assert.equal(res.status, 404);
    });

    test("cannot unsubscribe another user's device", async () => {
      const res = await api.del("/push/subscribe", { endpoint }, { token: other.token });

      assert.equal(res.status, 404);
      assert.equal(await PushSubscription.countDocuments({ userId: owner.userId }), 1);
    });

    test("requires authentication", async () => {
      assert.equal((await api.del("/push/subscribe", { endpoint })).status, 401);
    });

    test("a repeat delete returns 404", async () => {
      await api.del("/push/subscribe", { endpoint }, { token: owner.token });
      assert.equal(
        (await api.del("/push/subscribe", { endpoint }, { token: owner.token })).status,
        404,
      );
    });
  });
});
