// index.js - BACKEND MÍNIMO Y FUNCIONAL
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

let token = null;

// ========== 1. PÁGINA INICIAL ==========
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
        .btn { background: #00a650; color: white; padding: 12px 24px; text-decoration: none; display: inline-block; margin: 5px; }
        .btn-reset { background: #dc3545; }
        .btn-diagnostico { background: #6f42c1; }
      </style>
    </head>
    <body>
      <h1>🔧 Backend API ML</h1>
      <p><strong>Estado:</strong> ${token ? "✅ Token listo" : "❌ Necesita token"}</p>
      
      <div class="card">
        <h3>1. Obtener Token CON PERMISOS</h3>
        <a href="https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=4202688803860967&redirect_uri=https://mario-ml-aapi.vercel.app/callback&prompt=consent&scope=read" 
           class="btn">
           🔓 Autorizar en ML (CON PERMISO DE LECTURA)
        </a>
        <p>Después de autorizar, ML te redirigirá a /callback</p>
        
        <div style="margin-top: 10px;">
          <a href="/reset-token" class="btn btn-reset">🗑️ Reset Token</a>
          <a href="/diagnostico" class="btn btn-diagnostico">🔍 Diagnóstico</a>
          <a href="/public?q=celulares" class="btn" style="background: #20c997;">🌐 Ver productos públicos</a>
        </div>
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
          <li><code>GET /reset-token</code> - Limpiar token actual</li>
          <li><code>GET /diagnostico</code> - Diagnóstico del token</li>
          <li><code>GET /public?q=zapatos</code> - Productos públicos (sin token)</li>
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
  // Parámetros
  const query = req.query.q || "perfumes";
  const limit = req.query.limit || 12;
  const offset = req.query.offset || 0;
  
  console.log("🛍️ Solicitando productos (API PÚBLICA):", { query, limit, offset });
  
  try {
    // ⚡ ¡SOLUCIÓN: QUITAR EL TOKEN! Usar API PÚBLICA
    const response = await fetch(
      `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`
      // SIN headers de Authorization
    );
    
    if (!response.ok) {
      throw new Error(`API ML error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Formatear respuesta para frontend
    res.json({
      success: true,
      source: "API PÚBLICA de MercadoLibre",
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
  try {
    const [itemRes, descRes] = await Promise.all([
      fetch(`https://api.mercadolibre.com/items/${req.params.id}`),
      fetch(`https://api.mercadolibre.com/items/${req.params.id}/description`)
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

// ========== 🆕 6. RESET TOKEN ==========
app.get("/reset-token", (req, res) => {
  const hadToken = token !== null;
  const oldTokenPreview = token ? token.substring(0, 10) + "..." : "none";
  
  // ¡ESTA ES LA LÍNEA QUE BORRA EL TOKEN!
  token = null;
  
  res.json({
    success: true,
    message: hadToken ? "✅ Token eliminado correctamente" : "ℹ️ No había token para eliminar",
    details: {
      had_token: hadToken,
      old_token_preview: oldTokenPreview,
      new_token_state: "null (eliminado)"
    },
    next_steps: [
      "1. Ve a la página principal: /",
      "2. Haz click en 'Autorizar en ML (CON PERMISOS)'",
      "3. ML te pedirá permisos (debes ver READ y WRITE)",
      "4. Serás redirigido a /callback automáticamente",
      "5. El nuevo token se guardará automáticamente"
    ],
    timestamp: new Date().toISOString()
  });
});
// ========== 6. DIAGNÓSTICO TOKEN ==========
app.get("/diagnostico", async (req, res) => {
  if (!token) {
    return res.json({ 
      error: "NO_TOKEN", 
      message: "Primero obtén un token en la página principal" 
    });
  }
  
  try {
    console.log("🔍 Diagnosticando token...");
    
    // 1. Verificar información del usuario (permiso básico)
    const userResponse = await fetch("https://api.mercadolibre.com/users/me", {
      headers: { 
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
      }
    });
    
    const userData = userResponse.ok ? await userResponse.json() : null;
    
    // 2. Probar búsqueda de productos (necesita permiso 'read')
    const searchResponse = await fetch(
      "https://api.mercadolibre.com/sites/MLA/search?q=test&limit=1",
      { 
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json"
        }
      }
    );
    
    // 3. Probar categorías (otro endpoint que necesita permisos)
    const categoriesResponse = await fetch(
      "https://api.mercadolibre.com/sites/MLA/categories",
      { 
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json"
        }
      }
    );
    
    res.json({
      // Información del token
      token_tipo: token.startsWith("APP_USR-") ? "APP_USR (Usuario App)" : 
                  token.startsWith("TG-") ? "TG (Test)" : "Desconocido",
      token_preview: token.substring(0, 40) + "...",
      token_length: token.length,
      
      // Resultados de pruebas
      prueba_1_usuario: {
        endpoint: "/users/me",
        status: userResponse.status,
        ok: userResponse.ok,
        tiene_permiso: userResponse.ok,
        user_id: userData?.id,
        nickname: userData?.nickname
      },
      
      prueba_2_busqueda: {
        endpoint: "/sites/MLA/search",
        status: searchResponse.status,
        ok: searchResponse.ok,
        tiene_permiso_read: searchResponse.ok,
        es_error_403: searchResponse.status === 403,
        mensaje: searchResponse.status === 403 ? 
          "❌ FALTA permiso 'read' para buscar productos" : 
          "✅ TIENE permiso 'read'"
      },
      
      prueba_3_categorias: {
        endpoint: "/sites/MLA/categories",
        status: categoriesResponse.status,
        ok: categoriesResponse.ok,
        tiene_permiso: categoriesResponse.ok
      },
      
      // Análisis
      analisis: searchResponse.status === 403 ? 
        "EL PROBLEMA ES: Token sin permiso 'read'. Necesitas reautorizar CON scope." :
        "Token funciona correctamente para todas las operaciones",
      
      // Soluciones
      soluciones: [
        "1. Ve a /reset-token para eliminar este token",
        "2. Vuelve a la página principal /",
        "3. Usa el botón 'Autorizar en ML (CON PERMISOS)'",
        "4. VERIFICA que ML muestre permisos de LECTURA",
        "5. Vuelve a autorizar"
      ],
      
      // Enlace directo con scope
      url_autorizacion_correcta: "https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=4202688803860967&redirect_uri=https%3A%2F%2Fmario-ml-aapi.vercel.app%2Fcallback&prompt=consent&scope=read"
    });
    
  } catch (error) {
    res.json({ 
      error: "ERROR_DIAGNOSTICO", 
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
  }
});
// ========== 8. PRODUCTOS PÚBLICOS ==========
app.get("/public", async (req, res) => {
  const query = req.query.q || "celulares";
  const limit = Math.min(parseInt(req.query.limit) || 5, 20);
  
  try {
    const response = await fetch(
      `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(query)}&limit=${limit}`
    );
    
    const data = await response.json();
    
    res.json({
      success: true,
      message: "✅ API PÚBLICA - No necesita token",
      query: query,
      limit: limit,
      total: data.paging?.total || 0,
      productos: data.results?.map(item => ({
        id: item.id,
        title: item.title.substring(0, 50) + "...",
        price: item.price,
        currency: item.currency_id,
        thumbnail: item.thumbnail,
        condition: item.condition
      })) || []
    });
    
  } catch (error) {
    res.json({ error: error.message });
  }
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
  
