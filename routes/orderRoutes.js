const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const { logInfo, logError } = require("../logger");

router.post("/", async (req, res) => {
  try {
    const incomingItems = req.body.cart || req.body.items;

    logInfo("Order create request received", {
      item_count: Array.isArray(incomingItems) ? incomingItems.length : 0,
    });

    if (!incomingItems || !Array.isArray(incomingItems) || incomingItems.length === 0) {
      logInfo("Order create validation failed", {
        reason: "Cart/items are required",
      });

      return res.status(400).json({ error: "Cart/items are required" });
    }

    const normalizedItems = incomingItems.map((item) => ({
      name: item.title,
      price: item.price,
      quantity: item.quantity || item.qty || 1,
    }));

    const total = normalizedItems.reduce((acc, item) => {
      return acc + item.price * item.quantity;
    }, 0);

    logInfo("Order normalized successfully", {
      item_count: normalizedItems.length,
      total,
    });

    const newOrder = new Order({
      items: normalizedItems,
      total,
    });

    logInfo("Saving order to MongoDB", {
      total,
      item_count: normalizedItems.length,
    });

    await newOrder.save();

    logInfo("Order saved successfully", {
      order_id: newOrder._id.toString(),
      total,
      item_count: normalizedItems.length,
    });

    res.status(201).json({
      success: true,
      message: "Order stored in DB successfully",
      order: newOrder,
    });
  } catch (err) {
    logError("Order save failed", err);

    res.status(500).json({ error: "Failed to save order" });
  }
});

router.get("/", async (req, res) => {
  try {
    logInfo("Fetch orders request received");

    const orders = await Order.find().sort({ createdAt: -1 });

    logInfo("Orders fetched successfully", {
      order_count: orders.length,
    });

    res.status(200).json(orders);
  } catch (err) {
    logError("Fetch orders failed", err);

    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

module.exports = router;