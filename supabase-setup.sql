-- Supabase SQL Editor'da bu kodu çalıştırın

-- IPS tablosunu oluştur
CREATE TABLE IF NOT EXISTS IPS (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  ip TEXT NOT NULL,
  time TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- İndeks ekle (performans için)
CREATE INDEX IF NOT EXISTS idx_IPS_timestamp ON IPS(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_IPS_id ON IPS(id DESC);

-- Row Level Security (RLS) ayarları
ALTER TABLE IPS ENABLE ROW LEVEL SECURITY;

-- Public okuma izni (herkes görebilir - opsiyonel, güvenlik için kapatılabilir)
CREATE POLICY "Allow public read access" ON IPS
  FOR SELECT
  USING (true);

-- Public yazma izni (herkes ekleyebilir)
CREATE POLICY "Allow public insert access" ON IPS
  FOR INSERT
  WITH CHECK (true);

-- Admin silme izni (opsiyonel)
CREATE POLICY "Allow admin delete access" ON IPS
  FOR DELETE
  USING (true);

-- Tablo yapısını kontrol et
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'IPS';

