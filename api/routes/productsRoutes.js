import express from "express";
import {
  getProducts,
  createProduct,
  deleteProduct,
  updateAllPrices,
  getProductsStats
} from "../controllers/productController.js";

const router = express.Router();

router.get("/", getProducts);
router.post("/", createProduct);
router.delete("/:id", deleteProduct);
router.post("/update-prices", updateAllPrices);
router.get("/stats", getProductsStats);

export default router;