
import express from "express";

const app = express();
app.use(express.json());

let mlToken = {
  access_token: null,
  refresh_token: null,
  expires_at: 0
};

/* =========================
   CALLBACK
========================= */
app.get("/callback", async (req, res) => {
  try {
    const code = req.query.code;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: "Código de autorización no recibido"
      });
    }

    const response = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.ML_CLIENT_ID,
        client_secret: process.env.ML_CLIENT_SECRET,
        code: code,
        redirect_uri: process.env.ML_REDIRECT_URI
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(400).json({
        success: false,
        error: "Error al obtener token",
        details: data
      });
    }

    mlToken = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000
    };

    res.json({
      success: true,
      message: "Token guardado exitosamente",
      user_id: data.user_id,
      expires_in: data.expires_in
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      message: error.message
    });
  }
});

/* =========================
   TOKEN VÁLIDO
========================= */
async function getValidToken() {
  if (!mlToken.access_token) {
    throw new Error("No hay token disponible. Autoriza la aplicación primero.");
  }

  if (Date.now() < mlToken.expires_at - 60000) {
    return mlToken.access_token;
  }

  const response = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.ML_CLIENT_ID,
      client_secret: process.env.ML_CLIENT_SECRET,
      refresh_token: mlToken.refresh_token
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Error al refrescar token: ${JSON.stringify(data)}`);
  }

  mlToken = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000
  };

  return mlToken.access_token;
}

/* =========================
   PERFUMES
========================= */
app.get("/perfumes", async (req, res) => {
  try {
    const token = await getValidToken();
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || "perfumes";

    const response = await fetch(
      `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(search)}&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Error de API: ${response.status}`);
    }

    const data = await response.json();
    
    const perfumes = data.results.map(item => ({
      id: item.id,
      title: item.title,
      price: item.price,
      currency_id: item.currency_id,
      thumbnail: item.thumbnail,
      condition: item.condition,
      permalink: item.permalink,
      seller: {
        id: item.seller.id,
        nickname: item.seller.nickname
      }
    }));

    res.json({
      success: true,
      data: {
        perfumes: perfumes,
        count: perfumes.length
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* =========================
   STATUS
========================= */
app.get("/status", (req, res) => {
  const tieneToken = !!mlToken.access_token;
  const valido = tieneToken && Date.now() < mlToken.expires_at;

  res.json({
    system: "MercadoLibre Perfumes API",
    status: "running",
    authentication: {
      has_token: tieneToken,
      token_valid: valido
    },
    environment: {
      ml_client_id_configured: !!process.env.ML_CLIENT_ID,
      ml_redirect_uri: process.env.ML_REDIRECT_URI || "No configurado"
    }
  });
});

/* =========================
   AUTH URL
========================= */
app.get("/auth-url", (req, res) => {
  if (!process.env.ML_CLIENT_ID || !process.env.ML_REDIRECT_URI) {
    return res.status(500).json({
      success: false,
      error: "Variables de entorno no configuradas"
    });
  }

  const authUrl = `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${process.env.ML_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.ML_REDIRECT_URI)}`;
  
  res.json({
    success: true,
    auth_url: authUrl
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor en puerto ${PORT}`);
});

export default app;
