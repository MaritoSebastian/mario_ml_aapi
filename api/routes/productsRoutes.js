import express from "express";
import {
  getProducts,
  createProduct,
  deleteProduct,
  getProductsStats
} from "../controllers/productController.js";

const router = express.Router();

router.get("/", getProducts);
router.post("/", createProduct);
router.delete("/:id", deleteProduct);
router.get("/stats", getProductsStats);

export default router;