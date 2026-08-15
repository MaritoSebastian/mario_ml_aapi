import express from "express";
import { createPreference } from "../controllers/paymentController.js";
import { verificarToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/create-preference", verificarToken, createPreference);

export default router;