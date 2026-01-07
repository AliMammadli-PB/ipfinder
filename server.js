require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase client oluştur
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.ANON_PUBLIC;

if (!supabaseUrl || !supabaseKey) {
  console.error('HATA: SUPABASE_URL ve ANON_PUBLIC environment variable\'ları gerekli!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Supabase bağlantısını test et
async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase
      .from('IPS')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('Supabase bağlantı hatası:', error.message);
      console.error('Lütfen supabase-setup.sql dosyasındaki SQL kodunu Supabase SQL Editor\'da çalıştırın!');
    } else {
      console.log('✓ Supabase bağlantısı başarılı!');
    }
  } catch (error) {
    console.error('Supabase test hatası:', error);
  }
}

testSupabaseConnection();

// Azerbaycan saati (UTC+4)
function getAzerbaijanTime() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const azerbaijanTime = new Date(utc + (4 * 3600000)); // UTC+4
  return azerbaijanTime.toISOString().replace('T', ' ').substring(0, 19);
}

// Kullanıcı IP'sini al
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.headers['x-real-ip'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         'Bilinmiyor';
}

// Ana sayfa
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Admin panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Basit session storage (production'da Redis veya database kullanılmalı)
const activeSessions = new Map();

// Admin authentication middleware
function requireAdminAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (token && activeSessions.has(token)) {
    next();
  } else {
    res.status(401).json({ error: 'Yetkisiz erişim' });
  }
}

// Admin login endpoint
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'canurek3';
  
  if (username === adminUsername && password === adminPassword) {
    // Basit token oluştur
    const token = Buffer.from(`${adminUsername}:${Date.now()}:${Math.random()}`).toString('base64');
    activeSessions.set(token, { username: adminUsername, loginTime: Date.now() });
    
    // 24 saat sonra token'ı sil
    setTimeout(() => {
      activeSessions.delete(token);
    }, 24 * 60 * 60 * 1000);
    
    res.json({ success: true, token: token });
  } else {
    res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
  }
});

// İsim kaydetme endpoint
app.post('/api/submit', async (req, res) => {
  const { name, publicIP } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'İsim gereklidir' });
  }

  // Frontend'den gelen public IP'yi kullan, yoksa fallback olarak request IP'sini al
  const ip = publicIP || getClientIP(req);
  const azerbaijanTime = getAzerbaijanTime();
  const timestamp = new Date().toISOString();

  try {
    // Supabase'e kaydet
    const { data, error } = await supabase
      .from('IPS')
      .insert([
        {
          name: name.trim(),
          ip: ip,
          time: azerbaijanTime,
          timestamp: timestamp
        }
      ])
      .select();

    if (error) {
      console.error('Supabase kayıt hatası:', error);
      return res.status(500).json({ error: 'Kayıt sırasında hata oluştu: ' + error.message });
    }

    res.json({ success: true, message: 'Kayıt başarıyla eklendi', data: data[0] });
  } catch (error) {
    console.error('Veri yazma hatası:', error);
    res.status(500).json({ error: 'Kayıt sırasında hata oluştu' });
  }
});

// Tüm kayıtları getir (admin panel için) - Korumalı
app.get('/api/records', requireAdminAuth, async (req, res) => {
  try {
    // Supabase'den kayıtları al
    const { data, error } = await supabase
      .from('IPS')
      .select('*')
      .order('id', { ascending: false });

    if (error) {
      console.error('Supabase okuma hatası:', error);
      return res.status(500).json({ error: 'Veri okuma hatası: ' + error.message });
    }
    
    // Supabase'den gelen verileri formatla
    const formattedData = data.map(record => ({
      id: record.id,
      name: record.name,
      ip: record.ip,
      time: record.time,
      timestamp: record.timestamp
    }));
    
    res.json(formattedData || []);
  } catch (error) {
    console.error('Veri okuma hatası:', error);
    res.status(500).json({ error: 'Veri okuma hatası' });
  }
});

// Vercel için export, local için listen
if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(PORT, () => {
    console.log(`Server çalışıyor: http://localhost:${PORT}`);
  });
}

