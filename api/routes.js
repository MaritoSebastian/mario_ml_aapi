// routes.js
import express from 'express';
import fetch from 'node-fetch';
import { getDB } from './db.js';

const router = express.Router();

/* =========================
   OAUTH MERCADOLIBRE
========================= */

// Redirige a ML
router.get('/auth/ml', (req, res) => {
  const url = `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${process.env.CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}`;
  res.redirect(url);
});

// Callback
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'NO_CODE' });

  try {
    const tokenRes = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        code,
        redirect_uri: process.env.REDIRECT_URI,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('Token inválido');

    const userRes = await fetch('https://api.mercadolibre.com/users/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const user = await userRes.json();

    const db = getDB();
    await db.collection('tokens_ml').updateOne(
      { user_id: user.id },
      {
        $set: {
          user_id: user.id,
          nickname: user.nickname,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: Date.now() + tokenData.expires_in * 1000,
          updated_at: new Date(),
        },
      },
      { upsert: true }
    );

    res.json({ success: true, user: user.nickname });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* =========================
   ESTADO ML
========================= */

router.get('/api/ml/status', async (req, res) => {
  const db = getDB();
  const token = await db.collection('tokens_ml').findOne({});
  res.json({
    conectado: !!token,
    usuario: token?.nickname || null,
    expira: token?.expires_at || null,
  });
});

/* =========================
   PUBLICAR PRODUCTO (PRUEBA)
========================= */

router.post('/api/ml/item', async (req, res) => {
  const db = getDB();
  const token = await db.collection('tokens_ml').findOne({});

  if (!token) {
    return res.status(401).json({ error: 'NO_CONECTADO_ML' });
  }

  const producto = {
    title: req.body.title,
    price: req.body.price,
    category_id: req.body.category_id || 'MLA1051',
    currency_id: 'ARS',
    available_quantity: 1,
    buying_mode: 'buy_it_now',
    listing_type_id: 'gold_special',
    condition: 'new',
    pictures: [{ source: req.body.image }],
  };

  try {
    const mlRes = await fetch('https://api.mercadolibre.com/items', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(producto),
    });

    const data = await mlRes.json();
    res.status(mlRes.status).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
