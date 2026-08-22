require("../helpers/env");
const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../helpers/db");
const { startServer } = require("../helpers/app");
const { makeClient, makeUser } = require("../helpers/client");
const User = require("../../models/User");

describe("POST /api/auth/register, /login, GET /me", () => {
  let api;
  let server;

  before(async () => {
    await db.connect();
    server = await startServer();
    api = makeClient(server.baseUrl);
  });

  beforeEach(async () => db.clear());

  after(async () => {
    await server.close();
    await db.disconnect();
  });

  describe("register", () => {
    const valid = { name: "Ada", email: "ada@test.local", password: "secret123" };

    test("creates a user and returns a token plus the public user shape", async () => {
      const res = await api.post("/auth/register", valid);

      assert.equal(res.status, 201);
      assert.ok(res.body.token);
      assert.deepEqual(Object.keys(res.body.user).sort(), ["email", "id", "name"]);
      assert.equal(res.body.user.email, "ada@test.local");
    });

    test("never returns the password", async () => {
      const res = await api.post("/auth/register", valid);
      assert.equal(res.body.user.password, undefined);
      assert.equal(JSON.stringify(res.body).includes("secret123"), false);
    });

    test("the returned token authenticates a protected route", async () => {
      const { body } = await api.post("/auth/register", valid);
      const me = await api.get("/auth/me", { token: body.token });

      assert.equal(me.status, 200);
      assert.equal(me.body.user.email, "ada@test.local");
    });

    test("rejects a missing name, email or password with 400", async () => {
      for (const field of ["name", "email", "password"]) {
        const payload = { ...valid };
        delete payload[field];
        const res = await api.post("/auth/register", payload);
        assert.equal(res.status, 400, `missing ${field} should be 400`);
      }
    });

    test("rejects an empty body with 400", async () => {
      const res = await api.post("/auth/register", {});
      assert.equal(res.status, 400);
      assert.match(res.body.error, /required/i);
    });

    test("rejects malformed email addresses", async () => {
      for (const email of ["notanemail", "no@domain", "@nope.com", "a b@c.com", "a@b."]) {
        const res = await api.post("/auth/register", { ...valid, email });
        assert.equal(res.status, 400, `${email} should be rejected`);
        assert.match(res.body.error, /Invalid email/);
      }
    });

    test("rejects a password shorter than 6 characters", async () => {
      const res = await api.post("/auth/register", { ...valid, password: "12345" });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /at least 6/);
    });

    test("accepts a password of exactly 6 characters — the boundary", async () => {
      const res = await api.post("/auth/register", { ...valid, password: "123456" });
      assert.equal(res.status, 201);
    });

    test("rejects a duplicate email with 409", async () => {
      await api.post("/auth/register", valid);
      const res = await api.post("/auth/register", valid);

      assert.equal(res.status, 409);
      assert.match(res.body.error, /already registered/);
    });

    test("duplicate detection is case-insensitive", async () => {
      await api.post("/auth/register", valid);
      const res = await api.post("/auth/register", { ...valid, email: "ADA@TEST.LOCAL" });

      assert.equal(res.status, 409);
    });
  });

  describe("login", () => {
    const creds = { name: "Ada", email: "ada@test.local", password: "secret123" };

    beforeEach(async () => {
      await api.post("/auth/register", creds);
    });

    test("returns a token for correct credentials", async () => {
      const res = await api.post("/auth/login", {
        email: creds.email,
        password: creds.password,
      });

      assert.equal(res.status, 200);
      assert.ok(res.body.token);
      assert.equal(res.body.user.email, creds.email);
    });

    test("accepts a differently-cased email", async () => {
      const res = await api.post("/auth/login", {
        email: "ADA@TEST.LOCAL",
        password: creds.password,
      });
      assert.equal(res.status, 200);
    });

    test("rejects a wrong password with 401", async () => {
      const res = await api.post("/auth/login", { email: creds.email, password: "wrong" });

      assert.equal(res.status, 401);
      assert.equal(res.body.error, "Invalid email or password");
    });

    test("rejects an unknown email with 401", async () => {
      const res = await api.post("/auth/login", {
        email: "nobody@test.local",
        password: creds.password,
      });

      assert.equal(res.status, 401);
    });

    test("the error message does not reveal whether the email exists", async () => {
      // User enumeration: both failure modes must be indistinguishable.
      const wrongPassword = await api.post("/auth/login", {
        email: creds.email,
        password: "wrong",
      });
      const unknownEmail = await api.post("/auth/login", {
        email: "nobody@test.local",
        password: "wrong",
      });

      assert.deepEqual(wrongPassword.body, unknownEmail.body);
      assert.equal(wrongPassword.status, unknownEmail.status);
    });

    test("rejects a missing email or password with 400", async () => {
      assert.equal((await api.post("/auth/login", { email: creds.email })).status, 400);
      assert.equal((await api.post("/auth/login", { password: "x" })).status, 400);
      assert.equal((await api.post("/auth/login", {})).status, 400);
    });

    test("an empty password does not authenticate", async () => {
      const res = await api.post("/auth/login", { email: creds.email, password: "" });
      assert.equal(res.status, 400);
    });

    test("a NoSQL operator object in the email field does not authenticate", async () => {
      // { $ne: null } would match any user if the value reached the query raw.
      const res = await api.post("/auth/login", {
        email: { $ne: null },
        password: { $ne: null },
      });

      assert.notEqual(res.status, 200);
    });
  });

  describe("GET /auth/me", () => {
    test("returns the current user for a valid token", async () => {
      const { token, user } = await makeUser({ name: "Grace" });
      const res = await api.get("/auth/me", { token });

      assert.equal(res.status, 200);
      assert.equal(res.body.user.name, "Grace");
      assert.equal(res.body.user.id, String(user._id));
    });

    test("never includes the password field", async () => {
      const { token } = await makeUser();
      const res = await api.get("/auth/me", { token });

      assert.equal(res.body.user.password, undefined);
      assert.deepEqual(Object.keys(res.body.user).sort(), ["email", "id", "name"]);
    });

    test("rejects a missing token with 401", async () => {
      assert.equal((await api.get("/auth/me")).status, 401);
    });

    test("rejects a garbage token with 401", async () => {
      assert.equal((await api.get("/auth/me", { token: "garbage" })).status, 401);
    });

    test("returns 404 when the token is valid but the user was deleted", async () => {
      const { token, userId } = await makeUser();
      await User.findByIdAndDelete(userId);

      const res = await api.get("/auth/me", { token });
      assert.equal(res.status, 404);
    });
  });
});
