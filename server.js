
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import axios from 'axios';
dotenv.config();
const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Helper auth middleware
function protect(req,res,next){
  const token = req.headers.authorization?.split(' ')[1];
  if(!token) return res.status(401).json({msg:'No token'});
  try{ req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch{ res.status(401).json({msg:'Invalid token'}); }
}
function adminOnly(req,res,next){
  if(!req.user.isAdmin) return res.status(403).json({msg:'Admin only'});
  next();
}

// AUTH - Register creates IPJ- code
app.post('/api/auth/register', async (req,res)=>{
  const { name,email,phone,password } = req.body;
  const hashed = await bcrypt.hash(password,10);
  const code = 'IPJ-'+Math.floor(1000+Math.random()*9000);
  const { data, error } = await supabase.from('users').insert({ name,email,phone,password:hashed,member_code:code,is_admin:false }).select().single();
  if(error) return res.status(400).json({msg:error.message});
  const token = jwt.sign({ id:data.id, isAdmin:false }, process.env.JWT_SECRET);
  res.json({ token, user: { id:data.id, name,email,memberCode:code,isAdmin:false } });
});

app.post('/api/auth/login', async (req,res)=>{
  const { email,password } = req.body;
  const { data:user } = await supabase.from('users').select('*').eq('email',email).single();
  if(!user || !await bcrypt.compare(password,user.password)) return res.status(400).json({msg:'Invalid credentials'});
  const token = jwt.sign({ id:user.id, isAdmin:user.is_admin }, process.env.JWT_SECRET);
  res.json({ token, user: { id:user.id, name:user.name,email,memberCode:user.member_code,isAdmin:user.is_admin } });
});

app.get('/api/auth/members', async (req,res)=>{
  const { data } = await supabase.from('users').select('*').eq('is_admin',false).order('created_at',{ascending:false});
  res.json(data);
});

// PRODUCTS
app.get('/api/products', async (req,res)=>{
  const { data } = await supabase.from('products').select('*').order('created_at',{ascending:false});
  res.json(data);
});
app.post('/api/products', protect, adminOnly, async (req,res)=>{
  const { data } = await supabase.from('products').insert(req.body).select().single();
  res.json(data);
});
app.put('/api/products/:id', protect, adminOnly, async (req,res)=>{
  const { data } = await supabase.from('products').update(req.body).eq('id',req.params.id).select().single();
  res.json(data);
});
app.delete('/api/products/:id', protect, adminOnly, async (req,res)=>{
  await supabase.from('products').delete().eq('id',req.params.id);
  res.json({msg:'Deleted'});
});

// ORDERS - purchases
app.post('/api/orders', async (req,res)=>{
  const { data } = await supabase.from('orders').insert(req.body).select().single();
  res.json(data);
});
app.get('/api/orders', protect, adminOnly, async (req,res)=>{
  const { data } = await supabase.from('orders').select('*').order('created_at',{ascending:false});
  res.json(data);
});
app.put('/api/orders/:id/status', protect, adminOnly, async (req,res)=>{
  const { data } = await supabase.from('orders').update({ status:req.body.status }).eq('id',req.params.id).select().single();
  res.json(data);
});

// CUSTOM REQUESTS - members only with image
app.post('/api/custom', protect, async (req,res)=>{
  const { data } = await supabase.from('custom_requests').insert({ ...req.body, user_id:req.user.id }).select().single();
  res.json(data);
});
app.get('/api/custom', protect, adminOnly, async (req,res)=>{
  const { data } = await supabase.from('custom_requests').select('*, users(name,email,member_code)').order('created_at',{ascending:false});
  res.json(data);
});

// PROMOS
app.get('/api/promos', async (req,res)=>{
  const { data } = await supabase.from('promos').select('*');
  res.json(data);
});
app.post('/api/promos', protect, adminOnly, async (req,res)=>{
  const { data } = await supabase.from('promos').insert(req.body).select().single();
  res.json(data);
});
app.post('/api/promos/validate', async (req,res)=>{
  const { data } = await supabase.from('promos').select('*').eq('code',req.body.code).single();
  if(!data) return res.status(404).json({msg:'Invalid'});
  res.json(data);
});

// REVIEWS
app.get('/api/reviews', async (req,res)=>{
  const { data } = await supabase.from('reviews').select('*').order('created_at',{ascending:false});
  res.json(data||[]);
});
app.post('/api/reviews', async (req,res)=>{
  const { data } = await supabase.from('reviews').insert(req.body).select().single();
  res.json(data);
});

// M-PESA DARAJA - same as before
async function getAccessToken(){
  const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
  const { data } = await axios.get('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', { headers: { Authorization: `Basic ${auth}` } });
  return data.access_token;
}
app.post('/api/mpesa/stkpush', async (req,res)=>{
  try{
    const token = await getAccessToken();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g,'').slice(0,14);
    const password = Buffer.from(process.env.MPESA_SHORTCODE + process.env.MPESA_PASSKEY + timestamp).toString('base64');
    const payload = {
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: req.body.amount,
      PartyA: req.body.phone,
      PartyB: process.env.MPESA_SHORTCODE,
      PhoneNumber: req.body.phone,
      CallBackURL: process.env.MPESA_CALLBACK_URL,
      AccountReference: 'IcePlace',
      TransactionDesc: 'Jewelry Purchase'
    };
    const { data } = await axios.post('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', payload, { headers: { Authorization: `Bearer ${token}` } });
    res.json(data);
  }catch(e){ res.status(500).json({ error: e.response?.data || e.message }); }
});
app.post('/api/mpesa/callback', (req,res)=>{
  console.log('M-PESA CALLBACK', JSON.stringify(req.body));
  res.json({ ResultCode:0, ResultDesc:'Accepted' });
});

app.get('/', (req,res)=>res.send('Ice Place Jewelry API - Supabase Backend Running'));

app.listen(process.env.PORT||10000, ()=>console.log('Running on', process.env.PORT));
