# cPanel / Plesk Passenger Setup Guide

The error `No such application (or application not configured) "salon-backend.smartgonext.com"`
means the **Python app has not been created in cPanel** yet. Follow these steps exactly.

---

## Step 1: Upload the Backend Files

1. Log in to cPanel
2. Open **File Manager**
3. Navigate to your home directory (e.g. `/home/username/`)
4. Create a folder: `salon-backend`
5. Upload the **entire `backend/` folder contents** into `salon-backend/`

Your structure must look like this:
```
/home/username/salon-backend/
├── passenger_wsgi.py      <-- MUST be here (application startup file)
├── .htaccess              <-- Passenger config
├── .env                   <-- Database credentials
├── run.py
├── requirements.txt
├── app/
│   ├── __init__.py
│   ├── config.py
│   ├── db_bootstrap.py
│   ├── database.py
│   ├── models/
│   ├── routes/
│   ├── services/
│   └── utils/
└── migrations/
```

---

## Step 2: Create the Python App in cPanel

1. In cPanel, go to **Setup Python App** (under "Software" section)
2. Click **CREATE APPLICATION**
3. Fill in:
   - **Python version:** `3.11` (or 3.10/3.9 if not available)
   - **Application root:** `/salon-backend`
   - **Application URL:** `salon-backend.smartgonext.com`
   - **Application startup file:** `passenger_wsgi.py`
   - **Application entry point:** `application`
4. Click **CREATE**

> ⚠️ **CRITICAL:** The **Application startup file** must be `passenger_wsgi.py`
> and the **Application entry point** must be `application`.

---

## Step 3: Install Dependencies

After creating the app, cPanel shows a **virtual environment** path.
Run these commands in **Terminal** (or SSH):

```bash
cd ~/salon-backend
source /home/username/virtualenv/salon-backend/3.11/bin/activate
pip install -r requirements.txt
```

---

## Step 4: Configure the Database

In cPanel:
1. Go to **MySQL Databases**
2. Create database: `smartgo1_salon`
3. Create user: `smartgo1_salon_user`
4. Add user to database with **ALL PRIVILEGES**
5. Update `~/salon-backend/.env`:
   ```
   DATABASE_URL=mysql+pymysql://smartgo1_salon_user:YOUR_PASSWORD@localhost:3306/smartgo1_salon
   ```

---

## Step 5: Restart the App

1. Go back to **Setup Python App**
2. Find your app `salon-backend.smartgonext.com`
3. Click **RESTART**

---

## Step 6: Deploy the Frontend

1. Build the frontend locally:
   ```bash
   cd frontend
   npm install
   npm run build
   ```
2. In cPanel **File Manager**, navigate to `public_html/` (or the document root for `salon.smartgonext.com`)
3. Upload the **contents of `frontend/dist/`** into that folder
4. Also upload `frontend/.htaccess` into the same folder (next to `index.html`)

The frontend `.htaccess` handles:
- **SPA routing** — all routes fall back to `index.html`
- **Security headers** — X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
- **Caching** — 30-day cache for CSS/JS/images/fonts
- **Compression** — gzip for HTML/CSS/JS
- **Sensitive file blocking** — denies access to `.env`, `package.json`, etc.

## Step 7: Verify

Visit: `https://salon-backend.smartgonext.com/api/v1/health`

You should see:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "database": "healthy"
  }
}
```

Then visit: `https://salon.smartgonext.com` — the frontend should load.

---

## Troubleshooting

### "No such application (or application not configured)"
- The Python app was **not created** in cPanel → follow **Step 2**
- The app was created but **not restarted** → follow **Step 5**

### "The received data is wrong. Contact support for resolution."
- The app is configured but the **startup file** or **entry point** is wrong
- Verify: startup file = `passenger_wsgi.py`, entry point = `application`

### 500 Internal Server Error
- Check the app's error log in cPanel → **Setup Python App** → your app → **View error log**
- Common causes:
  - Missing dependencies → run `pip install -r requirements.txt`
  - Wrong database credentials → check `.env`
  - Database user doesn't have privileges → check **Step 4**

### Passenger not detecting the app
- Ensure `passenger_wsgi.py` is at the **root** of the application root folder
- Ensure the `.htaccess` file exists in the same folder
- Restart the app from cPanel

---

## Files Summary

| File | Location | Purpose |
|------|----------|---------|
| `passenger_wsgi.py` | `~/salon-backend/` | Application startup file (WSGI entry) |
| `.htaccess` | `~/salon-backend/` | Passenger config (single-thread) |
| `.env` | `~/salon-backend/` | Database + credentials + domains |
| `requirements.txt` | `~/salon-backend/` | Python dependencies |
| `frontend/.htaccess` | `public_html/` (frontend root) | SPA routing + security + caching |
| `frontend/dist/` | `public_html/` (frontend root) | Built React app files |
