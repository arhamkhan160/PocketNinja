/**
 * Must be required FIRST in every test file, before any app module.
 *
 * Two reasons this can't be a .env file: tests need a database that is safe to
 * wipe between cases, and push/webpush.js calls setVapidDetails() at require
 * time and throws if the VAPID vars are missing.
 */
process.env.NODE_ENV = "test";

// node --test runs each file in its own process, in parallel. A shared
// database would mean one file's clear()/dropDatabase() wiping another file's
// rows and indexes mid-run, so each process gets its own and drops it at the
// end.
const TEST_DB_HOST = process.env.TEST_MONGODB_HOST || "mongodb://localhost:27017";
process.env.MONGODB_URI = `${TEST_DB_HOST}/pocketninja_test_${process.pid}`;
process.env.JWT_SECRET = "test_jwt_secret_do_not_use_in_production";

// A real, throwaway VAPID pair — web-push validates the key length and the
// subject scheme at require time, so placeholders would blow up.
process.env.VAPID_PUBLIC_KEY =
  "BCXFcLsM9WlTppBypeLWIxPaVT7tGnYSBC5gBCMvlr91anangVnHNvOY7xyff-w3W2pyiZhqvnpHmgOnS6MSjgg";
process.env.VAPID_PRIVATE_KEY = "L4g68k3V3YH9cA_UfpK90v1ueTRYT8-vZeupvKIGE5I";
process.env.VAPID_SUBJECT = "mailto:test@pocketninja.test";
process.env.REMINDER_LEAD_DAYS = "3";
process.env.RUN_CRON_ON_STARTUP = "false";

module.exports = {};
