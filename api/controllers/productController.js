import { ObjectId } from "mongodb";

let getDB;

export const setDB = (dbFunction) => {
  getDB = dbFunction;
};

// GET /api/products - Listar productos
export const getProducts = async (req, res) => {
  try {
    const db = await getDB();
    const products = await db
      .collection("products")
      .find()
      .sort({ createdAt: -1 })
      .toArray();

    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/products - Crear producto
export const createProduct = async (req, res) => {
  try {
    const {
      title,
      price,
      price_usd,
      shipping_cost_ars,
      stock,
      category,
      images,
      description,
    } = req.body;

    // Validaciones básicas
    if (!title || stock === undefined || !category || !description) {
      return res.status(400).json({
        ok: false,
        error: "FALTAN_CAMPOS_OBLIGATORIOS",
      });
    }

    if (isNaN(stock) || Number(stock) < 0) {
      return res.status(400).json({
        ok: false,
        error: "STOCK_INVALIDO",
      });
    }

    let finalPrice = null;
    let finalPriceUsd = null;
    let finalShippingCost = null;

    // Nuevo formato (con USD)
    if (price_usd !== undefined && price_usd !== null && price_usd !== "") {
      if (isNaN(price_usd) || Number(price_usd) <= 0) {
        return res.status(400).json({
          ok: false,
          error: "PRICE_USD_INVALIDO",
        });
      }
      finalPriceUsd = Number(price_usd);
      finalShippingCost = Number(shipping_cost_ars) || 0;
      finalPrice = null;
    }
    // Viejo formato (compatibilidad)
    else if (price !== undefined && price !== null && price !== "") {
      if (isNaN(price) || Number(price) <= 0) {
        return res.status(400).json({
          ok: false,
          error: "PRICE_INVALIDO",
        });
      }
      finalPrice = Number(price);
      finalPriceUsd = null;
      finalShippingCost = null;
    } else {
      return res.status(400).json({
        ok: false,
        error: "DEBE_ENVIAR_PRICE_O_PRICE_USD",
      });
    }

    const db = await getDB();

    const product = {
      title,
      price: finalPrice,
      price_usd: finalPriceUsd,
      shipping_cost_ars: finalShippingCost,
      stock: Number(stock),
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
    console.error("ERROR CREATE PRODUCT:", error);
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
};

// DELETE /api/products/:id - Eliminar producto
export const deleteProduct = async (req, res) => {
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
};