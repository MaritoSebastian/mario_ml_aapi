
import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import { ObjectId } from "mongodb";

const app = express();
app.use(cors());
app.use(express.json());

let client;
let db;

async function getDB() {
  if (db) return db;

  client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  db = client.db();
  return db;
}

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

/* =====GUARDAR  ===== */
app.post("/api/products", async (req, res) => {
  try {
    const { title, price, stock, category, images, description } = req.body;

    if (!title || !price) {
      return res.status(400).json({
        ok: false,
        error: "BODY_VACIO_O_INVALIDO",
      });
    }

    const db = await getDB();

    const product = {
      title,
      price: Number(price),
      stock: Number(stock || 0),
      category,
      images: images || [],
      description,
      ml: {
        published: false,
        item_id: null,
      },
      createdAt: new Date(),
    };

    const result = await db.collection("products").insertOne(product);

    res.json({
      ok: true,
      message: "Producto guardado",
      productId: result.insertedId,
    });
  } catch (error) {
    console.error("ERROR PRODUCTS:", error);
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
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

//====PPUBLICAR USANDO MONGO====//
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

//====LISTAR PROIDUCTOS===//
app.get("/api/products", async (req, res) => {
  const db = await getDB();
  const products = await db
    .collection("products")
    .find()
    .sort({ createdAt: -1 })
    .toArray();

  res.json(products);
});
//====ELIMINAR PRODUCTO====//
app.delete("/api/products/:id", async (req, res) => {
  try {
    const db = await getDB();
    const { id } = req.params;

    const result = await db.collection("products").deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        ok: false,
        error: "PRODUCTO_NO_ENCONTRADO",
      });
    }

    res.json({
      ok: true,
      message: "Producto eliminado",
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

export default app;
