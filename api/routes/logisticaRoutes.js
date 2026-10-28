import express from "express";
import {
  listarPedidosLogistica,
  actualizarLogistica,
} from "../controllers/logisticaController.js";
import { verificarToken, } from "../middlewares/authMiddleware.js";
import { verificarAdmin } from "../middlewares/VerificarAdmin.js";


const router = express.Router();

router.get("/",verificarToken,verificarAdmin,listarPedidosLogistica);
router.patch("/:id",verificarToken,verificarAdmin, actualizarLogistica);

export default router;