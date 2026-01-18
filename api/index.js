// index.js - BACKEND MÍNIMO Y FUNCIONAL
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

let token = null;

// ========== 1. PÁGINA INICIAL ==========
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>🔧 Backend ML API</title>
      <style>
        body { font-family: Arial; padding: 40px; }
        .card { background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; }
        .btn { background: #00a650; color: white; padding: 12px 24px; text-decoration: none; display: inline-block; }
      </style>
    </head>
    <body>
      <h1>🔧 Backend API ML</h1>
      <p><strong>Estado:</strong> ${token ? "✅ Token listo" : "❌ Necesita token"}</p>
      
      <div class="card">
        <h3>1. Obtener Token</h3>
        <a href="https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=4202688803860967&redirect_uri=https://mario-ml-aapi.vercel.app/callback&prompt=consent" 
           target="_blank" class="btn">
           🔓 Autorizar en ML
        </a>
        <p>Después de autorizar, ML te redirigirá a /callback</p>
      </div>
      
      <div class="card">
        <h3>2. Verificar</h3>
        <a href="/status" class="btn">📊 Ver estado</a>
        <a href="/productos" class="btn">🛍️ Ver productos (JSON)</a>
      </div>
      
      <div class="card">
        <h3>3. Endpoints API</h3>
        <ul>
          <li><code>GET /status</code> - Estado del backend</li>
          <li><code>GET /productos</code> - Lista de productos (JSON)</li>
          <li><code>GET /productos?q=perfumes&limit=10</code> - Con parámetros</li>
          <li><code>GET /producto/:id</code> - Detalle de producto</li>
        </ul>
      </div>
    </body>
    </html>
  `);
});

// ========== 2. CALLBACK (EL MÁS IMPORTANTE) ==========
app.get("/callback", async (req, res) => {
  console.log("📥 CALLBACK llamado. Query:", req.query);
  
  const code = req.query.code;
  
  if (!code) {
    return res.json({ 
      error: "No se recibió código",
      solution: "Visita la página principal y autoriza la app" 
    });
  }
  
  console.log("🔄 Intercambiando código por token...");
  
  try {
    const response = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { 
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: "4202688803860967",
        client_secret: "B6qrKXFari6LvmKzzdumSheXJQqzpNH5",
        code: code,
        redirect_uri: "https://mario-ml-aapi.vercel.app/callback"
      })
    });
    
    const data = await response.json();
    console.log("📊 Respuesta ML:", { 
      status: response.status,
      access_token: data.access_token ? "✅" : "❌",
      error: data.error || "none" 
    });
    
    if (data.access_token) {
      token = data.access_token;
      res.json({ 
        success: true, 
        message: "Token obtenido correctamente",
        token_preview: token.substring(0, 30) + "...",
        expires_in: data.expires_in,
        next_step: "Ahora puedes usar /productos"
      });
    } else {
      res.json({ 
        success: false, 
        error: data.error,
        message: data.message,
        full_response: data
      });
    }
  } catch (error) {
    res.json({ 
      success: false, 
      error: "FETCH_ERROR",
      message: error.message 
    });
  }
});

// ========== 3. ENDPOINT PRODUCTOS (PARA FRONTEND) ==========
app.get("/productos", async (req, res) => {
  // Si no hay token
  if (!token) {
    return res.json({ 
      error: "NO_TOKEN",
      message: "Primero obtén un token autorizando la app",
      auth_url: "https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=4202688803860967&redirect_uri=https://mario-ml-aapi.vercel.app/callback&prompt=consent"
    });
  }
  
  // Parámetros
  const query = req.query.q || "perfumes";
  const limit = req.query.limit || 12;
  const offset = req.query.offset || 0;
  
  console.log("🛍️ Solicitando productos:", { query, limit, offset });
  
  try {
    const response = await fetch(
      `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Accept": "application/json"
        }
      }
    );
    
    // Si el token expiró
    if (response.status === 401) {
      token = null;
      return res.json({ 
        error: "TOKEN_EXPIRED",
        message: "El token expiró. Vuelve a autorizar la app",
        auth_url: "https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=4202688803860967&redirect_uri=https://mario-ml-aapi.vercel.app/callback&prompt=consent"
      });
    }
    
    if (!response.ok) {
      throw new Error(`API ML error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Formatear respuesta para frontend
    res.json({
      success: true,
      query: query,
      pagination: {
        total: data.paging?.total || 0,
        offset: data.paging?.offset || 0,
        limit: data.paging?.limit || limit
      },
      productos: data.results?.map(item => ({
        id: item.id,
        title: item.title,
        price: item.price,
        currency: item.currency_id,
        thumbnail: item.thumbnail,
        image: item.thumbnail.replace("-I.jpg", "-O.jpg"), // Imagen grande
        permalink: item.permalink,
        condition: item.condition,
        free_shipping: item.shipping?.free_shipping || false
      })) || []
    });
    
  } catch (error) {
    res.json({ 
      success: false, 
      error: "API_ERROR",
      message: error.message 
    });
  }
});

// ========== 4. DETALLE DE PRODUCTO ==========
app.get("/producto/:id", async (req, res) => {
  if (!token) {
    return res.json({ error: "NO_TOKEN" });
  }
  
  try {
    const [itemRes, descRes] = await Promise.all([
      fetch(`https://api.mercadolibre.com/items/${req.params.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      }),
      fetch(`https://api.mercadolibre.com/items/${req.params.id}/description`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    ]);
    
    const item = await itemRes.json();
    const desc = await descRes.json();
    
    res.json({
      success: true,
      producto: {
        id: item.id,
        title: item.title,
        price: item.price,
        currency: item.currency_id,
        condition: item.condition,
        images: item.pictures?.map(p => p.url) || [item.thumbnail],
        attributes: item.attributes || [],
        description: desc.plain_text || ""
      }
    });
    
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// ========== 5. STATUS ==========
app.get("/status", (req, res) => {
  res.json({
    backend: "MercadoLibre API",
    status: "running",
    token: token ? "✅ PRESENTE" : "❌ AUSENTE",
    token_preview: token ? token.substring(0, 20) + "..." : null,
    timestamp: new Date().toISOString(),
    endpoints: {
      home: "GET /",
      callback: "GET /callback (automático)",
      productos: "GET /productos?q=query&limit=num",
      producto: "GET /producto/:id",
      status: "GET /status"
    }
  });
});

// ========== INICIAR ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 ===================================");
  console.log("🚀 BACKEND ML API - VERSIÓN SIMPLE");
  console.log("🚀 Puerto:", PORT);
  console.log("🚀 ===================================");
  console.log("📋 Endpoints:");
  console.log("   /          - Página de inicio");
  console.log("   /callback  - Callback de ML");
  console.log("   /productos - API productos (JSON)");
  console.log("   /status    - Estado del backend");
  console.log("🚀 ===================================");
});

export default app;
  
  