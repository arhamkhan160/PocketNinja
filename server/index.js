require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./db");
const authRoutes = require("./routes/auth");
const pushRoutes = require("./routes/push");
const analyticsRoutes = require("./routes/analytics");
const recurringRoutes = require("./routes/recurring");
const goalRoutes = require("./routes/goals");
const { startCronJobs } = require("./jobs/cron");

const app = express();


app.use(cors());
app.use(express.json());


app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/recurring", recurringRoutes);
app.use("/api/goals", goalRoutes);


const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  startCronJobs();
  app.listen(PORT, () => {
    console.log(`server running on port ${PORT}`);
  });
};

startServer();
