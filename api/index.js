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
  const code = req.query.code;

  const response = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.ML_CLIENT_ID,
      client_secret: process.env.ML_CLIENT_SECRET,
      code,
      redirect_uri: process.env.ML_REDIRECT_URI
    })
  });

  const data = await response.json();

  mlToken = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000
  };

  res.send("✅ Token guardado");
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
