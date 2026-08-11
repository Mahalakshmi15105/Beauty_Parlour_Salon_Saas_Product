# Cloud Linux Deployment - Single-Thread + Auto-Sleep

This folder contains everything needed to deploy the Salon Software backend on
a cloud Linux server (Ubuntu/Debian) with **single-thread** execution and
**auto-sleep** (idle shutdown) to save server resources.

## Production Domains

- **Frontend:** `https://salon.smartgonext.com`
- **Backend API:** `https://salon-backend.smartgonext.com`
- **Database:** `smartgo1_salon` (user: `smartgo1_salon_user`)

## Files

| File | Purpose |
|------|---------|
| `install.sh` | One-command cloud Linux installer (systemd + nginx + MySQL) |
| `salon-backend.service` | systemd unit file (auto-restarts after sleep) |
| `nginx.conf` | Reverse proxy config (routes `/api` to backend) |
| `wake.sh` | Manual wake script for a sleeping backend |

## How Auto-Sleep Works

1. Backend tracks the **last API request** timestamp.
2. After `AUTO_SLEEP_MINUTES` (default 5) of **zero activity**, the process
   calls `SIGTERM` on itself — killing **all threads**.
3. **systemd** (`Restart=always`, `RestartSec=3`) automatically restarts the
   service 3 seconds later.
4. The next user request may hit a 1-3 second wake gap; the **frontend
   auto-wake interceptor** (`frontend/src/services/api.js`) retries the
   request automatically after a short delay.

## How Single-Thread Works

- **Development**: Flask `app.run(threaded=False)` — exactly 1 thread.
- **Production**: Waitress `serve(..., threads=1)` — exactly 1 thread.
- One thread processes ALL user requests **sequentially** — no multi-threading.
- Set `SINGLE_THREAD=false` in `.env` to enable multi-threading intentionally.

## Installation

```bash
# As root or with sudo
bash deploy/install.sh
```

The installer will:
1. Install Python, MySQL, Nginx, Git
2. Clone the repository to `/var/www/salon`
3. Create a Python virtual environment
4. Install `requirements.txt` (includes Waitress)
5. Generate `.env` (edit with production secrets)
6. Install & start the `salon-backend` systemd service
7. Verify the health endpoint

## Manual Wake

```bash
# From the server
bash deploy/wake.sh

# Or with curl
curl http://127.0.0.1:5000/api/v1/health
```

## Nginx Setup

```bash
cp deploy/nginx.conf /etc/nginx/sites-available/salon
ln -s /etc/nginx/sites-available/salon /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

## Phusion Passenger Hosting (cPanel / Plesk / CloudLinux)

If you are using **shared hosting** with Phusion Passenger, deploy using:

```bash
# Files:
backend/passenger_wsgi.py   # WSGI entry point (application = Flask app)
backend/.htaccess           # Single-thread + auto-sleep Passenger config
```

The `.htaccess` file enforces:
- `PassengerMaxPoolSize 1` → only **ONE** process serves all users
- `PassengerMaxRequests 1` → process restarts after each request (kills all threads)
- `PassengerAppEnv production` → production environment

Steps:
1. Upload the `backend/` folder to your hosting document root
2. Ensure `passenger_wsgi.py` is at the root of your app directory
3. Set the app's document root to the `backend/` folder
4. The `.htaccess` file is auto-read by Apache/Passenger
5. Update `backend/.env` with your `DATABASE_URL` and CORS domains
6. Restart the Python app from your hosting control panel

## Useful Commands

```bash
# Check service status
systemctl status salon-backend

# Watch logs
journalctl -u salon-backend -f

# Restart manually
systemctl restart salon-backend

# Stop auto-sleep temporarily
systemctl stop salon-backend

# Disable auto-sleep permanently
#   Set AUTO_SLEEP_ENABLED=false in backend/.env
#   Then: systemctl restart salon-backend
