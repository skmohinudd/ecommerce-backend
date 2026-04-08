const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const { logInfo, logWarn, logError, getRequestLogFields } = require("../logger");

function normalizeItems(rawItems = []) {
  return rawItems.map((item) => ({
    name: item.name || item.title,
    price: Number(item.price),
    quantity: Number(item.quantity || item.qty || 1),
  }));
}

router.post("/", async (req, res) => {
  const requestFields = getRequestLogFields(req);
  const incomingItems = req.body.cart || req.body.items;

  try {
    logInfo("Order create request received", {
      ...requestFields,
      event: "order_create_requested",
      item_count: Array.isArray(incomingItems) ? incomingItems.length : 0,
    });

    if (!incomingItems || !Array.isArray(incomingItems) || incomingItems.length === 0) {
      logWarn("Order create validation failed", {
        ...requestFields,
        event: "order_create_validation_failed",
        reason: "Cart/items are required",
      });

      return res.status(400).json({ error: "Cart/items are required" });
    }

    const normalizedItems = normalizeItems(incomingItems);

    const invalidItem = normalizedItems.find(
      (item) => !item.name || Number.isNaN(item.price) || Number.isNaN(item.quantity)
    );

    if (invalidItem) {
      logWarn("Order item validation failed", {
        ...requestFields,
        event: "order_item_validation_failed",
        invalid_item: invalidItem,
      });

      return res.status(400).json({ error: "Invalid item data in cart" });
    }

    const total = normalizedItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

    logInfo("Order normalized successfully", {
      ...requestFields,
      event: "order_normalized",
      item_count: normalizedItems.length,
      total,
    });

    const newOrder = new Order({
      items: normalizedItems,
      total,
    });

    const saveStart = Date.now();
    await newOrder.save();

    logInfo("Order saved successfully", {
      ...requestFields,
      event: "order_saved",
      order_id: newOrder._id.toString(),
      item_count: normalizedItems.length,
      total,
      db_operation: "mongodb_insert_order",
      db_duration_ms: Date.now() - saveStart,
    });

    res.status(201).json({
      success: true,
      message: "Order stored in DB successfully",
      order: newOrder,
    });
  } catch (err) {
    logError("Order save failed", err, {
      ...requestFields,
      event: "order_save_failed",
      item_count: Array.isArray(incomingItems) ? incomingItems.length : 0,
    });

    res.status(500).json({ error: "Failed to save order" });
  }
});

router.get("/", async (req, res) => {
  const requestFields = getRequestLogFields(req);

  try {
    logInfo("Fetch orders request received", {
      ...requestFields,
      event: "orders_fetch_requested",
    });

    const queryStart = Date.now();
    const orders = await Order.find().sort({ createdAt: -1 });

    logInfo("Orders fetched successfully", {
      ...requestFields,
      event: "orders_fetched",
      order_count: orders.length,
      db_operation: "mongodb_find_orders",
      db_duration_ms: Date.now() - queryStart,
    });

    res.status(200).json(orders);
  } catch (err) {
    logError("Fetch orders failed", err, {
      ...requestFields,
      event: "orders_fetch_failed",
    });

    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

module.exports = router;
