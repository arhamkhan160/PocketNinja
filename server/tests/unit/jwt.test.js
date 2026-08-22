require("../helpers/env");
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { signToken, verifyToken } = require("../../utils/jwt");

describe("utils/jwt", () => {
  test("signToken produces a token verifyToken can read back", () => {
    const token = signToken("507f1f77bcf86cd799439011");
    const decoded = verifyToken(token);
    assert.equal(decoded.id, "507f1f77bcf86cd799439011");
  });

  test("a Mongoose ObjectId round-trips as its hex string", () => {
    // This is how every caller uses it: signToken(user._id).
    const id = new mongoose.Types.ObjectId("507f191e810c19729de860ea");
    const decoded = verifyToken(signToken(id));
    assert.equal(decoded.id, "507f191e810c19729de860ea");
  });

  test("a plain object payload does NOT stringify — it serialises to {}", () => {
    // signToken embeds the value as-is, so only things with a JSON
    // representation (string, ObjectId) survive. Documents the sharp edge.
    const decoded = verifyToken(signToken({ toString: () => "abc" }));
    assert.deepEqual(decoded.id, {});
  });

  test("token carries standard iat/exp claims", () => {
    const decoded = verifyToken(signToken("abc"));
    assert.ok(typeof decoded.iat === "number");
    assert.ok(typeof decoded.exp === "number");
    assert.ok(decoded.exp > decoded.iat, "expiry must be after issued-at");
  });

  test("verifyToken throws on a malformed token", () => {
    assert.throws(() => verifyToken("not-a-jwt"), /jwt malformed/);
  });

  test("verifyToken throws on a token signed with a different secret", () => {
    const foreign = jwt.sign({ id: "abc" }, "some-other-secret");
    assert.throws(() => verifyToken(foreign), /invalid signature/);
  });

  test("verifyToken throws on an expired token", () => {
    const expired = jwt.sign({ id: "abc" }, process.env.JWT_SECRET, {
      expiresIn: "-1s",
    });
    assert.throws(() => verifyToken(expired), /jwt expired/);
  });

  test("verifyToken rejects the alg:none downgrade attack", () => {
    // A token with no signature must never be accepted — this is the classic
    // JWT bypass.
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ id: "attacker" })).toString("base64url");
    assert.throws(() => verifyToken(`${header}.${payload}.`));
  });

  test("verifyToken throws on empty / undefined input", () => {
    assert.throws(() => verifyToken(""));
    assert.throws(() => verifyToken(undefined));
  });
});
