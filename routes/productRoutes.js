const express = require("express");
const router = express.Router();
const { logInfo, logWarn, logError, getRequestLogFields } = require("../logger");

const PRODUCTS_API_URL =
  process.env.PRODUCTS_API_URL || "https://api.escuelajs.co/api/v1/products";

router.get("/", async (req, res) => {
  const requestFields = getRequestLogFields(req);
  const upstreamStart = Date.now();

  try {
    logInfo("Products fetch request received", {
      ...requestFields,
      event: "products_fetch_requested",
      dependency_name: "products_upstream_api",
      dependency_type: "http",
      upstream_url: PRODUCTS_API_URL,
    });

    const response = await fetch(PRODUCTS_API_URL);

    if (!response.ok) {
      logWarn("Products upstream API returned non-success response", {
        ...requestFields,
        event: "products_upstream_non_success",
        dependency_name: "products_upstream_api",
        dependency_type: "http",
        dependency_status: "failure",
        upstream_status_code: response.status,
        upstream_url: PRODUCTS_API_URL,
        upstream_duration_ms: Date.now() - upstreamStart,
      });

      return res.status(response.status).json({
        error: "Failed to fetch products from upstream API",
      });
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      logWarn("Products upstream API returned invalid payload", {
        ...requestFields,
        event: "products_upstream_invalid_payload",
        dependency_name: "products_upstream_api",
        dependency_type: "http",
        upstream_url: PRODUCTS_API_URL,
        payload_type: typeof data,
        upstream_duration_ms: Date.now() - upstreamStart,
      });

      return res.status(502).json({
        error: "Invalid products payload received from upstream API",
      });
    }

    let placeholderImageCount = 0;
    let emptyCategoryCount = 0;

    const normalizedProducts = data.map((product) => {
      let imageUrl = "";

      if (Array.isArray(product.images) && product.images.length > 0) {
        imageUrl = product.images[0];
      }

      if (typeof imageUrl !== "string" || !imageUrl.startsWith("http")) {
        imageUrl = "https://via.placeholder.com/300x300?text=No+Image";
        placeholderImageCount += 1;
      }

      if (!product.category?.name) {
        emptyCategoryCount += 1;
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
      dependency_name: "products_upstream_api",
      dependency_type: "http",
      dependency_status: "success",
      raw_product_count: data.length,
      normalized_product_count: normalizedProducts.length,
      placeholder_image_count: placeholderImageCount,
      empty_category_count: emptyCategoryCount,
      upstream_status_code: response.status,
      upstream_url: PRODUCTS_API_URL,
      upstream_duration_ms: Date.now() - upstreamStart,
    });

    res.json(normalizedProducts);
  } catch (err) {
    logError("Products fetch failed", err, {
      ...requestFields,
      event: "products_fetch_failed",
      dependency_name: "products_upstream_api",
      dependency_type: "http",
      dependency_status: "failure",
      upstream_url: PRODUCTS_API_URL,
      upstream_duration_ms: Date.now() - upstreamStart,
    });

    res.status(500).json({ error: "Failed to fetch products" });
  }
});

module.exports = router;