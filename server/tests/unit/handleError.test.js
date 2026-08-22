require("../helpers/env");
const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const handleError = require("../../utils/handleError");

/** Minimal res double — records what the handler tried to send. */
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

describe("utils/handleError", () => {
  let logged;
  let originalError;

  beforeEach(() => {
    logged = [];
    originalError = console.error;
    console.error = (...args) => logged.push(args);
  });

  afterEach(() => {
    console.error = originalError;
  });

  test("CastError maps to 404, not 500", () => {
    const res = makeRes();
    const err = Object.assign(new Error("Cast to ObjectId failed"), {
      name: "CastError",
    });

    handleError(res, "ctx", err);

    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.payload, { error: "Not found" });
  });

  test("CastError answers identically to a real miss, so ids don't leak", () => {
    // A bad id and someone else's id must be indistinguishable to a caller.
    const res = makeRes();
    handleError(res, "ctx", Object.assign(new Error("x"), { name: "CastError" }));
    assert.deepEqual(res.payload, { error: "Not found" });
  });

  test("ValidationError maps to 400 and joins the per-field messages", () => {
    const res = makeRes();
    const err = Object.assign(new Error("Transaction validation failed: ..."), {
      name: "ValidationError",
      errors: {
        amount: { message: "Amount must be greater than 0" },
        type: { message: "Type must be income or expense" },
      },
    });

    handleError(res, "ctx", err);

    assert.equal(res.statusCode, 400);
    assert.equal(
      res.payload.error,
      "Amount must be greater than 0, Type must be income or expense",
    );
  });

  test("ValidationError with no errors object falls back to a generic message", () => {
    const res = makeRes();
    handleError(res, "ctx", Object.assign(new Error("x"), { name: "ValidationError" }));

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.payload, { error: "Invalid input" });
  });

  test("duplicate key (11000) maps to 409", () => {
    const res = makeRes();
    handleError(res, "ctx", Object.assign(new Error("E11000"), { code: 11000 }));

    assert.equal(res.statusCode, 409);
    assert.deepEqual(res.payload, { error: "That already exists" });
  });

  test("unknown error maps to 500 with a generic message", () => {
    const res = makeRes();
    handleError(res, "Create thing", new Error("connection reset by peer"));

    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.payload, { error: "Server error" });
  });

  test("unknown error is logged with its context, but never sent to the client", () => {
    const res = makeRes();
    handleError(res, "Create thing", new Error("secret internal detail"));

    assert.equal(logged.length, 1);
    assert.equal(logged[0][0], "Create thing:");
    assert.equal(logged[0][1], "secret internal detail");
    // The leak check: the internal message must not reach the response body.
    assert.equal(res.payload.error, "Server error");
  });

  test("handled error types are not logged as server faults", () => {
    handleError(makeRes(), "ctx", Object.assign(new Error("x"), { name: "CastError" }));
    handleError(makeRes(), "ctx", Object.assign(new Error("x"), { code: 11000 }));
    assert.equal(logged.length, 0);
  });
});
