require("../helpers/env");
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../helpers/db");
const { startServer } = require("../helpers/app");
const { makeClient, makeUser } = require("../helpers/client");
const Goal = require("../../models/Goal");

describe("/api/goals", () => {
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

  const create = (body, token = owner.token) => api.post("/goals", body, { token });

  describe("auth guard", () => {
    test("all four verbs reject an unauthenticated caller with 401", async () => {
      assert.equal((await api.get("/goals")).status, 401);
      assert.equal((await api.post("/goals", { title: "x", target: 1 })).status, 401);
      assert.equal((await api.put("/goals/507f1f77bcf86cd799439011", {})).status, 401);
      assert.equal((await api.del("/goals/507f1f77bcf86cd799439011")).status, 401);
    });
  });

  describe("POST /goals", () => {
    test("creates with 201 and defaults saved to 0", async () => {
      const res = await create({ title: "Laptop", target: 1200 });

      assert.equal(res.status, 201);
      assert.equal(res.body.title, "Laptop");
      assert.equal(res.body.target, 1200);
      assert.equal(res.body.saved, 0);
    });

    test("accepts an explicit saved and deadline", async () => {
      const res = await create({
        title: "Trip",
        target: 800,
        saved: 120,
        deadline: "2026-12-31",
      });

      assert.equal(res.body.saved, 120);
      assert.equal(res.body.deadline.slice(0, 10), "2026-12-31");
    });

    test("trims the title", async () => {
      assert.equal((await create({ title: "  Laptop  ", target: 10 })).body.title, "Laptop");
    });

    test("ownership comes from the token, not the body", async () => {
      const res = await create({ title: "x", target: 10, userId: String(other.userId) });
      assert.equal(res.body.userId, String(owner.userId));
    });

    test("rejects a missing, empty or non-string title", async () => {
      for (const title of [undefined, "", "   ", 42, null]) {
        const res = await create({ title, target: 10 });
        assert.equal(res.status, 400, `title=${JSON.stringify(title)} should be 400`);
        assert.match(res.body.error, /Title is required/);
      }
    });

    test("rejects a zero, negative or non-numeric target", async () => {
      for (const target of [0, -1, "abc", undefined, null]) {
        const res = await create({ title: "x", target });
        assert.equal(res.status, 400, `target=${JSON.stringify(target)} should be 400`);
        assert.match(res.body.error, /Target must be a number greater than 0/);
      }
    });

    test("rejects a negative saved", async () => {
      const res = await create({ title: "x", target: 10, saved: -1 });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /Saved must be a number of 0 or more/);
    });

    test("accepts saved equal to 0 and saved greater than target", async () => {
      assert.equal((await create({ title: "a", target: 10, saved: 0 })).status, 201);
      assert.equal((await create({ title: "b", target: 10, saved: 999 })).status, 201);
    });

    test("rejects an unparseable deadline", async () => {
      const res = await create({ title: "x", target: 10, deadline: "not-a-date" });

      assert.equal(res.status, 400);
      assert.match(res.body.error, /Deadline must be a valid date/);
    });

    test("treats null and empty-string deadline as no deadline", async () => {
      assert.equal((await create({ title: "a", target: 10, deadline: null })).body.deadline, null);
      assert.equal((await create({ title: "b", target: 10, deadline: "" })).body.deadline, null);
    });

    test("accepts a deadline in the past — an overdue goal is still a goal", async () => {
      const res = await create({ title: "x", target: 10, deadline: "2020-01-01" });
      assert.equal(res.status, 201);
    });
  });

  describe("GET /goals", () => {
    test("returns an empty array for a new user", async () => {
      const res = await api.get("/goals", { token: owner.token });

      assert.equal(res.status, 200);
      assert.deepEqual(res.body, []);
    });

    test("returns only the caller's goals", async () => {
      await create({ title: "Mine", target: 10 });
      await create({ title: "Theirs", target: 10 }, other.token);

      const res = await api.get("/goals", { token: owner.token });

      assert.equal(res.body.length, 1);
      assert.equal(res.body[0].title, "Mine");
    });

    test("sorts newest first", async () => {
      await Goal.create({
        userId: owner.userId,
        title: "Older",
        target: 10,
        createdAt: new Date("2026-01-01"),
      });
      await Goal.create({
        userId: owner.userId,
        title: "Newer",
        target: 10,
        createdAt: new Date("2026-08-01"),
      });

      const res = await api.get("/goals", { token: owner.token });

      assert.deepEqual(
        res.body.map((g) => g.title),
        ["Newer", "Older"],
      );
    });
  });

  describe("PUT /goals/:id", () => {
    let goal;

    beforeEach(async () => {
      goal = (await create({ title: "Laptop", target: 1200, saved: 100 })).body;
    });

    const put = (body, token = owner.token) => api.put(`/goals/${goal._id}`, body, { token });

    test("contributes to a goal by updating saved", async () => {
      const res = await put({ saved: 350 });

      assert.equal(res.status, 200);
      assert.equal(res.body.saved, 350);
      assert.equal(res.body.title, "Laptop");
    });

    test("updates title, target and deadline", async () => {
      const res = await put({ title: "Desktop", target: 2000, deadline: "2027-01-01" });

      assert.equal(res.body.title, "Desktop");
      assert.equal(res.body.target, 2000);
      assert.equal(res.body.deadline.slice(0, 10), "2027-01-01");
    });

    test("clears the deadline with null", async () => {
      assert.equal((await put({ deadline: null })).body.deadline, null);
    });

    test("a partial update does not require title or target", async () => {
      // The partial:true path — a bare { saved } must not trip the required checks.
      const res = await put({ saved: 500 });
      assert.equal(res.status, 200);
    });

    test("an empty body is a no-op", async () => {
      const res = await put({});

      assert.equal(res.status, 200);
      assert.equal(res.body.saved, 100);
    });

    test("rejects invalid title, target, saved and deadline", async () => {
      assert.equal((await put({ title: "  " })).status, 400);
      assert.equal((await put({ target: 0 })).status, 400);
      assert.equal((await put({ target: -5 })).status, 400);
      assert.equal((await put({ saved: -1 })).status, 400);
      assert.equal((await put({ deadline: "nope" })).status, 400);
    });

    test("returns 404 for another user's goal and leaves it unchanged", async () => {
      const res = await put({ saved: 9999 }, other.token);

      assert.equal(res.status, 404);
      assert.equal((await Goal.findById(goal._id)).saved, 100);
    });

    test("returns 404 for non-existent and malformed ids", async () => {
      assert.equal(
        (await api.put("/goals/507f1f77bcf86cd799439011", { saved: 1 }, { token: owner.token }))
          .status,
        404,
      );
      assert.equal(
        (await api.put("/goals/not-an-id", { saved: 1 }, { token: owner.token })).status,
        404,
      );
    });

    test("a rejected update writes nothing", async () => {
      await put({ saved: -5 });
      assert.equal((await Goal.findById(goal._id)).saved, 100);
    });
  });

  describe("DELETE /goals/:id", () => {
    let goal;

    beforeEach(async () => {
      goal = (await create({ title: "Laptop", target: 1200 })).body;
    });

    test("deletes and returns 204", async () => {
      const res = await api.del(`/goals/${goal._id}`, undefined, { token: owner.token });

      assert.equal(res.status, 204);
      assert.equal(await Goal.countDocuments({ _id: goal._id }), 0);
    });

    test("returns 404 for another user's goal and does not delete it", async () => {
      const res = await api.del(`/goals/${goal._id}`, undefined, { token: other.token });

      assert.equal(res.status, 404);
      assert.equal(await Goal.countDocuments({ _id: goal._id }), 1);
    });

    test("a repeat delete and a malformed id both return 404", async () => {
      await api.del(`/goals/${goal._id}`, undefined, { token: owner.token });
      assert.equal(
        (await api.del(`/goals/${goal._id}`, undefined, { token: owner.token })).status,
        404,
      );
      assert.equal(
        (await api.del("/goals/not-an-id", undefined, { token: owner.token })).status,
        404,
      );
    });
  });
});
