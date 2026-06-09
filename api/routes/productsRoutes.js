import express from "express";
import {
  getProducts,
  createProduct,
  deleteProduct,
  getProductsStats,updateProduct
} from "../controllers/productController.js";
import { verificarToken, } from "../middlewares/authMiddleware.js";
import { verificarAdmin } from "../middlewares/VerificarAdmin.js";

const router = express.Router();

router.get("/", getProducts);
router.post("/", createProduct);
router.delete("/:id" ,verificarToken,verificarAdmin, deleteProduct);
router.get("/stats", getProductsStats);
router.put("/:id", verificarToken, verificarAdmin,updateProduct)

export default router;