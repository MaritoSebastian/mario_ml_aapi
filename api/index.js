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
//initializeMeliAuth();
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
    
    console.log("=== CALLBACK DEBUG ===");
    console.log("📥 Código recibido:", code ? "✓" : "✗", code);
    console.log("📥 Query completo:", req.query);
    
    if (!code) {
      console.log("❌ ERROR: No hay código en el callback");
      return res.status(400).send("No se recibió código de autorización");
    }

    console.log("🔄 Intercambiando código por token...");
    
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
        code: code,
        redirect_uri: process.env.ML_REDIRECT_URI
      })
    });

    const data = await response.json();
    
    console.log("=== RESPUESTA DE MERCADOLIBRE ===");
    console.log("Status:", response.status);
    console.log("✅ Access token:", data.access_token ? "PRESENTE" : "AUSENTE");
    console.log("🔄 Refresh token:", data.refresh_token ? "PRESENTE" : "AUSENTE");
    console.log("📊 Data completa:", JSON.stringify(data, null, 2));
    
    if (data.error) {
      console.log("❌ Error de ML:", data.error, "-", data.message);
      throw new Error(`ML Error: ${data.error} - ${data.message}`);
    }

    if (!data.access_token) {
      console.log("❌ Error crítico: No hay access_token");
      throw new Error("No se recibió access_token");
    }

    // Guardar en memoria
    mlToken = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || null, // Aquí puede ser null
      expires_at: Date.now() + (data.expires_in || 21600) * 1000
    };
    
    console.log("💾 Token guardado en memoria:", {
      has_refresh_token: !!mlToken.refresh_token,
      expires_at: new Date(mlToken.expires_at).toISOString()
    });

    // Redirigir a save-token con LOS DATOS REALES
    console.log("🔀 Redirigiendo a /save-token con params...");
    
    // Crear parámetros SEGUROS
    const params = new URLSearchParams();
    if (data.access_token) params.append('access_token', data.access_token);
    if (data.refresh_token) params.append('refresh_token', data.refresh_token);
    params.append('expires_in', data.expires_in || 21600);
    
    const redirectUrl = `/save-token?${params.toString()}`;
    console.log("📍 URL de redirección:", redirectUrl);
    
    res.redirect(redirectUrl);
    
  } catch (error) {
    console.error("💥 ERROR EN CALLBACK:", error.message);
    res.status(500).send(`
      <h1>Error en callback</h1>
      <p><strong>${error.message}</strong></p>
      <p>Revisa la consola del servidor para más detalles.</p>
      <a href="/auth-url">Volver a intentar</a>
    `);
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

/* =========================
   DEBUG COMPLETO - AGREGAR AL FINAL
========================= */

/* =========================
   DEEP DEBUG - PARA VER EXACTAMENTE QUÉ PASA
========================= */
app.get("/deep-debug", async (req, res) => {
  const step = req.query.step || '1';
  const code = req.query.code;
  
  console.log(`🔍 Deep Debug - Paso ${step}`);
  
  // PASO 1: Mostrar URL de auth MEJORADA
  if (step === '1') {
    const authUrl = `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${process.env.ML_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.ML_REDIRECT_URI)}&approval_prompt=force&scope=offline_access`;
    
    return res.json({
      paso: "1. Obtener código de autorización",
      url_auth: authUrl,
      instrucciones: "1. Copia esta URL\n2. Ábrela en navegador\n3. Autoriza la app\n4. Copia el código de la URL resultante\n5. Ve al paso 2",
      codigo_ejemplo: "TG-1234567890abcdef"
    });
  }
  
  // PASO 2: Verificar código
  if (step === '2' && code) {
    return res.json({
      paso: "2. Código recibido",
      codigo: code.substring(0, 20) + "...",
      longitud: code.length,
      siguiente_paso: `/deep-debug?step=3&code=${encodeURIComponent(code)}`
    });
  }
  
  // PASO 3: Intercambiar código por token (EL MÁS IMPORTANTE)
  if (step === '3' && code) {
    try {
      console.log("🔄 DEBUG: Intercambiando código por token...");
      console.log("📥 Código recibido (primeros 20 chars):", code.substring(0, 20));
      
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
          code: code,
          redirect_uri: process.env.ML_REDIRECT_URI
        })
      });
      
      const data = await response.json();
      
      // ANÁLISIS DETALLADO
      const tieneRefreshToken = !!data.refresh_token;
      
      console.log("📊 DEBUG - Respuesta de ML:", {
        status: response.status,
        tiene_access_token: !!data.access_token,
        tiene_refresh_token: tieneRefreshToken,
        refresh_token_valor: data.refresh_token || "UNDEFINED",
        error: data.error || "No",
        expires_in: data.expires_in
      });
      
      // Guardar si hay tokens
      if (data.access_token) {
        mlToken = {
          access_token: data.access_token,
          refresh_token: data.refresh_token || null,
          expires_at: Date.now() + (data.expires_in || 21600) * 1000
        };
        console.log("💾 DEBUG - Token guardado en memoria");
      }
      
      return res.json({
        paso: "3. RESULTADO CRÍTICO - Respuesta de MercadoLibre",
        analisis: {
          status_code: response.status,
          tiene_access_token: !!data.access_token,
          tiene_refresh_token: tieneRefreshToken,
          refresh_token_recibido: data.refresh_token ? "✅ SÍ" : "❌ NO",
          valor_refresh_token: data.refresh_token || "(null/undefined/empty)",
          error: data.error || "No hay error",
          mensaje: data.message || "No hay mensaje"
        },
        respuesta_completa: data,
        
        // Acciones según resultado
        acciones: tieneRefreshToken ? [
          { 
            accion: "🎉 ¡EXITO! Tienes refresh_token", 
            descripcion: "ML devolvió refresh_token correctamente",
            guardar_manual: `/save-direct?refresh_token=${encodeURIComponent(data.refresh_token)}&access_token=${encodeURIComponent(data.access_token)}`,
            ver_token: `/view-current-token`
          }
        ] : [
          { 
            accion: "⚠️ PROBLEMA: No hay refresh_token", 
            descripcion: "ML NO está devolviendo refresh_token en la respuesta",
            solucion_1: "Usar URL con approval_prompt=force y scope=offline_access",
            solucion_2: "Revocar tokens antiguos en ML Developers",
            url_con_force: `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${process.env.ML_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.ML_REDIRECT_URI)}&approval_prompt=force&scope=offline_access`
          }
        ]
      });
      
    } catch (error) {
      console.error("💥 DEBUG - Error:", error);
      return res.status(500).json({ 
        error: error.message,
        stack: error.stack 
      });
    }
  }
  
  res.json({ error: "Parámetros incorrectos. Usa ?step=1 para comenzar" });
});

/* =========================
   GUARDADO DIRECTO (sin pasar por /callback)
========================= */
app.get("/save-direct", (req, res) => {
  const refresh_token = req.query.refresh_token;
  const access_token = req.query.access_token;
  
  if (!refresh_token || refresh_token === 'undefined') {
    return res.json({
      error: true,
      mensaje: "refresh_token es requerido y no puede ser undefined",
      recibido: refresh_token
    });
  }
  
  // Guardar DIRECTAMENTE en memoria
  mlToken = {
    access_token: access_token || mlToken.access_token || "direct_access",
    refresh_token: refresh_token,
    expires_at: Date.now() + 21600 * 1000
  };
  
  console.log("💾 GUARDADO DIRECTO - Token:", {
    refresh_token_preview: refresh_token.substring(0, 20) + "...",
    longitud: refresh_token.length
  });
  
  res.json({
    exito: true,
    mensaje: "✅ Refresh_token guardado DIRECTAMENTE en memoria del servidor",
    token: {
      refresh_token_preview: refresh_token.substring(0, 30) + "...",
      longitud_total: refresh_token.length,
      tipo: refresh_token.startsWith("TG-") ? "✅ Formato TG- correcto" : "⚠️ Formato inusual"
    },
    siguiente_paso: {
      accion: "Copiar este valor COMPLETO:",
      valor: refresh_token,
      para_vercel: "Agregar como ML_REFRESH_TOKEN en Vercel"
    },
    verificar: "/view-current-token",
    probar_api: "/perfumes"
  });
});

/* =========================
   VER TOKEN ACTUAL
========================= */
app.get("/view-current-token", (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    token_en_memoria: {
      access_token: mlToken.access_token ? "✅ PRESENTE" : "❌ AUSENTE",
      refresh_token: mlToken.refresh_token ? "✅ PRESENTE" : "❌ AUSENTE",
      valor_refresh_token: mlToken.refresh_token || "(null/undefined)",
      expira: mlToken.expires_at ? new Date(mlToken.expires_at).toLocaleString() : "Nunca",
      valido: mlToken.access_token && Date.now() < mlToken.expires_at ? "✅ SÍ" : "❌ NO"
    },
    entorno: {
      ML_CLIENT_ID: process.env.ML_CLIENT_ID ? "✅" : "❌",
      ML_CLIENT_SECRET: process.env.ML_CLIENT_SECRET ? "✅" : "❌",
      ML_REDIRECT_URI: process.env.ML_REDIRECT_URI || "❌",
      ML_REFRESH_TOKEN: process.env.ML_REFRESH_TOKEN ? "✅" : "❌ (ESTE ES EL PROBLEMA PRINCIPAL)"
    }
  });
});

/* =========================
   AUTH URL MEJORADA (usa esta en lugar de la vieja)
========================= */
app.get("/auth-new", (req, res) => {
  // URL que DEBERÍA dar refresh_token SIEMPRE
  const authUrl = `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${process.env.ML_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.ML_REDIRECT_URI)}&approval_prompt=force&scope=offline_access`;
  
  res.json({
    success: true,
    auth_url: authUrl,
    explicacion: "URL con approval_prompt=force (olvida auth previa) y scope=offline_access (permite refresh_token)",
    garantia: "Esta URL DEBERÍA darte refresh_token si o si"
  });
});

/* =========================
   TEST RÁPIDO DE PERFUMES
========================= */
app.get("/test-perfumes", async (req, res) => {
  try {
    const token = await getValidToken();
    
    const response = await fetch(
      "https://api.mercadolibre.com/sites/MLA/search?q=perfumes&limit=5",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Accept": "application/json"
        }
      }
    );
    
    const data = await response.json();
    
    res.json({
      success: true,
      token_funciona: "✅",
      cantidad_perfumes: data.results.length,
      perfumes: data.results.map(p => ({
        nombre: p.title,
        precio: p.price,
        link: p.permalink
      }))
    });
    
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      token_actual: mlToken,
      necesita_auth: "Visita /auth-new para autenticar"
    });
  }
});

// ========== MANTÉN TU app.listen EXISTENTE ==========
app.listen(3000, () =>  {
  console.log("Server running on port 3000");
  //initializeMeliAuth();
});

export default app;