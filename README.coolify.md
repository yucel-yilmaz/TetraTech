# TetraTech Coolify Deployment

Bu repo Coolify uzerinde tek domain ile calisacak sekilde hazirlandi.

## Mimari

- `frontend`: React uygulamasini build eder ve Nginx ile servis eder.
- `api`: FastAPI backend'i `8010` portunda calistirir.
- `sim`: Fizik simulasyon servisini `5000` portunda calistirir.
- Nginx proxy:
  - `/api/*` -> `api:8010`
  - `/sim/*` -> `sim:5000`
  - `/user-models/*` -> kalici yuklenen 3D modeller

## Coolify'de Kurulum

1. Coolify'de yeni bir `Docker Compose` resource olusturun.
2. Repository root olarak bu projeyi secin.
3. Compose file olarak `docker-compose.coolify.yml` kullanin.
4. Asagidaki environment variable'lari tanimlayin:
   - `OPENWEATHER_API_KEY`
   - `TETRA_MODEL_UPLOAD_DIR=/data/user-models`
5. Public service olarak `frontend` servisini secin ve port olarak `80` kullanin.
6. Deploy edin.

## Kalici Veri

- Kullanici tarafindan yuklenen `.glb/.gltf` modeller `user_models` volume'u icinde tutulur.
- Bu volume hem `api` hem `frontend` tarafina baglanir; boylece yuklenen modeller deploy sonrasinda da korunur.

## Yerelde Test

```bash
docker compose -f docker-compose.coolify.yml up --build
```

Yerelde test etmek istersen `frontend` servisine gecici olarak `ports: ["8080:80"]` ekleyebilir veya `docker compose port frontend 80` ile eslesen portu kontrol edebilirsin.
