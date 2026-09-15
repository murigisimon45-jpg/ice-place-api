
const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Simple in-memory store if Supabase not configured yet
let products = [
  {id:'p1', name:'Frost Link Cuban Chain', price:4500, category:'Necklaces', stock:12, images:['https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=800'], description:'22 VVS Cuban', featured:true},
  {id:'p2', name:'North Star Tennis Bracelet', price:3200, category:'Bracelets', stock:3, images:['https://images.unsplash.com/photo-1611591437281-460bfbe1220a?q=80&w=800'], description:'4mm icy tennis'},
  {id:'p3', name:'Royal Crown Signet Ring', price:2800, category:'Rings', stock:10, images:['https://images.unsplash.com/photo-1605100804763-247f67b3557e?q=80&w=800'], description:'Crown crest'},
  {id:'p4', name:'Glacier Hoop Earrings', price:1800, category:'Accessories', stock:20, images:['https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?q=80&w=800'], description:'25mm hoops'},
  {id:'p5', name:'ICE PLACE Hoodie - Arctic White', price:3500, category:'Merch', stock:15, images:['https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=800'], description:'400GSM hoodie', featured:true},
  {id:'p6', name:'Midnight Onyx Pendant', price:5200, category:'Necklaces', stock:7, images:['https://images.unsplash.com/photo-1601821765780-754fa98637c1?q=80&w=800'], description:'Onyx bezel'},
  {id:'p7', name:'Ice Cap Snapback', price:1500, category:'Merch', stock:25, images:['https://images.unsplash.com/photo-1588850561407-ed78c282e89b?q=80&w=800'], description:'3D puff cap'},
  {id:'p8', name:'Icy Cross Anklet', price:1200, category:'Accessories', stock:2, images:['https://images.unsplash.com/photo-1611652022419-a9419f74343d?q=80&w=800'], description:'Dainty cross'}
];
let members = [];
let orders = [];
let custom = [];
let promos = [{code:'ICE10', discount:10, expiry:'2026-12-31', limit:100, used:12}];
let reviews = [{id:'r1', name:'Brian M.', stars:5, comment:'The cuban is insane!', date:'2025-11-20'}];

const OWNER_PHONE = '+254706802440';
const OWNER_EMAIL = 'murigisimon45@gmail.com';
const OWNER_KEY = 'IPJ-OWNER-254706802440';

// Try Supabase if env exists
let supabase = null;
try{
  const { createClient } = require('@supabase/supabase-js');
  if(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY){
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    console.log('Supabase connected');
  }
}catch(e){ console.log('Supabase not configured, using memory:', e.message); }

app.get('/', (req,res)=>res.send('Ice Place API Running - CommonJS Fixed - v3'));
app.get('/api/health', (req,res)=>res.json({status:'ok', products:products.length, supabase: !!supabase, time:new Date().toISOString()}));

// PRODUCTS - ALWAYS RETURNS ARRAY NEVER NULL
app.get('/api/products', async (req,res)=>{
  try{
    if(supabase){
      const {data, error} = await supabase.from('products').select('*').order('created_at',{ascending:false});
      if(!error && data && data.length>0) return res.json(data);
    }
  }catch(e){ console.log('supabase products fail', e.message); }
  res.json(products);
});
app.post('/api/products', (req,res)=>{ const p={id:Date.now().toString(), ...req.body}; products.unshift(p); res.json(p); });
app.put('/api/products/:id', (req,res)=>{ const idx=products.findIndex(x=>x.id===req.params.id); if(idx>=0){ products[idx]={...products[idx], ...req.body}; res.json(products[idx]); } else res.json(req.body); });
app.delete('/api/products/:id', (req,res)=>{ products=products.filter(x=>x.id!==req.params.id); res.json({msg:'Deleted'}); });

// MEMBERS
app.get('/api/auth/members', async (req,res)=>{
  try{
    if(supabase){
      const {data} = await supabase.from('users').select('*').eq('is_admin',false).order('created_at',{ascending:false});
      if(data) return res.json(data.map(u=>({id:u.id, code:u.member_code, name:u.name, email:u.email, phone:u.phone, joined:(u.created_at||'').slice(0,10), inbox:[]})));
    }
  }catch{}
  res.json(members);
});
app.post('/api/auth/register', (req,res)=>{
  const {name,email,phone} = req.body;
  const code='IPJ-'+Math.floor(1000+Math.random()*9000);
  const m={id:Date.now().toString(), code, name, email, phone, joined:new Date().toISOString().slice(0,10), inbox:[]};
  members.unshift(m);
  res.json({token:'demo_token_'+m.id, user:m, member:m, code});
});
app.post('/api/auth/login', (req,res)=>{
  const {email}=req.body;
  const found=members.find(x=>x.email===email);
  if(found) return res.json({token:'demo_token_'+found.id, user:found});
  res.status(400).json({msg:'User not found'});
});
app.post('/api/auth/admin-unlock', (req,res)=>{
  const {credential, apiKey, password} = req.body;
  const cred=(credential||'').toString().toLowerCase();
  const ok = (cred.includes('706802440') || cred===OWNER_EMAIL.toLowerCase()) && apiKey===OWNER_KEY;
  if(ok) return res.json({verified:true, token:'admin_demo_token'});
  res.status(401).json({msg:'Access Denied'});
});

// ORDERS - TILL 8140212
app.post('/api/orders', (req,res)=>{
  const order={id:Date.now().toString(), ...req.body, till_number:'8140212', payment_method:'till_manual', status:'pending', date:new Date().toISOString()};
  orders.unshift(order);
  console.log('New order Till 8140212:', order.id, order.mpesaTransactionCode||order.mpesa_code);
  res.json(order);
});
app.get('/api/orders', (req,res)=>res.json(orders));

// OTHER
app.get('/api/custom', (req,res)=>res.json(custom));
app.post('/api/custom', (req,res)=>{ const c={id:Date.now().toString(), ...req.body}; custom.unshift(c); res.json(c); });
app.get('/api/promos', (req,res)=>res.json(promos));
app.post('/api/promos', (req,res)=>{ const p=req.body; promos.unshift(p); res.json(p); });
app.delete('/api/promos/:code', (req,res)=>{ promos=promos.filter(x=>x.code!==req.params.code); res.json({msg:'deleted'}); });
app.get('/api/reviews', (req,res)=>res.json(reviews));
app.post('/api/reviews', (req,res)=>{ const r={id:Date.now().toString(), ...req.body}; reviews.unshift(r); res.json(r); });

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=>console.log('Ice Place API v3 CommonJS running on', PORT));
