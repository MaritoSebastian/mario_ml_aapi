export const verificarWebhook = (req, res) => {
  console.log("ENTRÓ AL WEBHOOK DE WHATSAPP");

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("WEBHOOK VERIFICADO CORRECTAMENTE");

    return res.status(200).send(challenge);
  }

  console.log("ERROR EN VERIFICACIÓN DEL WEBHOOK");

  return res.sendStatus(403);
};
export const recibirWebhook = (req, res) => {
  console.log("📩 Webhook recibido:");
  console.log(JSON.stringify(req.body, null, 2));

  return res.status(200).send("EVENT_RECEIVED");
};
export const enviarComprobante = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        error: "Falta el identificador de la orden",
      });
    }

    const db = await req.app.locals.getDB();

    const { ObjectId } = await import("mongodb");

    if (!ObjectId.isValid(orderId)) {
      return res.status(400).json({
        error: "Identificador de orden inválido",
      });
    }

    const order = await db.collection("orders").findOne({
      _id: new ObjectId(orderId),
    });

    if (!order) {
      return res.status(404).json({
        error: "Orden no encontrada",
      });
    }

    if (order.status !== "approved") {
      return res.status(400).json({
        error: "El pago todavía no está aprobado",
      });
    }

    if (!order.whatsapp) {
      return res.status(400).json({
        error: "La orden no tiene un teléfono de WhatsApp",
      });
    }

    const token = process.env.TOKEN_WP_API;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token || !phoneNumberId) {
      return res.status(500).json({
        error: "Falta configurar WhatsApp en el servidor",
      });
    }

    const telefono = String(order.whatsapp).replace(/\D/g, "");

    const mensaje = [
      `Hola ${order.name || ""}, recibimos tu pedido de Tienda Paraguay.`,
      `Número de orden: ${order._id}`,
      `Total: $${order.total} ARS`,
      "Gracias por tu compra.",
    ].join("\n");

    const respuesta = await fetch(
      `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: telefono,
          type: "text",
          text: { body: mensaje },
        }),
      }
    );

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      console.error("ERROR AL ENVIAR WHATSAPP:", resultado);

      return res.status(502).json({
        error: "WhatsApp no pudo enviar el mensaje",
      });
    }

    return res.status(200).json({
      mensaje: "Comprobante enviado por WhatsApp",
    });
  } catch (error) {
    console.error("ERROR ENVIANDO COMPROBANTE:", error);

    return res.status(500).json({
      error: "Error interno al enviar el comprobante",
    });
  }
};