
import express from "express";

const app = express();
app.use(express.json());

// Guardamos el token en memoria (por ahora)
let accessToken = null;

/* =========================
   CALLBACK OAUTH ML
========================= */

app.get("/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("No se recibió el code");
  }

  try {
    const response = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        code,
        redirect_uri: "https://mario-ml-aapi.vercel.app/callback"
      })
    });

    const data = await response.json();

    accessToken = data.access_token;

    console.log("ACCESS TOKEN ML:", accessToken);

    res.json({
      mensaje: "Token obtenido correctamente",
      user_id: data.user_id,
      expires_in: data.expires_in
    });

  } catch (error) {
    console.error("Error OAuth ML:", error);
    res.status(500).send("Error obteniendo token");
  }
});

/* =========================
   PERFUMES (PÚBLICO)
========================= */
app.get("/perfumes", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const brand = req.query.brand;
    const category = req.query.category;
    const offset = (page - 1) * limit;

    let query = "perfumes";
    if (brand) query += ` ${brand}`;
    if (category) query += ` ${category}`;

    const response = await fetch(
      `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`
    );

    const data = await response.json();

    const perfumes = data.results.map(item => {
      const eanAttribute = item.attributes.find(attr => attr.id === "EAN");
      return {
        title: item.title,
        thumbnail: item.thumbnail,
        pictures: item.pictures?.map(p => p.url) || [],
        ean: eanAttribute ? eanAttribute.value_name : null,
        brand: item.attributes.find(attr => attr.id === "BRAND")?.value_name || null,
        category: item.category_id || null
      };
    });

    res.json({
      page,
      limit,
      total: data.paging.total,
      perfumes
    });

  } catch (error) {
    console.error("Error obteniendo perfumes:", error);
    res.status(500).json({ error: "Error obteniendo perfumes" });
  }
});

/* =========================
   SERVER
========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
