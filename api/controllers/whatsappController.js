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

    const fecha = order.createdAt
      ? new Date(order.createdAt).toLocaleDateString("es-AR", {
          timeZone: "America/Argentina/Tucuman",
        })
      : "No disponible";

    const numeroOrden = String(order._id);
    const pago = String(order.paymentId || "No disponible");
    const nombre = String(order.name || "Cliente");
    const email = String(order.email || "No disponible");
    const direccion = String(order.adress || "No disponible");

    const productos = (order.items || [])
      .map((item) => {
        const cantidad = Number(item.quantity || 1);
        const precio = Number(item.price || 0);
        const subtotal = precio * cantidad;

        return `${item.title || "Producto"} x ${cantidad} - Unitario: $${precio} - Subtotal: $${subtotal}`;
      })
      .join("; ");

    const total = String(order.total ?? 0);

    const respuesta = await fetch(
      `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: telefono,
          type: "template",
          template: {
            name: "confirmacion_de_pago",
            language: { code: "es" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: numeroOrden },
                  { type: "text", text: fecha },
                  { type: "text", text: pago },
                  { type: "text", text: nombre },
                  { type: "text", text: email },
                  { type: "text", text: direccion },
                  { type: "text", text: productos || "Sin detalle" },
                  { type: "text", text: total },
                ],
              },
            ],
          },
        }),
      }
    );

    const resultado = await respuesta.json();

    console.log(
      "RESPUESTA DE META:",
      JSON.stringify(resultado, null, 2)
    );

    if (!respuesta.ok) {
      console.error("ERROR AL ENVIAR WHATSAPP:", resultado);

      return res.status(502).json({
        error: "WhatsApp no pudo enviar el mensaje",
        detalle: resultado,
      });
    }

    return res.status(200).json({
      mensaje: "Comprobante enviado por WhatsApp",
      messageId: resultado.messages?.[0]?.id,
    });
  } catch (error) {
    console.error("ERROR ENVIANDO COMPROBANTE:", error);

    return res.status(500).json({
      error: "Error interno al enviar el comprobante",
    });
  }
};
