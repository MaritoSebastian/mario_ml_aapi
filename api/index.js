import express from "express";

const app = express();


/* =========================
   CALLBACK OAUTH ML
========================= */
async function getAccessToken() {
  const response = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.ML_CLIENT_ID,
      client_secret: process.env.ML_CLIENT_SECRET
    })
  });

  const data = await response.json();
  return data.access_token;
}

/* =========================
   PERFUMES (CATÁLOGO)
========================= */
app.get("/perfumes", async (req, res) => {


  try {
     const accessToken=await getAccessToken();
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
