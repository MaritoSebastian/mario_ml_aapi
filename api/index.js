// index.js - BACKEND COMPLETO TIENDA ML
/*import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== CONFIGURACIÓN ==========
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://maritosebastianchavez1975_db_user:tnZrcWuV1ushLZ9D@tiendameli.mrdqx2l.mongodb.net/tienda_ml?retryWrites=true&w=majority&appName=tiendaMeli';
const CLIENT_ID = process.env.CLIENT_ID || '4202688803860967';
const CLIENT_SECRET = process.env.CLIENT_SECRET || 'B6qrKXFari6LvmKzzdumSheXJQqzpNH5';
const REDIRECT_URI = process.env.REDIRECT_URI || 'https://mario-ml-aapi.vercel.app/callback';
const PORT = process.env.PORT || 3000;

// Conexión a MongoDB
let db, client;
async function connectDB() {
    try {
        client = new MongoClient(MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        await client.connect();
        db = client.db();
        console.log('✅ Conectado a MongoDB Atlas');
        
        // Crear índices
        await db.collection('tokens_ml').createIndex({ user_id: 1 }, { unique: true });
        await db.collection('productos').createIndex({ estado: 1 });
        await db.collection('productos').createIndex({ created_at: -1 });
        
        return true;
    } catch (error) {
        console.error('❌ Error conectando a MongoDB:', error.message);
        return false;
    }
}

// Iniciar conexión
connectDB();

// ========== MIDDLEWARE PARA CONEXIÓN DB ==========
app.use(async (req, res, next) => {
    if (!db) {
        const connected = await connectDB();
        if (!connected) {
            return res.status(503).json({ 
                error: 'Database unavailable',
                message: 'No se pudo conectar a la base de datos' 
            });
        }
    }
    next();
});

// ========== RUTAS PRINCIPALES ==========

// 1. PÁGINA DE INICIO
app.get('/', async (req, res) => {
    try {
        const tokens = await db.collection('tokens_ml').findOne({});
        const productosCount = await db.collection('productos').countDocuments();
        const publicadosCount = await db.collection('productos').countDocuments({ estado: 'publicado' });
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>🏪 TiendaML - Dashboard</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
                    .container { max-width: 1200px; margin: 0 auto; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 15px; margin-bottom: 30px; }
                    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 30px 0; }
                    .stat-card { background: white; padding: 25px; border-radius: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); text-align: center; }
                    .btn { display: inline-block; background: #00a650; color: white; padding: 12px 24px; border-radius: 5px; text-decoration: none; margin: 5px; }
                    .btn-connect { background: #667eea; }
                    .btn-disconnect { background: #e53e3e; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🏪 TiendaML - Sistema de Publicación</h1>
                        <p>Conecta tu cuenta de MercadoLibre y comienza a publicar productos</p>
                    </div>
                    
                    ${!tokens ? `
                        <div style="background: #fff3cd; padding: 20px; border-radius: 10px; margin: 20px 0;">
                            <h3>⚠️ No conectado a MercadoLibre</h3>
                            <p>Conecta tu cuenta para comenzar a publicar productos</p>
                            <a href="https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=offline_access read write" class="btn btn-connect">
                                🔗 Conectar con MercadoLibre
                            </a>
                        </div>
                    ` : `
                        <div style="background: #d4edda; padding: 20px; border-radius: 10px; margin: 20px 0;">
                            <h3>✅ Conectado como: ${tokens.nickname}</h3>
                            <p>Token expira: ${new Date(tokens.expires_at).toLocaleString()}</p>
                            <div style="margin-top: 15px;">
                                <a href="/dashboard" class="btn">📊 Dashboard</a>
                                <a href="/productos" class="btn">📦 Ver Productos</a>
                                <a href="/disconnect" class="btn btn-disconnect">🔓 Desconectar</a>
                            </div>
                        </div>
                    `}
                    
                    <div class="stats">
                        <div class="stat-card">
                            <h3>📦 Productos</h3>
                            <p style="font-size: 2rem; font-weight: bold;">${productosCount}</p>
                            <p>En tu catálogo</p>
                        </div>
                        <div class="stat-card">
                            <h3>✅ Publicados</h3>
                            <p style="font-size: 2rem; font-weight: bold;">${publicadosCount}</p>
                            <p>En MercadoLibre</p>
                        </div>
                        <div class="stat-card">
                            <h3>📊 Estado DB</h3>
                            <p style="font-size: 2rem; font-weight: bold;">✅</p>
                            <p>MongoDB Atlas</p>
                        </div>
                        <div class="stat-card">
                            <h3>🔗 API</h3>
                            <p style="font-size: 2rem; font-weight: bold;">4</p>
                            <p>Endpoints activos</p>
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin-top: 40px;">
                        <a href="/api/estado" class="btn">📡 Estado del Sistema</a>
                        <a href="/api/productos" class="btn">📦 API Productos</a>
                        <a href="/dashboard" class="btn">🚀 Dashboard Completo</a>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        res.status(500).send(`Error: ${error.message}`);
    }
});

// 2. CALLBACK OAUTH
app.get('/callback', async (req, res) => {
    const { code, error } = req.query;
    
    if (error) {
        return res.send(`
            <html><body style="padding: 40px; font-family: Arial;">
                <h2 style="color: #e53e3e;">❌ Error de autorización</h2>
                <p>${error}</p>
                <a href="/" style="background: #00a650; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Volver al inicio</a>
            </body></html>
        `);
    }
    
    try {
        // Intercambiar código por tokens
        const tokenResponse = await fetch('https://api.mercadolibre.com/oauth/token', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                code: code,
                redirect_uri: REDIRECT_URI
            })
        });
        
        const tokenData = await tokenResponse.json();
        
        if (!tokenData.access_token) {
            throw new Error(`Error obteniendo token: ${JSON.stringify(tokenData)}`);
        }
        
        // Obtener información del usuario
        const userResponse = await fetch('https://api.mercadolibre.com/users/me', {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
        });
        const userData = await userResponse.json();
        
        // Guardar en MongoDB
        const tokenRecord = {
            user_id: userData.id,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: Date.now() + (tokenData.expires_in * 1000),
            nickname: userData.nickname,
            site_id: userData.site_id || 'MLA',
            updated_at: new Date(),
            created_at: new Date()
        };
        
        await db.collection('tokens_ml').updateOne(
            { user_id: userData.id },
            { $set: tokenRecord },
            { upsert: true }
        );
        
        res.send(`
            <html>
            <body style="padding: 40px; font-family: Arial; text-align: center;">
                <h1 style="color: #00a650;">✅ Conexión Exitosa</h1>
                <p>Tu cuenta <strong>${userData.nickname}</strong> se ha conectado correctamente.</p>
                <p>Los tokens se han guardado en la base de datos.</p>
                <a href="/" style="background: #00a650; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px;">
                    Ir al Panel de Control
                </a>
            </body>
            </html>
        `);
        
    } catch (error) {
        console.error('Error en callback:', error);
        res.status(500).send(`Error: ${error.message}`);
    }
});

// 3. FUNCIÓN PARA REFRESCAR TOKEN
async function refreshToken() {
    try {
        const tokens = await db.collection('tokens_ml').findOne({});
        if (!tokens?.refresh_token) return null;
        
        const response = await fetch('https://api.mercadolibre.com/oauth/token', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                refresh_token: tokens.refresh_token
            })
        });
        
        const data = await response.json();
        
        if (data.access_token) {
            const updatedTokens = {
                ...tokens,
                access_token: data.access_token,
                refresh_token: data.refresh_token || tokens.refresh_token,
                expires_at: Date.now() + (data.expires_in * 1000),
                updated_at: new Date()
            };
            
            await db.collection('tokens_ml').updateOne(
                { user_id: tokens.user_id },
                { $set: updatedTokens }
            );
            
            console.log('✅ Token refrescado');
            return updatedTokens;
        }
    } catch (error) {
        console.error('Error refrescando token:', error.message);
    }
    return null;
}

// 4. MIDDLEWARE PARA TOKEN VÁLIDO
async function requireMLToken(req, res, next) {
    try {
        const tokens = await db.collection('tokens_ml').findOne({});
        
        if (!tokens?.access_token) {
            return res.status(401).json({ 
                error: 'NO_CONECTADO', 
                message: 'Primero conecta con MercadoLibre' 
            });
        }
        
        // Refrescar si expira en menos de 10 minutos
        if (tokens.expires_at < Date.now() + 600000) {
            const newTokens = await refreshToken();
            req.mlTokens = newTokens || tokens;
        } else {
            req.mlTokens = tokens;
        }
        
        next();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// ========== API PRODUCTOS ==========

// Crear producto
app.post('/api/productos', async (req, res) => {
    try {
        const { titulo, descripcion, precio, categoria_ml, imagenes, atributos, stock } = req.body;
        
        if (!titulo || !precio) {
            return res.status(400).json({ 
                error: 'DATOS_INCOMPLETOS', 
                message: 'Título y precio son obligatorios' 
            });
        }
        
        const producto = {
            titulo,
            descripcion: descripcion || '',
            precio: parseFloat(precio),
            categoria_ml: categoria_ml || '',
            imagenes: imagenes || [],
            atributos: atributos || [],
            stock: parseInt(stock) || 1,
            estado: 'borrador',
            created_at: new Date(),
            updated_at: new Date()
        };
        
        const result = await db.collection('productos').insertOne(producto);
        const productoInsertado = await db.collection('productos').findOne({ _id: result.insertedId });
        
        res.json({
            success: true,
            message: 'Producto creado',
            producto: productoInsertado
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Listar productos
app.get('/api/productos', async (req, res) => {
    try {
        const productos = await db.collection('productos')
            .find({})
            .sort({ created_at: -1 })
            .toArray();
        
        res.json({
            success: true,
            count: productos.length,
            productos
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener producto por ID
app.get('/api/productos/:id', async (req, res) => {
    try {
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'ID_INVALIDO' });
        }
        
        const producto = await db.collection('productos').findOne({ 
            _id: new ObjectId(req.params.id) 
        });
        
        if (!producto) {
            return res.status(404).json({ error: 'NO_ENCONTRADO' });
        }
        
        res.json({
            success: true,
            producto
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== PUBLICAR EN MERCADOLIBRE ==========
app.post('/api/publicar/:id', requireMLToken, async (req, res) => {
    try {
        const { id } = req.params;
        const tokens = req.mlTokens;
        
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'ID_INVALIDO' });
        }
        
        // Obtener producto
        const producto = await db.collection('productos').findOne({ 
            _id: new ObjectId(id) 
        });
        
        if (!producto) {
            return res.status(404).json({ error: 'PRODUCTO_NO_ENCONTRADO' });
        }
        
        // Preparar datos para ML
        const mlProducto = {
            title: producto.titulo,
            category_id: producto.categoria_ml || 'MLA1051',
            price: producto.precio,
            currency_id: 'ARS',
            available_quantity: producto.stock || 1,
            buying_mode: 'buy_it_now',
            listing_type_id: 'gold_special',
            condition: 'new',
            pictures: producto.imagenes.map(url => ({ source: url })),
            attributes: producto.atributos || []
        };
        
        if (producto.descripcion) {
            mlProducto.description = { plain_text: producto.descripcion };
        }
        
        // Publicar en ML
        const response = await fetch('https://api.mercadolibre.com/items', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(mlProducto)
        });
        
        const mlResponse = await response.json();
        
        // Guardar historial
        await db.collection('publicaciones_ml').insertOne({
            producto_id: new ObjectId(id),
            ml_id: mlResponse.id,
            estado: response.ok ? 'exito' : 'error',
            respuesta: mlResponse,
            created_at: new Date()
        });
        
        if (response.ok) {
            // Actualizar producto local
            await db.collection('productos').updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        ml_id: mlResponse.id,
                        ml_permalink: mlResponse.permalink,
                        estado: 'publicado',
                        updated_at: new Date()
                    }
                }
            );
            
            res.json({
                success: true,
                message: 'Producto publicado en MercadoLibre',
                product_id: mlResponse.id,
                permalink: mlResponse.permalink
            });
        } else {
            await db.collection('productos').updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        estado: 'error',
                        updated_at: new Date()
                    }
                }
            );
            
            res.status(response.status).json({
                success: false,
                error: 'ERROR_PUBLICACION',
                details: mlResponse
            });
        }
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== DASHBOARD COMPLETO ==========
app.get('/dashboard', async (req, res) => {
    try {
        const tokens = await db.collection('tokens_ml').findOne({});
        const productos = await db.collection('productos')
            .find({})
            .sort({ created_at: -1 })
            .limit(50)
            .toArray();
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Dashboard TiendaML</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
            </head>
            <body class="bg-gray-100">
                <div class="container mx-auto px-4 py-8">
                    <div class="flex justify-between items-center mb-8">
                        <h1 class="text-3xl font-bold text-gray-800">
                            <i class="fas fa-store mr-3 text-green-500"></i>Dashboard TiendaML
                        </h1>
                        <div class="flex space-x-4">
                            <a href="/" class="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg">
                                <i class="fas fa-home mr-2"></i>Inicio
                            </a>
                        </div>
                    </div>
                    
                    ${!tokens ? `
                        <div class="bg-yellow-100 border-l-4 border-yellow-500 p-4 mb-6">
                            <p class="text-yellow-700">
                                <i class="fas fa-exclamation-triangle mr-2"></i>
                                No conectado a MercadoLibre. <a href="/" class="underline">Conecta tu cuenta</a>
                            </p>
                        </div>
                    ` : `
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                            <div class="bg-white p-6 rounded-lg shadow">
                                <h3 class="text-lg font-semibold text-gray-700 mb-2">Conexión ML</h3>
                                <p class="text-2xl font-bold text-green-600">✅ Activa</p>
                                <p class="text-gray-600 text-sm mt-2">${tokens.nickname}</p>
                            </div>
                            
                            <div class="bg-white p-6 rounded-lg shadow">
                                <h3 class="text-lg font-semibold text-gray-700 mb-2">Productos</h3>
                                <p class="text-2xl font-bold text-blue-600">${productos.length}</p>
                                <p class="text-gray-600 text-sm mt-2">En catálogo</p>
                            </div>
                            
                            <div class="bg-white p-6 rounded-lg shadow">
                                <h3 class="text-lg font-semibold text-gray-700 mb-2">Publicados</h3>
                                <p class="text-2xl font-bold text-purple-600">
                                    ${productos.filter(p => p.estado === 'publicado').length}
                                </p>
                                <p class="text-gray-600 text-sm mt-2">En MercadoLibre</p>
                            </div>
                            
                            <div class="bg-white p-6 rounded-lg shadow">
                                <h3 class="text-lg font-semibold text-gray-700 mb-2">Base de Datos</h3>
                                <p class="text-2xl font-bold text-orange-600">✅</p>
                                <p class="text-gray-600 text-sm mt-2">MongoDB Atlas</p>
                            </div>
                        </div>
                    `}
                    
                    <!-- Formulario para agregar producto -->
                    <div class="bg-white p-6 rounded-lg shadow mb-8">
                        <h2 class="text-xl font-bold text-gray-800 mb-4">
                            <i class="fas fa-plus-circle mr-2 text-green-500"></i>Agregar Producto
                        </h2>
                        <form id="productForm" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input type="text" name="titulo" placeholder="Título del producto" 
                                   class="border p-3 rounded-lg" required>
                            <input type="number" name="precio" placeholder="Precio (ARS)" step="0.01"
                                   class="border p-3 rounded-lg" required>
                            <textarea name="descripcion" placeholder="Descripción" 
                                      class="border p-3 rounded-lg md:col-span-2" rows="3"></textarea>
                            <input type="text" name="categoria_ml" placeholder="Categoría ML (ej: MLA1051)"
                                   class="border p-3 rounded-lg">
                            <input type="number" name="stock" placeholder="Stock" value="1"
                                   class="border p-3 rounded-lg">
                            <button type="submit" 
                                    class="md:col-span-2 bg-green-500 hover:bg-green-600 text-white p-3 rounded-lg font-semibold">
                                <i class="fas fa-save mr-2"></i>Guardar Producto
                            </button>
                        </form>
                    </div>
                    
                    <!-- Lista de productos -->
                    <div class="bg-white p-6 rounded-lg shadow">
                        <h2 class="text-xl font-bold text-gray-800 mb-4">
                            <i class="fas fa-boxes mr-2 text-blue-500"></i>Tus Productos
                        </h2>
                        <div class="overflow-x-auto">
                            <table class="w-full">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th class="p-3 text-left">Producto</th>
                                        <th class="p-3 text-left">Precio</th>
                                        <th class="p-3 text-left">Estado</th>
                                        <th class="p-3 text-left">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${productos.map(p => `
                                        <tr class="border-b hover:bg-gray-50">
                                            <td class="p-3">
                                                <strong>${p.titulo}</strong><br>
                                                <small class="text-gray-500">${(p.descripcion || '').substring(0, 50)}...</small>
                                            </td>
                                            <td class="p-3">$${p.precio}</td>
                                            <td class="p-3">
                                                <span class="px-2 py-1 rounded-full text-xs 
                                                    ${p.estado === 'publicado' ? 'bg-green-100 text-green-800' : 
                                                      p.estado === 'error' ? 'bg-red-100 text-red-800' : 
                                                      'bg-gray-100 text-gray-800'}">
                                                    ${p.estado}
                                                </span>
                                            </td>
                                            <td class="p-3">
                                                ${p.estado !== 'publicado' && tokens ? `
                                                    <button onclick="publicarProducto('${p._id}')" 
                                                            class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm mr-2">
                                                        <i class="fas fa-upload mr-1"></i>Publicar
                                                    </button>
                                                ` : ''}
                                                ${p.ml_permalink ? `
                                                    <a href="${p.ml_permalink}" target="_blank" 
                                                       class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm">
                                                        <i class="fas fa-external-link-alt mr-1"></i>Ver en ML
                                                    </a>
                                                ` : ''}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <script>
                    document.getElementById('productForm').addEventListener('submit', async (e) => {
                        e.preventDefault();
                        const formData = new FormData(e.target);
                        const producto = Object.fromEntries(formData);
                        producto.precio = parseFloat(producto.precio);
                        producto.stock = parseInt(producto.stock) || 1;
                        
                        try {
                            const res = await fetch('/api/productos', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(producto)
                            });
                            
                            const data = await res.json();
                            if (data.success) {
                                alert('✅ Producto guardado');
                                location.reload();
                            }
                        } catch (error) {
                            alert('❌ Error: ' + error.message);
                        }
                    });
                    
                    async function publicarProducto(productoId) {
                        if (!confirm('¿Publicar este producto en MercadoLibre?')) return;
                        
                        try {
                            const res = await fetch('/api/publicar/' + productoId, {
                                method: 'POST'
                            });
                            
                            const data = await res.json();
                            if (data.success) {
                                alert('✅ Producto publicado en ML!');
                                location.reload();
                            } else {
                                alert('❌ Error: ' + (data.details?.message || 'Error desconocido'));
                            }
                        } catch (error) {
                            alert('❌ Error: ' + error.message);
                        }
                    }
                </script>
            </body>
            </html>
        `);
    } catch (error) {
        res.status(500).send(`Error: ${error.message}`);
    }
});

// ========== ENDPOINTS ADICIONALES ==========

// Estado del sistema
app.get('/api/estado', async (req, res) => {
    try {
        const tokens = await db.collection('tokens_ml').findOne({});
        const productosCount = await db.collection('productos').countDocuments();
        const publicadosCount = await db.collection('productos').countDocuments({ estado: 'publicado' });
        
        res.json({
            sistema: 'TiendaML Backend',
            version: '1.0.0',
            base_datos: 'MongoDB Atlas - Conectado',
            mercadolibre: {
                conectado: !!tokens?.access_token,
                usuario: tokens?.nickname || null,
                expira: tokens?.expires_at ? new Date(tokens.expires_at).toISOString() : null
            },
            productos: {
                total: productosCount,
                publicados: publicadosCount,
                borradores: productosCount - publicadosCount
            },
            servidor: {
                plataforma: 'Vercel',
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Webhook para notificaciones ML
app.post('/api/webhook/ml', async (req, res) => {
    try {
        const notificacion = req.body;
        
        console.log('📢 Webhook ML recibido:', {
            topic: notificacion.topic,
            resource: notificacion.resource
        });
        
        // Guardar en MongoDB
        await db.collection('notificaciones_ml').insertOne({
            topic: notificacion.topic,
            resource: notificacion.resource,
            datos: notificacion,
            procesada: false,
            created_at: new Date()
        });
        
        res.status(200).json({ received: true });
        
    } catch (error) {
        console.error('Error en webhook:', error);
        res.status(500).json({ error: error.message });
    }
});

// Refrescar token manualmente
app.post('/api/refresh-token', async (req, res) => {
    try {
        const newTokens = await refreshToken();
        
        if (newTokens) {
            res.json({
                success: true,
                message: 'Token refrescado',
                expira: new Date(newTokens.expires_at).toLocaleString()
            });
        } else {
            res.status(400).json({
                success: false,
                error: 'No se pudo refrescar'
            });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Desconectar
app.get('/disconnect', async (req, res) => {
    try {
        await db.collection('tokens_ml').deleteMany({});
        res.redirect('/');
    } catch (error) {
        res.status(500).send(`Error: ${error.message}`);
    }
});

// Health check para Vercel
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'tienda-ml-backend'
    });
});

// ========== INICIAR SERVIDOR ==========
app.listen(PORT, () => {
    console.log(`
    🚀 ==============================================
    🚀 TIENDA ML - BACKEND ACTIVO
    🚀 Puerto: ${PORT}
    🚀 ==============================================
    📋 Endpoints principales:
       GET  /              - Dashboard principal
       GET  /dashboard     - Dashboard completo
       GET  /callback      - Callback OAuth ML
       POST /api/productos - Crear producto
       GET  /api/productos - Listar productos
       POST /api/publicar/:id - Publicar en ML
       POST /api/webhook/ml   - Webhook ML
       GET  /api/estado    - Estado del sistema
    🚀 Base de datos: MongoDB Atlas
    🚀 ==============================================
    `);
});

// Export para Vercel
export default app;*/// index.js
import express from 'express';
import cors from 'cors';
import routes from './routes.js';
import { connectDB } from './db.js';


const app = express();
app.use(cors());
app.use(express.json());

await connectDB();

app.use('/', routes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

export default app;
