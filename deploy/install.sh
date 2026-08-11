#!/usr/bin/env bash
# ============================================================
# SmartGoNext Salon - Cloud Linux Installer
# Single-Thread + Auto-Sleep Backend Deployment
#
# Usage (as root or with sudo):
#   bash deploy/install.sh
# ============================================================
set -euo pipefail

APP_DIR="/var/www/salon"
BACKEND_DIR="$APP_DIR/backend"
SERVICE_NAME="salon-backend"
PYTHON_BIN="${PYTHON_BIN:-/usr/bin/python3}"
GIT_REPO="${GIT_REPO:-https://gitlab.com/smartgonext-group/salon-software.git}"

echo "=============================================="
echo "  SmartGoNext Salon - Cloud Linux Installer"
echo "  Single-Thread + Auto-Sleep Mode"
echo "=============================================="

# 1. Install system dependencies
echo "[1/8] Installing system dependencies..."
apt-get update -y
apt-get install -y \
    python3 python3-pip python3-venv \
    mysql-server \
    nginx \
    git \
    curl \
    build-essential

# 2. Create application user if missing
echo "[2/8] Creating www-data application user..."
if ! id "www-data" &>/dev/null; then
    useradd -r -m -s /bin/bash www-data
fi

# 3. Clone / copy repository
echo "[3/8] Deploying application code..."
mkdir -p "$APP_DIR"
if [ ! -d "$BACKEND_DIR" ]; then
    git clone "$GIT_REPO" "$APP_DIR"
else
    cd "$APP_DIR"
    git pull || true
fi

# 4. Create Python virtual environment & install dependencies
echo "[4/8] Installing Python dependencies..."
cd "$BACKEND_DIR"
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 5. Create MySQL database and user
echo "[5/8] Creating MySQL database and user..."
DB_NAME="${DB_NAME:-smartgo1_salon}"
DB_USER="${DB_USER:-smartgo1_salon_user}"
DB_PASS="${DB_PASS:-Arish@123}"

mysql -u root <<MYSQL_SCRIPT
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
MYSQL_SCRIPT

echo "  ✅ Database '$DB_NAME' and user '$DB_USER' ready."

# 6. Configure environment file
echo "[6/8] Configuring environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    # Set the production database URL
    sed -i "s|DATABASE_URL=.*|DATABASE_URL=mysql+pymysql://$DB_USER:$DB_PASS@localhost:3306/$DB_NAME|" .env
    echo ""
    echo "  ⚠️  EDIT .env FILE WITH YOUR PRODUCTION VALUES:"
    echo "     nano $BACKEND_DIR/.env"
    echo ""
fi

# 7. Set proper ownership
echo "[7/8] Setting file ownership..."
chown -R www-data:www-data "$APP_DIR"
chmod -R 755 "$APP_DIR"

# 8. Install systemd service
echo "[8/8] Installing systemd service..."
cat > "/etc/systemd/system/$SERVICE_NAME.service" <<EOF
[Unit]
Description=SmartGoNext Salon Backend (Single-Thread + Auto-Sleep)
After=network.target mysql.service mariadb.service
Wants=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=$BACKEND_DIR
EnvironmentFile=$BACKEND_DIR/.env
ExecStart=$BACKEND_DIR/venv/bin/python $BACKEND_DIR/run.py
Restart=always
RestartSec=3
KillMode=mixed
TimeoutStopSec=5
TasksMax=16
LimitNOFILE=1024
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl start "$SERVICE_NAME"

# 9. Verify deployment
echo "[9/9] Verifying deployment..."
sleep 2
if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo ""
    echo "=============================================="
    echo "  ✅ Backend deployed successfully!"
    echo "=============================================="
    echo ""
    echo "  Service:    systemctl status $SERVICE_NAME"
    echo "  Logs:       journalctl -u $SERVICE_NAME -f"
    echo "  API URL:    http://$(hostname -I | awk '{print $1}'):5000/api/v1/health"
    echo ""
    echo "  AUTO-SLEEP: The server will terminate after"
    echo "              AUTO_SLEEP_MINUTES of inactivity and"
    echo "              restart automatically on the next request."
    echo ""
    echo "  SINGLE-THREAD: Only 1 thread handles ALL users."
    echo ""
    echo "  Next steps:"
    echo "    1. Edit $BACKEND_DIR/.env with production secrets"
    echo "    2. Rebuild frontend: cd frontend && npm install && npm run build"
    echo "    3. Set up nginx to proxy /api to localhost:5000"
    echo ""
else
    echo "  ❌ Deployment failed. Check logs: journalctl -u $SERVICE_NAME"
    exit 1
fi