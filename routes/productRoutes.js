const express = require("express");
const router = express.Router();
const { logInfo, logError } = require("../logger");

router.get("/", async (req, res) => {
  try {
    logInfo("Products fetch request received");

    const response = await fetch("https://api.escuelajs.co/api/v1/products");

    if (!response.ok) {
      logInfo("Platzi API returned non-success response", {
        upstream_status_code: response.status,
      });

      return res.status(response.status).json({
        error: "Failed to fetch products from Platzi API",
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

    logInfo("Products fetched successfully from Platzi API", {
      product_count: normalizedProducts.length,
    });

    res.json(normalizedProducts);
  } catch (err) {
    logError("Products fetch failed", err);

    res.status(500).json({ error: "Failed to fetch products" });
  }
});

module.exports = router;