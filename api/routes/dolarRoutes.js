import express from "express";
import {
  getDolar,
  updateDolarManual,
  updateDolarAuto,
} from "../controllers/dolarController.js";

const router = express.Router();

router.get("/", getDolar);
router.post("/", updateDolarManual);
router.post("/auto", updateDolarAuto);

export default router;