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

// POST /api/dolar - Admin actualiza manualmente
export const updateDolarManual = async (req, res) => {
  try {
    const { dolar } = req.body;

    if (!dolar || isNaN(dolar) || dolar <= 0) {
      return res.status(400).json({ error: "DOLAR_INVALIDO" });
    }

    const db = await getDB();
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

    res.json({ ok: true, dolar: Number(dolar) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/dolar/auto - Obtener de Binance
export const updateDolarAuto = async (req, res) => {
  try {
    const response = await fetch(
      "https://api.binance.com/api/v3/ticker/price?symbol=USDTARS"
    );
    const data = await response.json();
    const dolarBinance = parseFloat(data.price);

    const db = await getDB();
    const config = await db.collection("config").findOne({ key: "dolar" });

    const hayManualReciente =
      config?.actualizado_manualmente &&
      new Date() - new Date(config.ultima_actualizacion) < 24 * 60 * 60 * 1000;

    if (!hayManualReciente) {
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
    }

    res.json({
      ok: true,
      dolar: dolarBinance,
      actualizado: !hayManualReciente,
      mensaje: hayManualReciente
        ? "No se actualizó (hay valor manual reciente)"
        : "Actualizado desde Binance",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};