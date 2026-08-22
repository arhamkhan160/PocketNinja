require("./env");
const express = require("express");

/**
 * Builds the same router stack index.js mounts, minus the listen/connect side
 * effects, so tests can drive real HTTP without booting the production entry
 * point.
 *
 * The require order below mirrors index.js on purpose: routes/categories,
 * transactions and budgets pull in the authoritative models, and must load
 * before routes/analytics registers the placeholder shapes from
 * models/_analyticsModels.js.
 */
const buildApp = () => {
  const app = express();
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.use("/api/auth", require("../../routes/auth"));
  app.use("/api/push", require("../../routes/push"));
  app.use("/api/categories", require("../../routes/categories"));
  app.use("/api/transactions", require("../../routes/transactions"));
  app.use("/api/budgets", require("../../routes/budgets"));
  app.use("/api/analytics", require("../../routes/analytics"));
  app.use("/api/recurring", require("../../routes/recurring"));
  app.use("/api/goals", require("../../routes/goals"));

  return app;
};

/** Listens on an ephemeral port so parallel test files never collide. */
const startServer = async () => {
  const app = buildApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address();

  return {
    baseUrl: `http://127.0.0.1:${port}/api`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
};

module.exports = { buildApp, startServer };
