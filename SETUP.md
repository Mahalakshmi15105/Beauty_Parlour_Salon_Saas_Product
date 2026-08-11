# Salon Software - Setup Guide

This guide will help you set up the Salon Software project on a fresh machine.

## Prerequisites

- Python 3.8 or higher
- Node.js 16 or higher
- Git

## Backend Setup

### 1. Clone the repository

```bash
git clone https://gitlab.com/smartgonext-group/salon-software.git
cd salon-software
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment variables
cp .env.example .env

# Edit .env file with your configuration
# For development, you can use the default SQLite database
# For production, update DATABASE_URL to use MySQL/PostgreSQL

# Initialize database
python setup.py

# Run the development server
python run.py
```

The backend will start on `http://localhost:5000`

### 3. Database Setup

The project uses SQLAlchemy with automatic table creation via `db.create_all()`.

**For Development (SQLite):**
- The default `DATABASE_URL` in `.env` uses SQLite
- No additional database setup required
- Database file will be created automatically at `backend/parlour.db`
- Tables are created automatically by the setup script

**For Production (MySQL):**
1. Create a MySQL database:
```sql
CREATE DATABASE salon_software CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. Update `.env` with your MySQL credentials:
```
DATABASE_URL=mysql+pymysql://username:password@localhost/salon_software
```

3. Run migrations (optional - MySQL users can use Flask-Migrate):
```bash
flask db upgrade
```

### 4. Database Setup

**AUTO-SEED (Recommended):** The backend now **automatically seeds** the database
on startup if it's empty. Just run the server:

```bash
python run.py
```

On startup, the backend will:
1. Auto-create the database if it doesn't exist
2. Create all database tables automatically
3. **Auto-seed** default data if the database is empty:
   - Default subscription plans
   - Sample tenant (SmartGoNext Beauty Salon)
   - Super admin user (superadmin@smartgonext.com / SuperAdmin123!)
   - Parlour admin user (admin@smartgonext.com / ParlourAdmin123!)
   - Default settings including booking configuration
   - Sample service categories and services
   - Sample products
   - Sample employees
   - Sample membership plans

**Manual seeding (optional):** You can also run the setup script manually:
```bash
python setup.py
```

The `setup.py` script creates:
- Default subscription plans
- Sample tenant (SmartGoNext Beauty Salon)
- Super admin user (superadmin@smartgonext.com / SuperAdmin123!)
- Parlour admin user (admin@smartgonext.com / ParlourAdmin123!)
- Default settings including booking configuration
- Sample service categories and services
- Sample products
- Sample employees
- Sample membership plans

## Frontend Setup

### 1. Install Dependencies

```bash
cd frontend

# Install dependencies
npm install
```

### 2. Environment Configuration

Create a `.env` file in the frontend directory:

```env
VITE_API_URL=http://localhost:5000/api/v1
```

### 3. Run Development Server

```bash
npm run dev
```

The frontend will start on `http://localhost:5173`

## Default Credentials

### Super Admin
- Email: `superadmin@smartgonext.com`
- Password: `SuperAdmin123!`

### Parlour Admin
- Email: `admin@smartgonext.com`
- Password: `ParlourAdmin123!`

## Project Structure

```
salon-software/
├── backend/
│   ├── app/
│   │   ├── models/          # Database models
│   │   ├── routes/          # API endpoints
│   │   ├── services/        # Business logic
│   │   └── utils/           # Utility functions
│   ├── migrations/          # Database migrations
│   ├── static/              # Static files (uploads)
│   ├── seed.py              # Database seeding script
│   ├── run.py               # Flask application entry point
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components
│   │   ├── services/        # API services
│   │   └── themes/          # Theme configurations
│   └── package.json         # Node dependencies
└── README.md                # This file
```

## Troubleshooting

### Database Issues

If you encounter database issues, you can reset the database:

```bash
# For SQLite
rm backend/parlour.db
python setup.py

# For MySQL (optional - if using migrations)
flask db downgrade base
flask db upgrade
python setup.py
```

### Port Already in Use

If port 5000 or 5173 is already in use, you can change the ports:

**Backend:** Edit `backend/run.py`:
```python
app.run(host="0.0.0.0", port=5001, debug=True)  # Change port from 5000 to 5001
```

**Frontend:** The frontend will automatically try the next available port if 5173 is in use.

### Migration Issues

If you encounter migration issues, you can recreate the migrations:

```bash
# Delete existing migrations (keeping versions folder)
rm backend/migrations/versions/*.py

# Generate new migration
flask db migrate -m "initial_schema"

# Apply migration
flask db upgrade
```

## Development Notes

- The backend uses Flask with SQLAlchemy ORM
- The frontend uses React with Vite
- API communication uses axios
- Authentication uses JWT tokens
- File uploads are stored in `backend/static/uploads/`

## Production Deployment (Cloud Linux)

The project is fully optimized for **cloud Linux** with **single-thread** execution
and **auto-sleep** (idle shutdown) to save server resources.

### Single-Thread Mode

- **Development**: Flask `app.run(threaded=False)` — exactly 1 thread.
- **Production**: Waitress `serve(..., threads=1)` — exactly 1 thread.
- One thread processes ALL user requests **sequentially** — no multi-threading.
- Set `SINGLE_THREAD=false` in `.env` to enable multi-threading intentionally.

### Auto-Sleep Mode

The backend automatically **kills all threads and goes to sleep** after
`AUTO_SLEEP_MINUTES` (default 5) of no API activity:

1. Backend tracks the **last API request** timestamp.
2. After 5 minutes of **zero activity**, the process calls `SIGTERM` on itself.
3. **systemd** (`Restart=always`) automatically restarts the service.
4. The next user request wakes the backend automatically (1-3 second delay).
5. The **frontend auto-wake interceptor** retries the request automatically.

### Production Domains

- **Frontend:** `https://salon.smartgonext.com`
- **Backend API:** `https://salon-backend.smartgonext.com`
- **Database:** `smartgo1_salon` (user: `smartgo1_salon_user`)

### One-Command Cloud Linux Installer

```bash
# On your cloud Linux server (Ubuntu/Debian), as root or with sudo:
bash deploy/install.sh
```

This installs:
- Python 3, MySQL, Nginx, Git
- Clones the repository to `/var/www/salon`
- Creates a Python virtual environment
- Installs `requirements.txt` (includes Waitress)
- **Creates MySQL database `smartgo1_salon` and user `smartgo1_salon_user`**
- Generates `.env` (edit with production secrets)
- Installs & starts the `salon-backend` systemd service
- Verifies the health endpoint

### Phusion Passenger Hosting (cPanel / Plesk / CloudLinux)

If you are using **shared hosting** with Phusion Passenger (cPanel, Plesk,
or CloudLinux), the `passenger_wsgi.py` file is provided:

```bash
# Files needed for Passenger hosting:
backend/passenger_wsgi.py   # WSGI entry point (application = Flask app)
backend/.htaccess           # Single-thread + auto-sleep Passenger config
deploy/CPANEL_SETUP.md      # Step-by-step cPanel setup guide
```

> ⚠️ **IMPORTANT:** If you see the error
> `No such application (or application not configured) "salon-backend.smartgonext.com"`,
> it means the **Python app has not been created in cPanel yet**.
> Follow the complete guide in **`deploy/CPANEL_SETUP.md`**.

The `.htaccess` file configures:
- `PassengerMaxPoolSize 1` → only **ONE** process serves all users
- `PassengerAppEnv production` → production environment

To deploy on cPanel:
1. Upload the `backend/` folder to `~/salon-backend/`
2. In cPanel → **Setup Python App** → **Create Application**:
   - Application root: `/salon-backend`
   - Application URL: `salon-backend.smartgonext.com`
   - **Application startup file:** `passenger_wsgi.py`
   - **Application entry point:** `application`
3. Install dependencies: `pip install -r requirements.txt`
4. Create MySQL database `smartgo1_salon` + user `smartgo1_salon_user`
5. Update `backend/.env` with your `DATABASE_URL` and CORS domains
6. Click **RESTART** on your app in cPanel
7. Verify: `https://salon-backend.smartgonext.com/api/v1/health`

### Manual Wake

```bash
# From the server
bash deploy/wake.sh

# Or with curl
curl http://127.0.0.1:5000/api/v1/health
```

### Nginx Setup

```bash
cp deploy/nginx.conf /etc/nginx/sites-available/salon
ln -s /etc/nginx/sites-available/salon /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### Useful Commands

```bash
# Check service status
systemctl status salon-backend

# Watch logs
journalctl -u salon-backend -f

# Restart manually
systemctl restart salon-backend

# Disable auto-sleep permanently
#   Set AUTO_SLEEP_ENABLED=false in backend/.env
#   Then: systemctl restart salon-backend
```

### Production Checklist

1. Update `.env` with production values
2. Set `ENVIRONMENT=production` in `.env`
3. Set `SINGLE_THREAD=true` (default) for single-thread mode
4. Set `AUTO_SLEEP_ENABLED=true` (default) for auto-sleep
5. Set up a proper database (MySQL/PostgreSQL) — auto-created on startup
6. Configure CORS for your domain
7. Enable HTTPS
8. Set up proper logging
9. Configure WhatsApp Meta API credentials (if using)

## Support

For issues or questions, please contact the development team.
