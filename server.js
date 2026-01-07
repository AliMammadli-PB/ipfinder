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
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging (development için)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Static dosyalar (public klasörü)
app.use(express.static(path.join(__dirname, 'public')));

// Supabase bağlantısını test et
async function testSupabaseConnection() {
  console.log('\n========================================');
  console.log('🔍 Supabase Bağlantı Kontrolü');
  console.log('========================================');
  
  // Environment variables kontrolü
  console.log(`📋 SUPABASE_URL: ${supabaseUrl ? '✓ AYARLI' : '✗ EKSİK'}`);
  if (supabaseUrl) {
    console.log(`   URL: ${supabaseUrl.substring(0, 30)}...`);
  }
  
  console.log(`📋 ANON_PUBLIC: ${supabaseKey ? '✓ AYARLI' : '✗ EKSİK'}`);
  if (supabaseKey) {
    console.log(`   Key: ${supabaseKey.substring(0, 20)}...`);
  }
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('\n❌ HATA: Supabase environment variables eksik!');
    console.error('   Render.com Dashboard → Environment Variables bölümünden ekleyin:');
    console.error('   - SUPABASE_URL');
    console.error('   - ANON_PUBLIC');
    console.log('========================================\n');
    return;
  }
  
  // Bağlantı testi
  console.log('\n🔄 Supabase bağlantısı test ediliyor...');
  try {
    const { data, error } = await supabase
      .from('ips')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('\n❌ Supabase Bağlantı Hatası!');
      console.error(`   Hata Mesajı: ${error.message}`);
      console.error(`   Hata Kodu: ${error.code || 'N/A'}`);
      console.error(`   Hata Detayı: ${error.details || 'N/A'}`);
      console.error(`   Hata İpucu: ${error.hint || 'N/A'}`);
      console.error('\n💡 Çözüm:');
      console.error('   1. Supabase Dashboard → SQL Editor\'a gidin');
      console.error('   2. supabase-setup.sql dosyasındaki SQL kodunu çalıştırın');
      console.error('   3. Tablo adının "ips" (küçük harf) olduğundan emin olun');
      console.error('   4. RLS (Row Level Security) politikalarını kontrol edin');
    } else {
      console.log('\n✅ Supabase Bağlantısı Başarılı!');
      console.log('   ✓ Tablo erişimi: OK');
      console.log('   ✓ Veritabanı bağlantısı: OK');
      
      // Tablo bilgilerini al
      const { count, error: countError } = await supabase
        .from('ips')
        .select('*', { count: 'exact', head: true });
      
      if (!countError) {
        console.log(`   ✓ Toplam kayıt sayısı: ${count || 0}`);
      }
    }
  } catch (error) {
    console.error('\n❌ Supabase Test Hatası!');
    console.error(`   Hata: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
  }
  
  console.log('========================================\n');
}

// Server başlatıldığında Supabase bağlantısını test et
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

// Health check endpoint (Render.com için)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    supabase: {
      url: supabaseUrl ? 'configured' : 'missing',
      key: supabaseKey ? 'configured' : 'missing'
    }
  });
});

// Test endpoint - API route'larının çalıştığını kontrol et
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API endpoint çalışıyor!',
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path
  });
});

// Admin panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Basit session storage (production'da Redis veya database kullanılmalı)
const activeSessions = new Map();

// Admin authentication middleware
function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  console.log('[/api/records] Auth header:', authHeader ? 'Mevcut' : 'Eksik');
  
  if (!authHeader) {
    console.log('[/api/records] Token bulunamadı');
    return res.status(401).json({ error: 'Yetkisiz erişim - Token gerekli' });
  }
  
  const token = authHeader.replace('Bearer ', '').trim();
  console.log('[/api/records] Token kontrol ediliyor, aktif session sayısı:', activeSessions.size);
  
  if (token && activeSessions.has(token)) {
    console.log('[/api/records] Token geçerli, erişim izni verildi');
    next();
  } else {
    console.log('[/api/records] Token geçersiz veya session bulunamadı');
    res.status(401).json({ error: 'Yetkisiz erişim - Geçersiz token' });
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
      .from('ips')
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
    console.log('\n========================================');
    console.log('📥 [/api/records] İstek Alındı');
    console.log('========================================');
    console.log('   - Timestamp:', new Date().toISOString());
    console.log('   - IP:', req.ip || req.connection.remoteAddress);
    console.log('   - User-Agent:', req.headers['user-agent']);
    
    console.log('\n🔍 Supabase Sorgusu Başlatılıyor...');
    console.log('   - Tablo: ips');
    console.log('   - Sıralama: id DESC');
    
    const queryStartTime = Date.now();
    
    // Supabase'den kayıtları al
    const { data, error, count } = await supabase
      .from('ips')
      .select('*', { count: 'exact' })
      .order('id', { ascending: false });

    const queryEndTime = Date.now();
    const queryDuration = queryEndTime - queryStartTime;

    if (error) {
      console.error('\n❌ [/api/records] Supabase Okuma Hatası!');
      console.error('   - Hata Mesajı:', error.message);
      console.error('   - Hata Kodu:', error.code || 'N/A');
      console.error('   - Hata Detayı:', error.details || 'N/A');
      console.error('   - Hata İpucu:', error.hint || 'N/A');
      console.error('   - Tam Hata Objesi:', JSON.stringify(error, null, 2));
      console.log('========================================\n');
      
      return res.status(500).json({ 
        error: 'Veri okuma hatası: ' + error.message,
        details: error 
      });
    }
    
    console.log('\n✅ Supabase Sorgusu Başarılı!');
    console.log('   - Sorgu Süresi:', queryDuration + 'ms');
    console.log('   - Toplam Kayıt (count):', count);
    console.log('   - Dönen Kayıt Sayısı:', data ? data.length : 0);
    
    if (data && data.length > 0) {
      console.log('\n📋 Kayıt Detayları:');
      data.forEach((record, index) => {
        console.log(`   ${index + 1}. ID: ${record.id}, Name: ${record.name}, IP: ${record.ip}, Time: ${record.time}`);
      });
    } else {
      console.log('   ⚠️ Hiç kayıt bulunamadı');
    }
    
    // Supabase'den gelen verileri formatla
    const formattedData = (data || []).map(record => ({
      id: record.id,
      name: record.name,
      ip: record.ip,
      time: record.time,
      timestamp: record.timestamp
    }));
    
    console.log('\n📤 Yanıt Hazırlanıyor...');
    console.log('   - Formatlanmış Kayıt Sayısı:', formattedData.length);
    console.log('========================================\n');
    
    res.json(formattedData);
  } catch (error) {
    console.error('\n❌ [/api/records] Genel Hata!');
    console.error('   - Hata Mesajı:', error.message);
    console.error('   - Hata Tipi:', error.name);
    console.error('   - Stack Trace:', error.stack);
    console.error('   - Tam Hata Objesi:', error);
    console.log('========================================\n');
    
    res.status(500).json({ 
      error: 'Veri okuma hatası',
      message: error.message 
    });
  }
});

// Render.com ve Vercel için export, local için listen
// Render.com PORT environment variable'ını otomatik set eder
if (process.env.VERCEL) {
  module.exports = app;
} else {
  // Render.com veya local development
  app.listen(PORT, '0.0.0.0', () => {
    console.log('\n========================================');
    console.log('🚀 Server Başlatıldı!');
    console.log('========================================');
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`🌐 Public URL: https://nickname-64fw.onrender.com`);
    console.log('========================================\n');
  });
}

