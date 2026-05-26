import express from "express";
import {
  getDolar,
  updateDolarManual,
  updateDolarAuto,updateAllPrices
} from "../controllers/dolarController.js";

const router = express.Router();

router.get("/", getDolar);
router.post("/", updateDolarManual);
router.post("/auto", updateDolarAuto);
router.post("/all_price",updateAllPrices)
export default router;