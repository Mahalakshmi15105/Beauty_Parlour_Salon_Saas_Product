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

Run the setup script to initialize the database:
```bash
python setup.py
```

This script will:
- Create all database tables automatically
- Run seed data if the database is empty
- Create default users and sample data

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

## Production Deployment

For production deployment:

1. Update `.env` with production values
2. Use a production WSGI server (Gunicorn, uWSGI)
3. Set up a proper database (MySQL/PostgreSQL)
4. Configure CORS for your domain
5. Enable HTTPS
6. Set up proper logging
7. Configure WhatsApp Meta API credentials (if using)

## Support

For issues or questions, please contact the development team.
