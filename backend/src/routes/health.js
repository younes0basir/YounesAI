const { Router } = require("express");
const pool = require("../db");

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      status: "ok",
      timestamp: result.rows[0].now,
    });
  } catch (err) {
    res.status(503).json({ status: "error", message: err.message });
  }
});

module.exports = router;
