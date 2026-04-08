const express = require("express");
const router = express.Router();
const { logInfo, logWarn, logError, getRequestLogFields } = require("../logger");

const PRODUCTS_API_URL = process.env.PRODUCTS_API_URL || "https://api.escuelajs.co/api/v1/products";

router.get("/", async (req, res) => {
  const requestFields = getRequestLogFields(req);
  const upstreamStart = Date.now();

  try {
    logInfo("Products fetch request received", {
      ...requestFields,
      event: "products_fetch_requested",
      upstream_url: PRODUCTS_API_URL,
    });

    const response = await fetch(PRODUCTS_API_URL);

    if (!response.ok) {
      logWarn("Products upstream API returned non-success response", {
        ...requestFields,
        event: "products_upstream_non_success",
        upstream_status_code: response.status,
        upstream_url: PRODUCTS_API_URL,
        upstream_duration_ms: Date.now() - upstreamStart,
      });

      return res.status(response.status).json({
        error: "Failed to fetch products from upstream API",
      });
    }

    const data = await response.json();

    const normalizedProducts = data.map((product) => {
      let imageUrl = "";

      if (Array.isArray(product.images) && product.images.length > 0) {
        imageUrl = product.images[0];
      }

      if (typeof imageUrl !== "string" || !imageUrl.startsWith("http")) {
        imageUrl = "https://via.placeholder.com/300x300?text=No+Image";
      }

      return {
        id: product.id,
        name: product.title,
        price: product.price,
        image: imageUrl,
        description: product.description,
        category: product.category?.name || "",
      };
    });

    logInfo("Products fetched successfully from upstream API", {
      ...requestFields,
      event: "products_fetched",
      product_count: normalizedProducts.length,
      upstream_status_code: response.status,
      upstream_url: PRODUCTS_API_URL,
      upstream_duration_ms: Date.now() - upstreamStart,
    });

    res.json(normalizedProducts);
  } catch (err) {
    logError("Products fetch failed", err, {
      ...requestFields,
      event: "products_fetch_failed",
      upstream_url: PRODUCTS_API_URL,
      upstream_duration_ms: Date.now() - upstreamStart,
    });

    res.status(500).json({ error: "Failed to fetch products" });
  }
});

module.exports = router;
