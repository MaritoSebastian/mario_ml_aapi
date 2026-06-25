import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);
import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import dolarRoutes from "./routes/dolarRoutes.js";
import productsRoutes from "./routes/productsRoutes.js";
import { MongoClient, ObjectId } from "mongodb";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { setDB as setDolarDB } from "./controllers/dolarController.js";
import { setDB as setProductsDB } from "./controllers/productController.js";
import { verificarToken } from "./middlewares/authMiddleware.js";

let client;
let db;
const uri = process.env.MONGODB_URI;

// ===== PRIMERO: Configurar Cloudinary =====
console.log("CLOUD:", {
  name: process.env.CLOUD_NAME,
  key: process.env.CLOUD_API_KEY,
  secret: process.env.CLOUD_API_SECRET,
});
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
  secure: true,
});

// ===== SEGUNDO: Crear app =====
const app = express();
app.use(cors());
app.use(express.json());

// ===== TERCERO: Función getDB =====
async function getDB() {
  if (db) return db;
  if (!client) {
    console.log("🔄 Creando nuevo cliente MongoDB...");
    client = new MongoClient(uri);
  }
  if (!client.topology || !client.topology.isConnected()) {
    console.log("🔄 Conectando a MongoDB...");
    await client.connect();
    db = client.db();
    console.log("✅ MongoDB conectado");
  }
  return db;
}

app.locals.getDB = getDB;

// ===== CUARTO: Configurar controllers con DB =====
setProductsDB(getDB);
setDolarDB(getDB);

// ===== QUINTO: Rutas =====
app.use("/api/auth", authRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/dolar", dolarRoutes);

// ===== RESTO DE ENDPOINTS (upload, ML, MP, etc) =====
console.log("CLOUDINARY_URL:", process.env.CLOUDINARY_URL);

const clients = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "productos",
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
  },
});

const upload = multer({ storage });

app.post("/api/upload", (req, res) => {
  upload.single("image")(req, res, function (err) {
    if (err) {
      console.error("UPLOAD ERROR:", err);
      return res.status(500).json({
        ok: false,
        error: err.message,
      });
    }
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: "NO_FILE_RECEIVED",
      });
    }
    console.log("FILE OK:", req.file.path);
    const optimizedUrl = req.file.path.replace(
      "/upload/",
      "/upload/f_auto,q_auto,w_800/",
    );
    res.json({
      ok: true,
      imageUrl: optimizedUrl,
    });
  });
});

/* ===== HEALTH ===== */
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

/* ===== ML STATUS ===== */
app.get("/api/ml/status", async (req, res) => {
  const db = await getDB();
  const token = await db.collection("tokens_ml").findOne({});
  res.json({
    conectado: !!token,
    usuario: token?.nickname || null,
  });
});

/* ===== PUBLICAR ===== */
app.post("/api/ml/item", async (req, res) => {
  const db = await getDB();
  const token = await db.collection("tokens_ml").findOne({});
  if (!token) {
    return res.status(401).json({ error: "NO_CONECTADO_ML" });
  }
  const mlRes = await fetch("https://api.mercadolibre.com/items", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(req.body),
  });
  const data = await mlRes.json();
  res.status(mlRes.status).json(data);
});

//==== PUBLICAR USANDO MONGO ====//
app.post("/api/ml/publish/:id", async (req, res) => {
  const db = await getDB();
  const token = await db.collection("tokens_ml").findOne({});
  if (!token) {
    return res.status(401).json({ error: "NO_CONECTADO_ML" });
  }
  const product = await db.collection("products").findOne({
    _id: new ObjectId(req.params.id),
  });
  if (!product) {
    return res.status(404).json({ error: "PRODUCTO_NO_EXISTE" });
  }
  const mlRes = await fetch("https://api.mercadolibre.com/items", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: product.title,
      price: product.price,
      available_quantity: product.stock,
      category_id: product.category,
      pictures: product.images.map((url) => ({ source: url })),
      description: {
        plain_text: product.description,
      },
    }),
  });
  const data = await mlRes.json();
  if (mlRes.ok) {
    await db.collection("products").updateOne(
      { _id: product._id },
      {
        $set: {
          "ml.published": true,
          "ml.item_id": data.id,
        },
      },
    );
  }
  res.status(mlRes.status).json(data);
});

//==== ENDPOINT MERCADO PAGO ====//
app.post("/api/create-preference", verificarToken, async (req, res) => {
  console.log("USUARIO LOGUEADO:", req.user);
  try {
    const { items } = req.body;
    const db = await getDB();
    const order = {
      items,
      total: items.reduce((acc, item) => acc + item.price * item.quantity, 0),
      status: "pending",
      paymentId: null,
      createdAt: new Date(),
    };
    const result = await db.collection("orders").insertOne(order);
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
    const response = await preferenceCliente.create({ body: preference });
    res.json({
      init_point: response.init_point,
    });
    console.log("ITEMS MP:", items);
  } catch (error) {
  console.error("ERROR MP COMPLETO:", error);
  console.error("MENSAJE:", error.message);
  console.error("CAUSE:", error.cause);

  res.status(500).json({
    error: error.message,
    detail: error.response?.data || null,
  });
}
});

//==== WEBHOOK ====//
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;
    console.log("WEBHOOK RECIBIDO:", body);
    if (body.type === "payment") {
      const paymentId = body.data.id;
      const paymentRes = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
          },
        },
      );
      const payment = await paymentRes.json();
      const orderId = payment.external_reference;
      if (!orderId) {
        console.log("SIN external_reference");
        return res.sendStatus(200);
      }
      const db = await getDB();
      const existingOrder = await db.collection("orders").findOne({
        _id: new ObjectId(orderId),
      });
      if (!existingOrder) {
        console.log("ORDER NO EXISTE");
        return res.sendStatus(200);
      }
      if (existingOrder.paymentId) {
        console.log("YA PROCESADO");
        return res.sendStatus(200);
      }
      await db.collection("orders").updateOne(
        { _id: existingOrder._id },
        {
          $set: {
            status: payment.status,
            paymentId: paymentId,
          },
        },
      );
      console.log("ORDER ACTUALIZADA:", orderId);
    }
    res.sendStatus(200);
  } catch (error) {
    console.error("WEBHOOK ERROR:", error);

    res.sendStatus(500);
  }
});

//==== SETUP PASSWORD RESETS ====//
async function setupPasswordResetsCollection() {
  try {
    const db = await getDB();
    const collection = db.collection("password_resets");
    await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await collection.createIndex({ email: 1, code: 1 });
    await collection.createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 86400 },
    );
    console.log("✅ Colección password_resets configurada con índices");
  } catch (error) {
    console.error("❌ Error configurando password_resets:", error);
  }
}

setupPasswordResetsCollection().catch(console.error);

//==== INICIAR SERVIDOR ====//
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

export default app;
