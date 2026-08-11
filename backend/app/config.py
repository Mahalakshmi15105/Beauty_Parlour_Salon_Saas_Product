import os
from dotenv import load_dotenv

# Load environment variables from backend/.env using an absolute path
# so credentials resolve regardless of the current working directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # d:\Salon\backend
ENV_PATH = os.path.join(BASE_DIR, ".env")
if os.path.exists(ENV_PATH):
    load_dotenv(ENV_PATH)
else:
    load_dotenv()

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-123!")
    # Use a longer JWT secret key (min 32 bytes for SHA256)
    JWT_SECRET_KEY = os.getenv(
        "JWT_SECRET_KEY",
        "jwt-dev-secret-key-123!-change-this-in-production-32chars"
    )
    # If true, drops ALL tables and recreates them fresh on startup
    RESET_DATABASE = os.getenv("RESET_DATABASE", "false").lower() in ("true", "1", "yes")
    
    # Environment: development | production
    ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()

    # Server Port
    PORT = int(os.getenv("PORT", 5000))

    # ---------------------------------------------------------------
    # SINGLE-THREAD MODE
    # One thread serves ALL users sequentially (no multi-threading).
    # Set SINGLE_THREAD=false only if you intentionally want multi.
    # ---------------------------------------------------------------
    SINGLE_THREAD = os.getenv("SINGLE_THREAD", "true").lower() in ("true", "1", "yes")
    THREADS = 1 if SINGLE_THREAD else int(os.getenv("THREADS", 4))

    # ---------------------------------------------------------------
    # AUTO-SLEEP MODE
    # After AUTO_SLEEP_MINUTES of NO API activity, the backend kills
    # itself (and therefore ALL its threads) to save server resources.
    # ---------------------------------------------------------------
    AUTO_SLEEP_ENABLED = os.getenv("AUTO_SLEEP_ENABLED", "true").lower() in ("true", "1", "yes")
    AUTO_SLEEP_MINUTES = int(os.getenv("AUTO_SLEEP_MINUTES", 5))
    AUTO_SLEEP_CHECK_INTERVAL = int(os.getenv("AUTO_SLEEP_CHECK_INTERVAL", 30))  # seconds

    # Database
    DATABASE_URL = os.getenv(
        "DATABASE_URL", 
        "mysql+pymysql://smartgo1_salon_user:@localhost:3306/smartgo1_salon"
    )
    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # CORS
    # Always include production domains in addition to configured origins
    _cors_env = os.getenv("CORS_ORIGINS", "http://localhost:5173")
    _cors_list = [o.strip() for o in _cors_env.split(",") if o.strip()]
    # Ensure production frontend is always allowed
    if "https://salon.smartgonext.com" not in _cors_list:
        _cors_list.append("https://salon.smartgonext.com")
    CORS_ORIGINS = _cors_list
    # Allow all origins in production if CORS_ALLOW_ALL is set
    CORS_ALLOW_ALL = os.getenv("CORS_ALLOW_ALL", "false").lower() in ("true", "1", "yes")

    # Meta Developer Portal Credentials
    META_APP_ID = os.getenv("META_APP_ID", "")
    META_APP_SECRET = os.getenv("META_APP_SECRET", "")
    META_REDIRECT_URI = os.getenv("META_REDIRECT_URI", "http://localhost:5173/whatsapp-integration")
    META_CONFIG_ID = os.getenv("META_CONFIG_ID", "")
    META_GRAPH_API_VERSION = os.getenv("META_GRAPH_API_VERSION", "v21.0")
    WHATSAPP_BUSINESS_ACCOUNT_ID = os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID", "")
    WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
    WHATSAPP_PERMANENT_ACCESS_TOKEN = os.getenv("WHATSAPP_PERMANENT_ACCESS_TOKEN", "")