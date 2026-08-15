import { Preference, MercadoPagoConfig } from "mercadopago";
import dotenv from "dotenv";
dotenv.config();

const clients = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
  
});

console.log(
  "MP TOKEN CARGADO:",
  process.env.MP_ACCESS_TOKEN
    ? process.env.MP_ACCESS_TOKEN.slice(0, 15) + "..."
    : "NO EXISTE"
);
export const createPreference = async (req, res) => {
  console.log("USUARIO LOGUEADO:", req.user);

  try {
    const { items } = req.body;

    const db = await req.app.locals.getDB();

    const order = {
      userId: req.user.userId,
      items,
      total: items.reduce(
        (acc, item) => acc + Number(item.price) * Number(item.quantity),
        0
      ),
      status: "pending",
      paymentId: null,
      createdAt: new Date(),
    };

    const result = await db.collection("orders").insertOne(order);

    console.log("ORDER CREADA:", result.insertedId);

    const FRONT_URL = process.env.VERCEL_TIENDA_FRONT;

    const preference = {
      items: items.map((item) => ({
        title: item.title,
        unit_price: Number(item.price),
        quantity: Number(item.quantity),
        currency_id: "ARS",
      })),

      external_reference: result.insertedId.toString(),

      back_urls: {
        success: `${FRONT_URL}/success`,
        failure: `${FRONT_URL}/error`,
        pending: `${FRONT_URL}/pending`,
      },

      notification_url: "https://mario-ml-aapi.vercel.app/webhook",

      auto_return: "approved",
    };

    const preferenceCliente = new Preference(clients);

    const response = await preferenceCliente.create({
      body: preference,
    });

    console.log("ITEMS MP:", items);
    console.log("PREFERENCIA CREADA:", response.id);

    res.json({
      init_point: response.init_point,
    });

  } catch (error) {
    console.error("ERROR MP COMPLETO:", error);
    console.error("MENSAJE:", error.message);
    console.error("CAUSE:", error.cause);

    res.status(500).json({
      error: error.message,
      detail: error.response?.data || null,
    });
  }
};