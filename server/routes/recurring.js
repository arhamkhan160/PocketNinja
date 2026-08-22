const express = require("express");
const router = express.Router();
const { list, create, update, remove, runNow } = require("../controllers/recurringController");
const auth = require("../middleware/auth");

router.get("/", auth, list);
router.post("/", auth, create);
// Declared before /:id so "run-now" isn't swallowed as an id param.
router.post("/run-now", auth, runNow);
router.put("/:id", auth, update);
router.delete("/:id", auth, remove);

module.exports = router;
