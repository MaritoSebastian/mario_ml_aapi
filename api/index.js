import express from "express";
import cors from "cors";


const app = express();
app.use(cors());
app.use(express.json())

let mlToken = {
  access_token: null,
  refresh_token: null, 
  expires_at: 0
};
/* =========================
   AUTENTICACIÓN AUTOMÁTICA AL INICIAR
========================= */
async function initializeMeliAuth() {
  try {
    console.log("🔑 Intentando autenticación automática con MercadoLibre...");
    
    const storedRefreshToken = process.env.ML_REFRESH_TOKEN;
    
    if (storedRefreshToken) {
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
          refresh_token: storedRefreshToken
        })
      });

      const data = await response.json();
      
      if (data.access_token) {
        mlToken = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: Date.now() + data.expires_in * 1000
        };
        console.log("✅ Autenticación automática exitosa");
        return true;
      }
    }
    
    console.log("⚠️  Necesita autenticación manual");
    return false;
  } catch (error) {
    console.error("❌ Error en autenticación automática:", error.message);
    return false;
  }
}

// Ejecutar al inicio
initializeMeliAuth();
/* =========================
   ENDPOINT PARA GUARDAR TOKEN MANUALMENTE
========================= */
app.get("/save-token", async (req, res) => {
  try {
    const { access_token, refresh_token, expires_in } = req.query;
    
    if (!access_token || !refresh_token) {
      return res.status(400).json({
        success: false,
        error: "Faltan parámetros: access_token y refresh_token son requeridos"
      });
    }
    
    mlToken = {
      access_token,
      refresh_token,
      expires_at: Date.now() + (parseInt(expires_in) || 21600) * 1000
    };
    
    // También mostrar el refresh_token para que lo copies
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Token Guardado</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          .token { background: #f0f0f0; padding: 20px; margin: 20px 0; border-radius: 5px; word-break: break-all; }
        </style>
      </head>
      <body>
        <h1>✅ Token guardado correctamente</h1>
        <p>El token se guardó en memoria del servidor.</p>
        
        <h3>⚠️ IMPORTANTE: Guarda este refresh_token:</h3>
        <div class="token">
          <strong>refresh_token:</strong><br>
          ${refresh_token}
        </div>
        
        <p>Agrégalo como variable de entorno en Vercel:</p>
        <div class="token">
          <strong>Nombre:</strong> ML_REFRESH_TOKEN<br>
          <strong>Valor:</strong> ${refresh_token}
        </div>
        
        <p><a href="/status">Ver estado actual</a> | <a href="/perfumes">Probar perfumes</a></p>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

 /* =========================
   CALLBACK MEJORADO
========================= */
app.get("/callback", async (req, res) => {
  try {
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

    // Redirigir a save-token con los parámetros
    res.redirect(`/save-token?access_token=${encodeURIComponent(data.access_token)}&refresh_token=${encodeURIComponent(data.refresh_token)}&expires_in=${data.expires_in}`);
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
});



/* =========================
   TOKEN VÁLIDO
========================= */
async function getValidToken() {
  // Si el token es válido, usarlo
  if (mlToken.access_token && Date.now() < mlToken.expires_at - 60000) { // 1 minuto de margen
    return mlToken.access_token;
  }
  
  // Si tenemos refresh_token, renovar
  if (mlToken.refresh_token) {
    try {
      console.log("🔄 Renovando token expirado...");
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
      
      console.log("✅ Token renovado exitosamente");
      return mlToken.access_token;
    } catch (error) {
      console.error("❌ Error renovando token:", error.message);
      throw new Error("No se pudo renovar el token. Necesita reautenticarse.");
    }
  }
  
  throw new Error("No hay token disponible. Visita /auth-url para autenticarse.");
}


/* =========================
   PERFUMES MANEJO DE ERROR
========================= */
app.get("/perfumes", async (req, res) => {
  try {
    const token = await getValidToken();
    
    const response = await fetch(
      "https://api.mercadolibre.com/sites/MLA/search?q=perfumes&limit=10",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Accept": "application/json"
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`API MercadoLibre responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    res.json({
      success: true,
      count: data.results.length,
      results: data.results.map(p => ({
        id: p.id,
        title: p.title,
        price: p.price,
        currency: p.currency_id,
        thumbnail: p.thumbnail,
        permalink: p.permalink
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      solution: "Visita /auth-url para autenticarte nuevamente",
      current_token_status: {
        has_token: !!mlToken.access_token,
        expires_at: mlToken.expires_at,
        current_time: Date.now()
      }
    });
  }
});

/* =========================
   STATUS MEJORADO
========================= */
app.get("/status", (req, res) => {
  const hasToken = !!mlToken.access_token;
  const isValid = hasToken && (Date.now() < mlToken.expires_at);
  const expiresIn = hasToken ? Math.round((mlToken.expires_at - Date.now()) / 1000) : 0;
  
  res.json({
    system: "MercadoLibre Perfumes API",
    status: "running",
    authentication: {
      has_token: hasToken,
      token_valid: isValid,
      expires_in_seconds: expiresIn,
      expires_at: mlToken.expires_at,
      token_info: hasToken ? "Token disponible" : "Necesita autenticación"
    },
    actions: [
      { endpoint: "/auth-url", action: "Obtener URL de autenticación" },
      { endpoint: "/perfumes", action: "Obtener lista de perfumes" },
      { endpoint: "/status", action: "Ver estado actual" }
    ]
  });
});

/* =========================
   AUTH URL
========================= */
/* =========================
   AUTH URL CON PROMPT=CONSENT
========================= */
app.get("/auth-url", (req, res) => {
  // Agrega &prompt=consent para forzar nuevo refresh_token
  const authUrl = `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${process.env.ML_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.ML_REDIRECT_URI)}&prompt=consent`;
  
  res.json({
    success: true,
    auth_url: authUrl,
    note: "Usa esta URL para obtener refresh_token"
  });
});

app.listen(3000, () =>  {console.log("Server running on port 3000");initializeMeliAuth()});
export default app;
  