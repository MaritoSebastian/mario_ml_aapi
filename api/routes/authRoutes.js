import express, { Router } from "express";
import { getMe, register,login } from "../controllers/authController.js";
import { verificarToken } from "../middlewares/authMiddleware.js";
console.log("REGISTER:", register);
console.log("TYPE:", typeof register);

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me",verificarToken,getMe)

export default router;
