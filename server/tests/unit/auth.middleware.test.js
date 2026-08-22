require("../helpers/env");
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const auth = require("../../middleware/auth");
const { signToken } = require("../../utils/jwt");

const makeRes = () => {
  const res = { statusCode: null, payload: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.payload = payload;
    return res;
  };
  return res;
};

const run = (authorization) => {
  const req = { headers: authorization === undefined ? {} : { authorization } };
  const res = makeRes();
  let nextCalled = false;
  auth(req, res, () => {
    nextCalled = true;
  });
  return { req, res, nextCalled };
};

describe("middleware/auth", () => {
  test("valid Bearer token attaches req.userId and calls next()", () => {
    const { req, nextCalled } = run(`Bearer ${signToken("507f1f77bcf86cd799439011")}`);

    assert.equal(nextCalled, true);
    assert.equal(req.userId, "507f1f77bcf86cd799439011");
  });

  test("missing Authorization header rejects with 401", () => {
    const { res, nextCalled } = run(undefined);

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.payload, { error: "No token provided" });
  });

  test("header without the Bearer prefix rejects with 401", () => {
    const { res, nextCalled } = run(signToken("abc"));

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.payload, { error: "No token provided" });
  });

  test("scheme is case-sensitive — 'bearer' is rejected", () => {
    const { res } = run(`bearer ${signToken("abc")}`);
    assert.equal(res.statusCode, 401);
  });

  test("'Bearer' with no token rejects with 401", () => {
    const { res, nextCalled } = run("Bearer ");

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
  });

  test("garbage token rejects with 401 'Invalid or expired token'", () => {
    const { res, nextCalled } = run("Bearer not.a.jwt");

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.payload, { error: "Invalid or expired token" });
  });

  test("expired token rejects with 401", () => {
    const expired = jwt.sign({ id: "abc" }, process.env.JWT_SECRET, { expiresIn: "-1s" });
    const { res, nextCalled } = run(`Bearer ${expired}`);

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.payload, { error: "Invalid or expired token" });
  });

  test("token signed with a foreign secret rejects with 401", () => {
    const foreign = jwt.sign({ id: "attacker" }, "wrong-secret");
    const { req, res, nextCalled } = run(`Bearer ${foreign}`);

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(req.userId, undefined);
  });

  test("a userId in the request body cannot override the token's identity", () => {
    // §4: the token is the only source of identity.
    const req = {
      headers: { authorization: `Bearer ${signToken("real-user")}` },
      body: { userId: "attacker-supplied" },
    };
    auth(req, makeRes(), () => {});

    assert.equal(req.userId, "real-user");
  });
});
