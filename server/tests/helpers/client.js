require("./env");
const User = require("../../models/User");
const { signToken } = require("../../utils/jwt");

/**
 * Thin fetch wrapper: `{ status, body }`, JSON in and out, optional bearer
 * token. Keeps every test reading as one line per request.
 */
const makeClient = (baseUrl) => {
  const request = async (path, { method = "GET", token, body, headers = {} } = {}) => {
    const res = await fetch(baseUrl + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    const text = await res.text();
    let parsed = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    return { status: res.status, body: parsed };
  };

  return {
    request,
    get: (p, o) => request(p, { ...o, method: "GET" }),
    post: (p, body, o) => request(p, { ...o, method: "POST", body }),
    put: (p, body, o) => request(p, { ...o, method: "PUT", body }),
    del: (p, body, o) => request(p, { ...o, method: "DELETE", body }),
  };
};

let counter = 0;

/** Creates a user directly in the DB and returns it with a valid token. */
const makeUser = async (overrides = {}) => {
  counter += 1;
  const user = await User.create({
    name: `Test User ${counter}`,
    email: `user${counter}.${Date.now()}@test.local`,
    password: "password123",
    ...overrides,
  });

  return { user, userId: user._id, token: signToken(user._id) };
};

module.exports = { makeClient, makeUser };
