const mongoose = require("mongoose");

const pushSubscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "userId is required"],
    index: true,
  },
  subscription: {
    type: Object,
    required: [true, "Push subscription object is required"],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("PushSubscription", pushSubscriptionSchema);
