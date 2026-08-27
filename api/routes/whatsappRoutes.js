import express from "express";
import { verificarWebhook,recibirWebhook } from "../controllers/whatsappController.js";

const router = express.Router();

router.get("/webhook", verificarWebhook);
router.post("/webhook", recibirWebhook);

export default router;