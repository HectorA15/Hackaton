# Inventory Expiry Tracker

A lightweight web app to scan QR/barcodes with the browser camera, register products (SKU/lot/expiry/quantity), and highlight items that are close to expiry.

This README focuses on running with Docker/Docker Compose.

## Requirements

- Docker Desktop (or Docker Engine)
- Docker Compose v2 (bundled with Docker Desktop)
- Optional: Node.js 18+ if you want to run without Docker

## Project layout

- `Dockerfile`: production image (Node 18-alpine)
- `docker-compose.yml`: development workflow with live-reload (`nodemon`) and bind mounts
- `public/`: static assets served by the backend
  - `public/vendor/zxing/index.min.js`: local ZXing UMD (QR/barcode reader)
- `src/server.js`: Express server
- `.env.example`: example environment variables

## Environment variables

Create a `.env` from `.env.example`:

```bash
cp .env.example .env
# Edit only if needed; defaults are fine for local dev.
```

Default port is `3000`. If you change `PORT`, update port mapping in `docker-compose.yml` (or when running `docker run`).

## Run (development) with Docker Compose

This mode mounts the source as a volume and runs `nodemon` for the server so changes reflect without rebuilding.

```bash
docker compose up --build
```

- App: http://localhost:3000
- Changes in `src/` and `public/` are reloaded automatically
- Dependencies are installed on container start (`npm install`)

If dependencies get out of sync, rebuild clean:

```bash
docker compose down
docker compose up --build
```

## Run (production) with Docker

```bash
# Build image
docker build -t inventory-expiry-tracker .

# Run with .env and port mapping
docker run --rm -p 3000:3000 --env-file .env inventory-expiry-tracker
```

App: http://localhost:3000

## Camera scanner (ZXing local)

To avoid CDN failures and ensure compatibility, load ZXing locally from `public/vendor/zxing/index.min.js`.

1) Create the folder (if missing):
```bash
# Linux/Mac/WSL
mkdir -p public/vendor/zxing

# PowerShell (Windows)
mkdir public\vendor\zxing -Force
```

2) Download ZXing UMD:
```bash
# Linux/Mac/WSL
curl -L https://unpkg.com/@zxing/library@0.20.0/umd/index.min.js -o public/vendor/zxing/index.min.js

# PowerShell (Windows)
Invoke-WebRequest "https://unpkg.com/@zxing/library@0.20.0/umd/index.min.js" -OutFile "public\vendor\zxing\index.min.js"
```

3) Verify it loads:
- Open http://localhost:3000/vendor/zxing/index.min.js and check it shows minified JS (not a 404/HTML).
- In DevTools Console: `typeof ZXing` should be "object".

During demo:
- Use “Solo QR” for QR codes; “Solo barras” for EAN/Code128.
- Put the code inside the blue frame and move close until the frame is mostly filled.
- If the scanned SKU doesn’t exist yet, the “New product” modal opens with the code pre-filled; complete Name and Expiry and save.

## Useful commands

- Start dev: `docker compose up --build`
- Stop: `docker compose down`
- Follow logs: `docker compose logs -f`
- Rebuild clean: `docker compose build --no-cache && docker compose up`

## Troubleshooting

- "QR/barcode not detected"
  - Ensure ZXing is loaded: in Console, `typeof ZXing` → "object".
  - Validate the file exists: http://localhost:3000/vendor/zxing/index.min.js
  - Use the right mode (QR vs bars) and move closer to fill the frame.
  - Close other apps using the camera.
  - Disable cache: DevTools → Network → “Disable cache” → Ctrl+F5.

- "favicon.ico 404"
  - Harmless. Browsers request `/favicon.ico` by default. Add a favicon to silence the log or ignore it.
  - Quick fix (HTML `<head>`):
    ```html
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%231e40af'/%3E%3Ctext x='50%25' y='52%25' font-family='Arial,sans-serif' font-size='34' text-anchor='middle' fill='white'%3EIE%3C/text%3E%3C/svg%3E">
    ```

## Run without Docker (optional)

```bash
npm install
cp .env.example .env
npm start
# App at http://localhost:3000
```

## License

MIT
