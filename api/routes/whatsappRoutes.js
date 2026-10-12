
import express from "express";
import {
  verificarWebhook,
  recibirWebhook,
  enviarComprobante,
} from "../controllers/whatsappController.js";
import { verificarToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/webhook", verificarWebhook);
router.post("/webhook", recibirWebhook);

router.post("/enviar-comprobante", verificarToken, enviarComprobante);

export default router;