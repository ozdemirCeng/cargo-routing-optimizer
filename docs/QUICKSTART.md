# 🚀 Hızlı Başlangıç Rehberi

Bu rehber, projeyi adım adım çalıştırmanız için gereken tüm komutları içerir.

## Ön Koşullar

1. **Docker Desktop** yüklü olmalı
2. **Node.js 18+** yüklü olmalı
3. **Python 3.11+** yüklü olmalı

## Adım 1: Docker Servisleri

```powershell
# Proje klasörüne gidin
cd d:\kargo

# Docker servislerini başlatın
docker-compose up -d

# Servislerin durumunu kontrol edin
docker-compose ps
```

## Adım 2: OSRM Verileri (İlk Kurulum)

OSRM için Türkiye harita verisini indirmeniz gerekiyor:

```powershell
# osrm-data klasörü oluşturun
mkdir osrm-data

# Türkiye OSM verisini indirin (alternatif: Kocaeli bölgesi)
# https://download.geofabrik.de/europe/turkey-latest.osm.pbf

# OSRM için işleyin (Docker içinde)
docker run -t -v ${PWD}/osrm-data:/data osrm/osrm-backend osrm-extract -p /opt/car.lua /data/turkey-latest.osm.pbf
docker run -t -v ${PWD}/osrm-data:/data osrm/osrm-backend osrm-partition /data/turkey-latest.osrm
docker run -t -v ${PWD}/osrm-data:/data osrm/osrm-backend osrm-customize /data/turkey-latest.osrm

# OSRM sunucusunu başlatın (varsayılan: 5001)
docker run -d --name kargo-osrm -p 5001:5000 -v ${PWD}/osrm-data:/data osrm/osrm-backend osrm-routed --algorithm mld /data/turkey-latest.osrm
```

## Adım 3: API Başlatma (Yerel Geliştirme)

```powershell
cd apps/api

# Bağımlılıkları yükleyin
npm install

# Prisma client oluşturun
npx prisma generate

# Veritabanını senkronize edin
npx prisma db push

# Geliştirme sunucusunu başlatın
npm run start:dev
```

API http://localhost:3001 adresinde çalışacak.
Swagger: http://localhost:3001/api/docs

## Adım 4: Optimizer Başlatma (Yerel Geliştirme)

```powershell
cd apps/optimizer

# Sanal ortam oluşturun
python -m venv venv

# Aktifleştirin
.\venv\Scripts\Activate

# Bağımlılıkları yükleyin
pip install -r requirements.txt

# Sunucuyu başlatın
uvicorn main:app --reload --port 5000
```

Optimizer http://localhost:5000 adresinde çalışacak.

## Adım 5: Web Uygulaması (Yerel Geliştirme)

```powershell
cd apps/web

# Bağımlılıkları yükleyin
npm install

# Geliştirme sunucusunu başlatın
npm run dev
```

Web http://localhost:3000 adresinde çalışacak.

## 🧪 Test Senaryoları

### Senaryo 1'i Test Etme

1. Admin olarak giriş yapın: `admin@kargo.local` / `admin123`
2. Sol menüden "Planlar" seçin
3. "Yeni Plan" butonuna tıklayın
4. Senaryo 1'i seçin
5. "Optimize Et" butonuna tıklayın
6. Sonuçları haritada görüntüleyin

### Kargo Oluşturma (User)

1. User olarak giriş yapın: `user@kargo.local` / `user123`
2. "Yeni Kargo" butonuna tıklayın
3. İlçe ve ağırlık seçin
4. Kargoyu takip edin

## 🔍 Sorun Giderme

### PostgreSQL bağlantı hatası

```powershell
# Container'ı yeniden başlatın
docker-compose restart postgres
```

### OSRM 404 hatası

OSRM verileri doğru işlenmemiş olabilir. osrm-data klasörünü kontrol edin.

### Port çakışması

```powershell
# 3000, 3001 veya 5000 portlarını kullanan işlemleri bulun
netstat -ano | findstr :3000
```

## 📊 Performans İpuçları

1. **İlk çalıştırmada** OSRM verisi yüklenmesi zaman alabilir
2. **Distance matrix** önbelleklenir, ilk optimizasyon yavaş olabilir
3. **Büyük senaryolarda** (100+ kargo) optimizasyon 30-60 saniye sürebilir

## 🔐 Güvenlik Notları

- JWT token süresi: 7 gün
- Şifreler bcrypt ile hashlenir
- CORS sadece localhost için açık

---

Sorularınız için: [GitHub Issues]
