// products.js (tu archivo de productos)
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
      dolar_actual, // 🔴 NUEVO: recibir el dólar actual del front
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
    let dolarReference = null; // 🔴 NUEVO: para guardar referencia del dólar

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
      // No guardamos dolarReference porque se actualiza siempre
    }
    // Viejo formato (compatibilidad) - precio fijo ARS
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

      // 🔴 NUEVO: guardar el dólar actual al momento de crear el producto
      if (dolar_actual && !isNaN(dolar_actual) && dolar_actual > 0) {
        dolarReference = Number(dolar_actual);
      } else {
        // Si no viene dolar_actual, intentamos obtenerlo de la DB
        const db = await getDB();
        const dolarConfig = await db
          .collection("config")
          .findOne({ key: "dolar" });
        if (dolarConfig) {
          dolarReference = dolarConfig.value;
        } else {
          dolarReference = 1000; // valor por defecto
        }
      }
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
      dolar_reference: dolarReference, // 🔴 NUEVO: referencia del dólar para productos ARS
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
      dolar_reference: dolarReference, // opcional: devolverlo para debug
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

// 🔴 NUEVO: Endpoint para obtener estadísticas de productos
export const getProductsStats = async (req, res) => {
  try {
    const db = await getDB();

    const totalProducts = await db.collection("products").countDocuments();
    const fixedPriceProducts = await db.collection("products").countDocuments({
      price: { $ne: null, $exists: true },
    });
    const usdPriceProducts = await db.collection("products").countDocuments({
      price_usd: { $ne: null, $exists: true },
    });

    res.json({
      total: totalProducts,
      fixedPrice: fixedPriceProducts,
      usdPrice: usdPriceProducts,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
//update
/*export const updateProduct = async (req, res) => {
  try {
    const db = await getDB();
    const { id } = req.params;

    const result = await db.collection("products").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: req.body,
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        ok: false,
        error: "PRODUCTO_NO_ENCONTRADO",
      });
    }

    res.json({
      ok: true,
      message: "Producto actualizado",
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
};*/export const updateProduct = async (req, res) => {
  try {
    const db = await getDB();
    const { id } = req.params;

    await db.collection("products").updateOne(
      { _id: new ObjectId(id) },
      { $set: req.body }
    );

    const updatedProduct = await db.collection("products").findOne({
      _id: new ObjectId(id),
    });

    return res.json(updatedProduct);

  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
};