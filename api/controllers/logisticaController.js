
import { ObjectId } from "mongodb";

const LOGISTICA_INICIAL = {
  estado: "pendiente",
  encargado: "",
  fechaCompra: null,
  fechaEnvio: null,
  fechaRecepcionTucuman: null,
  fechaPreparacion: null,
  fechaSalidaReparto: null,
  fechaEntrega: null,
  transporte: "",
  seguimiento: "",
  observaciones: "",
};

const ESTADOS_LOGISTICA = [
  "pendiente",
  "comprado",
  "en_transito",
  "recibido_tucuman",
  "en_preparacion",
  "en_reparto",
  "entregado",
];

const CAMPOS_EDITABLES = [
  "estado",
  "encargado",
  "fechaCompra",
  "fechaEnvio",
  "fechaRecepcionTucuman",
  "fechaPreparacion",
  "fechaSalidaReparto",
  "fechaEntrega",
  "transporte",
  "seguimiento",
  "observaciones",
];

// Listar pedidos cuyo pago fue aprobado.
export const listarPedidosLogistica = async (req, res) => {
  try {
    const db = await req.app.locals.getDB();

    const pedidos = await db.collection("orders")
      .find({ status: "approved" })
      .sort({ createdAt: -1 })
      .toArray();

    const pedidosConLogistica = pedidos.map((pedido) => ({
      ...pedido,
      logistica: {
        ...LOGISTICA_INICIAL,
        ...(pedido.logistica || {}),
      },
    }));

    return res.json(pedidosConLogistica);
  } catch (error) {
    console.error("ERROR AL LISTAR LOGÍSTICA:", error);
    return res.status(500).json({
      error: "No se pudieron obtener los pedidos",
    });
  }
};

// Actualizar exclusivamente la logística de una orden.
export const actualizarLogistica = async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        error: "ID de pedido inválido",
      });
    }

    const cambios = req.body;

    if (
      !cambios ||
      typeof cambios !== "object" ||
      Array.isArray(cambios)
    ) {
      return res.status(400).json({
        error: "Los datos logísticos no son válidos",
      });
    }

    const cambiosPermitidos = {};

    for (const campo of CAMPOS_EDITABLES) {
      if (Object.hasOwn(cambios, campo)) {
        cambiosPermitidos[`logistica.${campo}`] = cambios[campo];
      }
    }

    if (Object.keys(cambiosPermitidos).length === 0) {
      return res.status(400).json({
        error: "No se recibieron campos logísticos válidos",
      });
    }

    if (
      cambios.estado !== undefined &&
      !ESTADOS_LOGISTICA.includes(cambios.estado)
    ) {
      return res.status(400).json({
        error: "Estado logístico no válido",
      });
    }

    for (const campo of [
      "fechaCompra",
      "fechaEnvio",
      "fechaRecepcionTucuman",
      "fechaPreparacion",
      "fechaSalidaReparto",
      "fechaEntrega",
    ]) {
      if (
        Object.hasOwn(cambios, campo) &&
        cambios[campo] !== null &&
        (
          typeof cambios[campo] !== "string" ||
          Number.isNaN(Date.parse(cambios[campo]))
        )
      ) {
        return res.status(400).json({
          error: `La fecha ${campo} no es válida`,
        });
      }
    }

    const db = await req.app.locals.getDB();
    const orders = db.collection("orders");

    const pedido = await orders.findOne({
      _id: new ObjectId(id),
    });

    if (!pedido) {
      return res.status(404).json({
        error: "Pedido no encontrado",
      });
    }

    if (pedido.status !== "approved") {
      return res.status(409).json({
        error: "El pago debe estar aprobado para avanzar con la logística",
      });
    }

    const logisticaActual = {
      ...LOGISTICA_INICIAL,
      ...(pedido.logistica || {}),
    };

    const logisticaActualizada = {
      ...logisticaActual,
    };

    for (const campo of CAMPOS_EDITABLES) {
      if (Object.hasOwn(cambios, campo)) {
        logisticaActualizada[campo] = cambios[campo];
      }
    }

    await orders.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          logistica: logisticaActualizada,
        },
      }
    );

    const pedidoActualizado = await orders.findOne({
      _id: new ObjectId(id),
    });

    return res.json({
      mensaje: "Logística actualizada correctamente",
      pedido: pedidoActualizado,
    });
  } catch (error) {
    console.error("ERROR AL ACTUALIZAR LOGÍSTICA:", error);
    return res.status(500).json({
      error: "No se pudo actualizar la logística",
    });
  }
};
