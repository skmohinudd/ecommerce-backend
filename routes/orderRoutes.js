const express = require("express");
const router = express.Router();
const Order = require("../models/Order");

router.post("/", async (req, res) => {
  try {
    const incomingItems = req.body.cart || req.body.items;

    if (!incomingItems || !Array.isArray(incomingItems) || incomingItems.length === 0) {
      return res.status(400).json({ error: "Cart/items are required" });
    }

    const normalizedItems = incomingItems.map((item) => ({
      name: item.name,
      price: item.price,
      quantity: item.quantity || item.qty || 1,
    }));

    const total = normalizedItems.reduce((acc, item) => {
      return acc + item.price * item.quantity;
    }, 0);

    const newOrder = new Order({
      items: normalizedItems,
      total,
    });

    await newOrder.save();

    res.status(201).json({
      success: true,
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