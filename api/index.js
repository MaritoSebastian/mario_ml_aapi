import express from "express";

const app = express();

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

    // 1. Primero intentamos con application/x-www-form-urlencoded (lo normal)
    const params = new URLSearchParams();
    params.append("grant_type", "authorization_code");
    params.append("client_id", process.env.ML_CLIENT_ID);
    params.append("client_secret", process.env.ML_CLIENT_SECRET);
    params.append("code", code);
    params.append("redirect_uri", process.env.ML_REDIRECT_URI);

    const response = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
      },
      body: params
    });

    const data = await response.json();

    if (!response.ok) {
      // 2. Si falla, probamos con application/json
      const jsonResponse = await fetch("https://api.mercadolibre.com/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          grant_type: "authorization_code",
          client_id: process.env.ML_CLIENT_ID,
          client_secret: process.env.ML_CLIENT_SECRET,
          code: code,
          redirect_uri: process.env.ML_REDIRECT_URI
        })
      });

      const jsonData = await jsonResponse.json();

      if (!jsonResponse.ok) {
        return res.status(400).json({
          success: false,
          error: "Error al obtener token",
          details: jsonData
        });
      }

      mlToken = {
        access_token: jsonData.access_token,
        refresh_token: jsonData.refresh_token,
        expires_at: Date.now() + jsonData.expires_in * 1000
      };

      return res.json({
        success: true,
        message: "Token guardado (vía JSON)",
        user_id: jsonData.user_id
      });
    }

    // Si la primera funcionó
    mlToken = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000
    };

    res.json({
      success: true,
      message: "Token guardado (vía URL encoded)",
      user_id: data.user_id
    });

  } catch (error) {
    console.error("Error en callback:", error);
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
  if (Date.now() < mlToken.expires_at) {
    return mlToken.access_token;
  }

  const response = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.ML_CLIENT_ID,
      client_secret: process.env.ML_CLIENT_SECRET,
      refresh_token: mlToken.refresh_token
    })
  });

  const data = await response.json();

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

    const response = await fetch(
      "https://api.mercadolibre.com/sites/MLA/search?q=perfumes&limit=20",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Accept": "application/json"
        }
      }
    );

    const data = await response.json();
    res.json(data.results);
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
  res.json({
    system: "MercadoLibre Perfumes API",
    status: "running",
    authentication: {
      has_token: !!mlToken.access_token,
      token_valid: Date.now() < mlToken.expires_at
    }
  });
});

/* =========================
   AUTH URL
========================= */
app.get("/auth-url", (req, res) => {
  const authUrl = `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${process.env.ML_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.ML_REDIRECT_URI)}`;
  
  res.json({
    success: true,
    auth_url: authUrl
  });
});

app.listen(3000, () => console.log("Server running on port 3000"));
export default app;
