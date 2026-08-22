const express = require("express");
const router = express.Router();
const { list, create, update, remove } = require("../controllers/goalController");
const auth = require("../middleware/auth");

router.get("/", auth, list);
router.post("/", auth, create);
router.put("/:id", auth, update);
router.delete("/:id", auth, remove);

module.exports = router;
