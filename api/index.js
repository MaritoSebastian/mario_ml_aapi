import express from "express";
import fetch from "node-fetch";

const app = express();

// Endpoint raíz
app.get("/", (req, res) => {
  res.send("Backend funcionando OK");
});

// Endpoint para obtener perfumes con paginación y filtros
app.get("/perfumes", async (req, res) => {
  try {
    // Parámetros de query
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const brand = req.query.brand; // opcional
    const category = req.query.category; // opcional
    const offset = (page - 1) * limit;

    // Construimos la query de búsqueda
    let query = "perfumes"; // palabra clave por defecto
    if (brand) query += ` ${brand}`;
    if (category) query += ` ${category}`;

    // Fetch a Mercado Libre
    const response = await fetch(
      `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`
    );

    const data = await response.json();

    // Filtramos los campos que necesitamos
    const perfumes = data.results.map(item => {
      const eanAttribute = item.attributes.find(attr => attr.id === "EAN");
      return {
        title: item.title,
        thumbnail: item.thumbnail,
        pictures: item.pictures.map(p => p.url),
        ean: eanAttribute ? eanAttribute.value_name : null,
        brand: item.attributes.find(attr => attr.id === "BRAND")?.value_name || null,
        category: item.category_id || null
      };
    });

    // Devolvemos perfumes + info de paginación
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

// Puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
