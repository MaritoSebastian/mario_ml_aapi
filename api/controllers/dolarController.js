
let getDB;

export const setDB = (dbFunction) => {
  getDB = dbFunction;
};

// GET /api/dolar - Obtener cotización actual
export const getDolar = async (req, res) => {
  try {
    const db = await getDB();
    let config = await db.collection("config").findOne({ key: "dolar" });

    if (!config) {
      config = {
        key: "dolar",
        value: 1500,
        actualizado_manualmente: false,
        ultima_actualizacion: new Date(),
      };
      await db.collection("config").insertOne(config);
    }

    res.json({
      dolar: config.value,
      actualizado_manualmente: config.actualizado_manualmente || false,
      ultima_actualizacion: config.ultima_actualizacion,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// dolarController.js

// Helper: actualiza productos ARS solo si el nuevo dólar es mayor
async function updateProductPricesIfHigher(db, newDolar) {
  if (!newDolar || isNaN(newDolar) || newDolar <= 0) return 0;

  const productsToUpdate = await db.collection("products").find({
    price: { $ne: null, $exists: true },
    dolar_reference: { $ne: null, $exists: true }
  }).toArray();

  let updatedCount = 0;
  for (const product of productsToUpdate) {
    if (newDolar > product.dolar_reference) {
      const priceInUSD = product.price / product.dolar_reference;
      const newPrice = Math.ceil(priceInUSD * newDolar);
      await db.collection("products").updateOne(
        { _id: product._id },
        {
          $set: {
            price: newPrice,
            last_price_update: new Date(),
            dolar_reference: newDolar
          }
        }
      );
      updatedCount++;
    }
  }
  return updatedCount;
}

// Luego vienen getDolar, updateDolarManual, etc.

// POST /api/dolar - Admin actualiza manualmente
export const updateDolarManual = async (req, res) => {
  try {
    const { dolar } = req.body;
    if (!dolar || isNaN(dolar) || dolar <= 0) {
      return res.status(400).json({ error: "DOLAR_INVALIDO" });
    }

    const db = await getDB();
    const oldConfig = await db.collection("config").findOne({ key: "dolar" });
    const oldDolar = oldConfig?.value || null;

    // Actualizar el dólar en configuración
    await db.collection("config").updateOne(
      { key: "dolar" },
      {
        $set: {
          value: Number(dolar),
          actualizado_manualmente: true,
          ultima_actualizacion: new Date(),
        },
      },
      { upsert: true }
    );

    // Actualizar precios si el nuevo es mayor
    let updatedCount = 0;
    if (oldDolar && Number(dolar) > oldDolar) {
      updatedCount = await updateProductPricesIfHigher(db, Number(dolar));
    }

    res.json({
      ok: true,
      dolar: Number(dolar),
      productsUpdated: updatedCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/dolar/auto - Obtener de Binance
export const updateDolarAuto = async (req, res) => {
  try {
    const response = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=USDTARS");
    const data = await response.json();
    const dolarBinance = parseFloat(data.price);

    const db = await getDB();
    const config = await db.collection("config").findOne({ key: "dolar" });

    const hayManualReciente =
      config?.actualizado_manualmente &&
      new Date() - new Date(config.ultima_actualizacion) < 24 * 60 * 60 * 1000;

    let updatedCount = 0;
    let actualizado = false;

    if (!hayManualReciente) {
      const oldDolar = config?.value || null;

      await db.collection("config").updateOne(
        { key: "dolar" },
        {
          $set: {
            value: dolarBinance,
            actualizado_manualmente: false,
            ultima_actualizacion: new Date(),
          },
        },
        { upsert: true }
      );

      if (oldDolar && dolarBinance > oldDolar) {
        updatedCount = await updateProductPricesIfHigher(db, dolarBinance);
      }
      actualizado = true;
    }

    res.json({
      ok: true,
      dolar: dolarBinance,
      actualizado,
      productsUpdated: updatedCount,
      mensaje: hayManualReciente
        ? "No se actualizó (hay valor manual reciente)"
        : "Actualizado desde Binance",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
