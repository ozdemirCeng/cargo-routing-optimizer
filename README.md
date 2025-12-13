# 🚚 Kargo İşletme Sistemi

Kocaeli Üniversitesi için geliştirilmiş, gerçek dünya kargo dağıtım optimizasyonu yapan kapsamlı bir lojistik yönetim sistemi.

## 📋 Proje Özeti

Bu proje, Kocaeli ili içindeki 12 ilçeye kargo dağıtımı yapan bir sistemi simüle eder. Vehicle Routing Problem (VRP) için heuristic algoritmalar kullanarak optimal rotalar oluşturur.

### Özellikler

- ✅ Admin ve User panelleri (RBAC)
- ✅ VRP optimizasyonu (Greedy + 2-Opt)
- ✅ Gerçek yol mesafeleri (OSRM - kuş uçuşu değil!)
- ✅ MapLibre ile harita görüntüleme
- ✅ Real-time sefer takibi
- ✅ Yapılandırılabilir parametreler
- ✅ 4 farklı senaryo desteği

## 🏗️ Teknoloji Stack

| Katman | Teknoloji |
|--------|-----------|
| **Web UI** | Next.js 14, React 18, MUI, MapLibre GL |
| **API** | NestJS, Prisma, PostgreSQL |
| **Optimizer** | Python, FastAPI, NumPy |
| **Routing** | OSRM (Self-hosted) |
| **Container** | Docker, Docker Compose |

## 🚀 Hızlı Başlangıç

### Gereksinimler

- Docker Desktop
- Node.js 18+ (yerel geliştirme için)
- Python 3.11+ (yerel geliştirme için)

### Docker ile Çalıştırma

```bash
# Projeyi klonlayın
cd d:\kargo

# Supabase bağlantılarını apps/api/.env içine koyun
# (apps/api/.env.example -> apps/api/.env)
# DATABASE_URL, DIRECT_URL, JWT_SECRET zorunlu

# Sonra servisleri başlatın
docker compose up -d

# Logları izleyin
docker compose logs -f
```

OSRM için Türkiye verisini indirip OSRM datasını üretme adımları:
- [docs/OSRM.md](docs/OSRM.md)

### Servis URL'leri

| Servis | URL | Açıklama |
|--------|-----|----------|
| Web UI | http://localhost:3000 | Next.js Frontend |
| API | http://localhost:3001/api | NestJS Backend (base path) |
| API Docs | http://localhost:3001/api/docs | Swagger UI |
| Optimizer | http://localhost:5000 | Python VRP Solver |
| Health | http://localhost:3001/api/health | Liveness |
| Ready | http://localhost:3001/api/health/ready | Readiness (DB) |

### Varsayılan Kullanıcılar

| Email | Şifre | Rol |
|-------|-------|-----|
| admin@kargo.local | admin123 | Admin |
| user@kargo.local | user123 | User |

## 📁 Proje Yapısı

```
kargo/
├── docker-compose.yml          # Tüm servisler
├── database/
│   ├── init.sql               # Veritabanı şeması
│   └── seed.sql               # Başlangıç verileri
├── docs/
│   ├── api-specification.yaml # OpenAPI 3.0 spec
│   └── optimizer-contract.yaml # Optimizer I/O spec
├── apps/
│   ├── api/                   # NestJS API
│   │   ├── src/
│   │   │   ├── modules/       # Auth, Users, Stations, vb.
│   │   │   └── main.ts
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── package.json
│   ├── optimizer/             # Python VRP Solver
│   │   ├── main.py
│   │   ├── solver.py
│   │   └── requirements.txt
│   └── web/                   # Next.js Frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── admin/     # Admin sayfaları
│       │   │   ├── user/      # User sayfaları
│       │   │   └── login/
│       │   ├── components/
│       │   └── lib/
│       └── package.json
└── README.md
```

## 🎯 Senaryolar

Sistem 4 farklı senaryo ile test edilebilir:

### Senaryo 1: Az Kargo, Homojen Dağılım
- 12 ilçeye eşit dağılımlı kargo
- Toplam ~850 kg

### Senaryo 2: Çok Kargo, Heterojen Dağılım
- Bazı ilçelerde yoğunluk fazla
- Toplam ~3200 kg

### Senaryo 3: Yoğun Merkez, Uzak Hafif
- Merkeze yakın ilçelerde yoğun kargo
- Uzak ilçelerde az kargo

### Senaryo 4: Karma Senaryo
- Rastgele dağılım
- Gerçek dünya simülasyonu

## 🧮 VRP Algoritması

### Problem Tipi: CVRP
- **C**apacitated **V**ehicle **R**outing **P**roblem
- Araç kapasite kısıtı
- Tüm rotalar hub'dan başlar ve hub'da biter

### Çözüm Yöntemi

1. **Greedy Construction**: En yakın komşu algoritması ile başlangıç çözümü
2. **2-Opt Local Search**: Rota iyileştirmesi
3. **Inter-route Exchange**: Rotalar arası kargo değişimi

### Maliyet Fonksiyonu

```
Toplam Maliyet = (Toplam Mesafe × Km Maliyeti) + (Araç Sayısı × Kiralama Maliyeti)
```

Varsayılan değerler:
- Km Maliyeti: 1 TL/km
- Kiralama Maliyeti: 200 TL/araç

## 🗺️ Harita & Routing

### OSRM (Open Source Routing Machine)
- Türkiye OSM verileri kullanılır
- Gerçek yol mesafeleri ve polyline'lar
- Self-hosted (Google/Yandex kullanılmaz!)

### MapLibre GL JS
- Açık kaynak harita kütüphanesi
- Rota görselleştirme
- İstasyon işaretleme

## 📊 Veritabanı Şeması

```
users          → Kullanıcılar (Admin/User)
stations       → İstasyonlar (12 ilçe + 1 hub)
vehicles       → Araçlar (3 farklı kapasite)
cargos         → Kargolar
plans          → Dağıtım planları
plan_routes    → Plan rotaları
trips          → Gerçekleştirilen seferler
trip_waypoints → Sefer durakları
parameters     → Sistem parametreleri
distance_matrix → Mesafe önbelleği
```

## 🔐 RBAC (Rol Tabanlı Erişim Kontrolü)

### Admin Yetkileri
- ✅ Tüm CRUD işlemleri
- ✅ Plan oluşturma ve optimize etme
- ✅ Tüm kullanıcıları görme
- ✅ Tüm seferleri takip etme
- ✅ Sistem parametrelerini değiştirme

### User Yetkileri
- ✅ Kendi kargolarını oluşturma
- ✅ Kendi kargolarını takip etme
- ✅ Kendi aracını haritada görme (varsa)
- ❌ Başka kullanıcı verileri

## 🛠️ Geliştirme

### API Geliştirme

```bash
cd apps/api
npm install
npx prisma generate
npx prisma db push
npm run start:dev
```

### Web Geliştirme

```bash
cd apps/web
npm install
npm run dev
```

### Optimizer Geliştirme

```bash
cd apps/optimizer
pip install -r requirements.txt
uvicorn main:app --reload --port 5000
```

## 📝 API Endpoints

### Kimlik Doğrulama
- `POST /auth/login` - Giriş
- `POST /auth/register` - Kayıt
- `GET /auth/me` - Mevcut kullanıcı

### İstasyonlar
- `GET /stations` - Tüm istasyonlar
- `POST /stations` - Yeni istasyon (Admin)
- `PATCH /stations/:id` - Güncelle (Admin)
- `DELETE /stations/:id` - Sil (Admin)

### Kargolar
- `GET /cargos` - Kargo listesi
- `POST /cargos` - Yeni kargo
- `GET /cargos/:id/route` - Kargo rotası

### Planlar
- `POST /plans` - Plan oluştur (optimize)
- `GET /plans/:id` - Plan detayı
- `POST /plans/:id/execute` - Planı çalıştır

### Seferler
- `GET /trips` - Sefer listesi
- `PATCH /trips/:id/status` - Durum güncelle

## 📄 Lisans

Bu proje eğitim amaçlı geliştirilmiştir - Kocaeli Üniversitesi.

## 👥 Ekip

- Backend & Optimization
- Frontend & UI/UX

---

🎓 **Kocaeli Üniversitesi - 2024**
