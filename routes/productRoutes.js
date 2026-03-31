const express = require("express");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const response = await fetch("https://fakestoreapi.com/products");

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Failed to fetch products from Fake Store API",
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Products fetch error:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

module.exports = router;