import express from "express";
import { createPreference,getOrderById} from "../controllers/paymentController.js";
import { verificarToken } from "../middlewares/authMiddleware.js";


const router = express.Router();

router.post("/create-preference", verificarToken, createPreference);
router.get("/:id",verificarToken,getOrderById);
export default router;