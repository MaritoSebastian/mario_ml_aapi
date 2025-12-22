import express from "express";

const app = express();

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
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.ML_CLIENT_ID,
        client_secret: process.env.ML_CLIENT_SECRET,
        code,
        redirect_uri: "https://mario-ml-aapi.vercel.app/callback"
      })
    });

    const data = await response.json();
    accessToken = data.access_token;

    res.json({
      mensaje: "Token obtenido correctamente",
      expires_in: data.expires_in
    });

  } catch (error) {
    console.error("Error OAuth ML:", error);
    res.status(500).send("Error obteniendo token");
  }
});

/* =========================
   PERFUMES (CATÁLOGO)
========================= */
app.get("/perfumes", async (req, res) => {

  if(!accessToken)    {

  return res.status(401).json({
      error: "No hay access token. Primero autenticarse en /callback"
    });

  }
  try {
    const response = await fetch(
      "https://api.mercadolibre.com/sites/MLA/search?q=perfumes&limit=20",{
        headers:{
           Authorization: `Bearer ${accessToken}`
        }
      }
    );

    const data = await response.json();

    const perfumes = data.results.map(item => ({
      id: item.id,
      title: item.title,
      thumbnail: item.thumbnail
    }));

    res.json({
      total:perfumes.length,
      results:perfumes
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
