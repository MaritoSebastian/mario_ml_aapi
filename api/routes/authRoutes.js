import express, { Router } from "express";
import { getMe, register,login } from "../controllers/authController.js";
import { verificarToken } from "../middlewares/authMiddleware.js";
import { solicitarReset,verificarCodigo,resetearPassword } from "../controllers/passwordResetController.js";
console.log("REGISTER:", register);
console.log("TYPE:", typeof register);

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me",verificarToken,getMe);
// Nuevas rutas para recuperación de contraseña
router.post("/solicitar-reset",solicitarReset);
router.post("/verificar-codigo",verificarCodigo);
router.post("/resetear-password",resetearPassword);

export default router;
