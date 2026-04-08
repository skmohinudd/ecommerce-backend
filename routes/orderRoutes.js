const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const {
  logInfo,
  logWarn,
  logError,
  getRequestLogFields,
  summarizeCart,
} = require("../logger");

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
      ...summarizeCart(incomingItems),
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

    const invalidIndex = normalizedItems.findIndex(
      (item) =>
        !item.name ||
        Number.isNaN(item.price) ||
        Number.isNaN(item.quantity) ||
        item.quantity <= 0 ||
        item.price < 0
    );

    if (invalidIndex !== -1) {
      logWarn("Order item validation failed", {
        ...requestFields,
        event: "order_item_validation_failed",
        invalid_item_index: invalidIndex,
        invalid_item: normalizedItems[invalidIndex],
        reason: "Item contains invalid name, price, or quantity",
      });

      return res.status(400).json({ error: "Invalid item data in cart" });
    }

    const total = normalizedItems.reduce(
      (acc, item) => acc + item.price * item.quantity,
      0
    );

    logInfo("Order normalized successfully", {
      ...requestFields,
      event: "order_normalized",
      ...summarizeCart(normalizedItems),
      total,
    });

    const newOrder = new Order({
      items: normalizedItems,
      total,
    });

    logInfo("Order persistence started", {
      ...requestFields,
      event: "order_persist_started",
      ...summarizeCart(normalizedItems),
      total,
      db_operation: "mongodb_insert_order",
      db_collection: "orders",
    });

    const saveStart = Date.now();
    await newOrder.save();

    logInfo("Order saved successfully", {
      ...requestFields,
      event: "order_saved",
      order_id: newOrder._id.toString(),
      created_at: newOrder.createdAt,
      ...summarizeCart(normalizedItems),
      total,
      db_operation: "mongodb_insert_order",
      db_collection: "orders",
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
      ...summarizeCart(incomingItems),
      db_operation: "mongodb_insert_order",
      db_collection: "orders",
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
      result_state: orders.length === 0 ? "empty" : "data_found",
      db_operation: "mongodb_find_orders",
      db_collection: "orders",
      db_duration_ms: Date.now() - queryStart,
    });

    res.status(200).json(orders);
  } catch (err) {
    logError("Fetch orders failed", err, {
      ...requestFields,
      event: "orders_fetch_failed",
      db_operation: "mongodb_find_orders",
      db_collection: "orders",
    });

    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

module.exports = router;