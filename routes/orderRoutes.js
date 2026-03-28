const express = require("express");
const router = express.Router();
const Order = require("../models/Order");

router.post("/", async (req, res) => {
  try {
    const { items, total } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Items are required" });
    }

    const calculatedTotal = items.reduce((acc, item) => {
      return acc + item.price * (item.quantity || 1);
    }, 0);

    const newOrder = new Order({
      items,
      total: total ?? calculatedTotal,
    });

    await newOrder.save();

    res.status(201).json({
      message: "Order stored in DB successfully",
      order: newOrder,
    });
  } catch (err) {
    console.error("Order save error:", err);
    res.status(500).json({ error: "Failed to save order" });
  }
});

router.get("/", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (err) {
    console.error("Fetch orders error:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

module.exports = router;