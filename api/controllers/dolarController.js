
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
    
    // Obtener el dólar anterior antes de actualizar
    const oldConfig = await db.collection("config").findOne({ key: "dolar" });
    const oldDolar = oldConfig?.value || null;
    
    // Actualizar el dólar
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

    // 🔴 NUEVO: Si el nuevo dólar es mayor, actualizar precios de productos
    let updatedCount = 0;
    if (oldDolar && Number(dolar) > oldDolar) {
      // Llamar a la función de actualización de precios
      const productsToUpdate = await db.collection("products").find({
        price: { $ne: null, $exists: true },
        dolar_reference: { $ne: null, $exists: true }
      }).toArray();

      
      
      for (const product of productsToUpdate) {
        if (Number(dolar) > product.dolar_reference) {
          const priceInUSD = product.price / product.dolar_reference;
          const newPrice = Math.ceil(priceInUSD * Number(dolar));
          
          await db.collection("products").updateOne(
            { _id: product._id },
            { 
              $set: { 
                price: newPrice,
                last_price_update: new Date(),
                dolar_reference: Number(dolar)
              } 
            }
          );
          updatedCount++;
        }
      }
      
      console.log(`Precios actualizados: ${updatedCount} productos`);
    }

    res.json({ 
      ok: true, 
      dolar: Number(dolar),
      productsUpdated: updatedCount || 0
    });
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

    let updatedCount = 0;
    
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
      
      // 🔴 NUEVO: Si el nuevo dólar es mayor, actualizar precios
      if (oldDolar && dolarBinance > oldDolar) {
        const productsToUpdate = await db.collection("products").find({
          price: { $ne: null, $exists: true },
          dolar_reference: { $ne: null, $exists: true }
        }).toArray();

        for (const product of productsToUpdate) {
          if (dolarBinance > product.dolar_reference) {
            const priceInUSD = product.price / product.dolar_reference;
            const newPrice = Math.ceil(priceInUSD * dolarBinance);
            
            await db.collection("products").updateOne(
              { _id: product._id },
              { 
                $set: { 
                  price: newPrice,
                  last_price_update: new Date(),
                  dolar_reference: dolarBinance
                } 
              }
            );
            updatedCount++;
          }
        }
      }
    }

    res.json({
      ok: true,
      dolar: dolarBinance,
      actualizado: !hayManualReciente,
      productsUpdated: updatedCount,
      mensaje: hayManualReciente
        ? "No se actualizó (hay valor manual reciente)"
        : "Actualizado desde Binance",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};