# OSRM (Türkiye) veri hazırlama

Bu proje OSRM’yi (routing engine) container içinde çalıştırır. Ürün senaryosunda hedef, **güncel** OSM verisi ile OSRM datasını sizin üretmenizdir.

## 1) İndirilecek dosya

Geofabrik üzerinden:
- `turkey-latest.osm.pbf`

Bunu repo kökündeki `osrm-data/` klasörüne koyun:
- `osrm-data/turkey-latest.osm.pbf`

## 2) OSRM datasını üret (MLD)

OSRM MLD için 3 adım gerekir:
1. `osrm-extract`
2. `osrm-partition`
3. `osrm-customize`

### Windows (PowerShell)

```powershell
# repo root: D:\kargo
./scripts/osrm-build.ps1
```

### Linux/macOS (bash)

```bash
# repo root
bash ./scripts/osrm-build.sh
```

## 3) Servisleri çalıştır

```bash
docker compose up -d
```

- OSRM container iç port: `5000`
- Host port: `5001` (compose mapping)

## Notlar

- İlk build CPU/RAM kullanır ve birkaç dakika sürebilir.
- PBF güncellendikçe `osrm-data/` içindeki `*.osrm*` çıktıları yeniden üretmek gerekir.
- Compose içindeki OSRM komutu `OSRM_DATA` ile override edilebilir; default: `/data/turkey-latest.osrm`.
