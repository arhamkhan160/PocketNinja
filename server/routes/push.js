const express = require("express");
const router = express.Router();
const { getVapidPublicKey, subscribe, unsubscribe } = require("../controllers/pushController");
const auth = require("../middleware/auth");

router.get("/vapidPublicKey", getVapidPublicKey);
router.post("/subscribe", auth, subscribe);
router.delete("/subscribe", auth, unsubscribe);

module.exports = router;
