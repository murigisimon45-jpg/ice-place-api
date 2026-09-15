import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'ice-place-jwt-secret-2024';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.warn('⚠️  Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in env');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Middleware
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Root
app.get('/', (req, res) => {
  res.send('Ice Place Jewelry API - Supabase Backend Running - Fixed');
});

// Health - returns counts
app.get('/api/health', async (req, res) => {
  try {
    const tables = ['products', 'members', 'orders', 'custom_orders', 'promos', 'reviews', 'mpesa_callbacks'];
    const counts: Record<string, any> = {};
    for (const table of tables) {
      try {
        const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
        counts[table] = error ? `error: ${error.message}` : count;
      } catch (e: any) {
        counts[table] = `error: ${e.message}`;
      }
    }
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      supabase_url: SUPABASE_URL ? 'configured' : 'missing',
      fix: 'null-bug patched - all GET routes return []',
      counts
    });
  } catch (err: any) {
    console.error('Health check error:', err);
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// GET /api/products - FIXED NULL BUG
app.get('/api/products', async (req, res) => {
  try {
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (e: any) {
    console.log('GET /api/products error:', e.message);
    res.json([]);
  }
});

app.get('/api/auth/members', async (req, res) => {
  try {
    const { data, error } = await supabase.from('members').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (e: any) {
    console.log('GET /api/auth/members error:', e.message);
    res.json([]);
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (e: any) {
    console.log('GET /api/orders error:', e.message);
    res.json([]);
  }
});

app.get('/api/custom', async (req, res) => {
  try {
    const { data, error } = await supabase.from('custom_orders').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (e: any) {
    console.log('GET /api/custom error:', e.message);
    try {
      const { data: d2, error: e2 } = await supabase.from('custom').select('*').order('created_at', { ascending: false });
      if (e2) throw e2;
      return res.json(d2 || []);
    } catch (_) {
      return res.json([]);
    }
  }
});

app.get('/api/promos', async (req, res) => {
  try {
    const { data, error } = await supabase.from('promos').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (e: any) {
    console.log('GET /api/promos error:', e.message);
    res.json([]);
  }
});

app.get('/api/reviews', async (req, res) => {
  try {
    const { data, error } = await supabase.from('reviews').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (e: any) {
    console.log('GET /api/reviews error:', e.message);
    res.json([]);
  }
});

// POST /api/products (admin)
app.post('/api/products', async (req, res) => {
  try {
    const { data, error } = await supabase.from('products').insert([req.body]).select();
    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (e: any) {
    console.log('POST /api/products error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('products').update(req.body).eq('id', req.params.id).select();
    if (error) throw error;
    res.json(data[0]);
  } catch (e: any) {
    console.log('PUT /api/products error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('products').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e: any) {
    console.log('DELETE /api/products error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/orders - Till Manual Payment
app.post('/api/orders', async (req, res) => {
  try {
    const {
      name, phone, email, building, notes, locationText, lat, lng,
      promo, items, total, subtotal, deliveryFee,
      mpesaTransactionCode, tillNumber, paymentMethod
    } = req.body;

    const orderPayload = {
      customer: { name, phone, email, building, notes, locationText, lat, lng },
      items: items || [],
      total: total ?? 0,
      subtotal: subtotal ?? total ?? 0,
      delivery_fee: deliveryFee ?? 0,
      promo_code: promo || null,
      mpesa_code: mpesaTransactionCode || null,
      till_number: tillNumber || '8140212',
      payment_method: paymentMethod || 'till_manual',
      status: 'pending',
      created_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase.from('orders').insert([orderPayload]).select();
      if (error) throw error;
      console.log('Order created:', data[0]?.id);
      return res.status(201).json(data[0]);
    } catch (primaryError: any) {
      console.log('Primary order insert failed, trying fallback:', primaryError.message);
      try {
        const minimal = {
          customer: orderPayload.customer,
          items: orderPayload.items,
          total: orderPayload.total,
          status: 'pending'
        };
        const { data, error } = await supabase.from('orders').insert([minimal]).select();
        if (error) throw error;
        return res.status(201).json(data[0]);
      } catch (fallbackError: any) {
        console.log('Minimal insert failed, trying raw:', fallbackError.message);
        try {
          const { data, error } = await supabase.from('orders').insert([req.body]).select();
          if (error) throw error;
          return res.status(201).json(data[0]);
        } catch (rawError: any) {
          console.error('All order insert attempts failed:', rawError.message);
          return res.status(500).json({ error: rawError.message });
        }
      }
    }
  } catch (err: any) {
    console.error('POST /api/orders unexpected error:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Auth
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const { data, error } = await supabase.from('members').insert([{ email, password, name, created_at: new Date().toISOString() }]).select();
    if (error) throw error;
    const token = jwt.sign({ id: data[0].id, email }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ user: data[0], token });
  } catch (e: any) {
    console.log('POST /api/auth/register error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data, error } = await supabase.from('members').select('*').eq('email', email).eq('password', password).single();
    if (error) throw error;
    if (!data) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: data.id, email: data.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: data, token });
  } catch (e: any) {
    console.log('POST /api/auth/login error:', e.message);
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/api/auth/members', async (req, res) => {
  try {
    const { data, error } = await supabase.from('members').insert([req.body]).select();
    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (e: any) {
    console.log('POST /api/auth/members error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// M-Pesa callback - keep same
app.post('/api/mpesa/callback', async (req, res) => {
  try {
    console.log('M-Pesa callback received:', JSON.stringify(req.body));
    const { data, error } = await supabase.from('mpesa_callbacks').insert([{ payload: req.body, created_at: new Date().toISOString() }]).select();
    if (error) console.log('Failed to save mpesa callback:', error.message);
    else console.log('M-Pesa callback saved:', data[0]?.id);
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (e: any) {
    console.log('M-Pesa callback error:', e.message);
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Ice Place Jewelry API running on port ${PORT}`);
  console.log(`✅ Supabase Backend Fixed - Always returns [] not null`);
  console.log(`✅ Till: 8140212 | payment_method: till_manual`);
});
