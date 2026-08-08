const PushSubscription = require("../models/PushSubscription");

const getVapidPublicKey = (_req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
};

const subscribe = async (req, res) => {
  try {
    const { subscription } = req.body;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: "Invalid subscription object" });
    }

    const existing = await PushSubscription.findOne({
      userId: req.userId,
      "subscription.endpoint": subscription.endpoint,
    });

    if (existing) {
      existing.subscription = subscription;
      await existing.save();
      return res.json({ message: "Subscription updated" });
    }

    await PushSubscription.create({
      userId: req.userId,
      subscription,
    });

    res.status(201).json({ message: "Subscription saved" });
  } catch (err) {
    console.error("Subscribe error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

const unsubscribe = async (req, res) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({ error: "Endpoint is required" });
    }

    const result = await PushSubscription.findOneAndDelete({
      userId: req.userId,
      "subscription.endpoint": endpoint,
    });

    if (!result) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    res.json({ message: "Subscription removed" });
  } catch (err) {
    console.error("Unsubscribe error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = { getVapidPublicKey, subscribe, unsubscribe };
