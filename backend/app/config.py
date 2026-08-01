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
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "jwt-dev-secret-key-123!")
    
    # Database
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL", 
        "mysql+pymysql://root:@localhost:3306/smartgonext_beauty_saas"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # CORS
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

    # Meta Developer Portal Credentials
    META_APP_ID = os.getenv("META_APP_ID", "")
    META_APP_SECRET = os.getenv("META_APP_SECRET", "")
    META_REDIRECT_URI = os.getenv("META_REDIRECT_URI", "http://localhost:5173/whatsapp-integration")
    META_CONFIG_ID = os.getenv("META_CONFIG_ID", "")
    META_GRAPH_API_VERSION = os.getenv("META_GRAPH_API_VERSION", "v21.0")
    WHATSAPP_BUSINESS_ACCOUNT_ID = os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID", "")
    WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
    WHATSAPP_PERMANENT_ACCESS_TOKEN = os.getenv("WHATSAPP_PERMANENT_ACCESS_TOKEN", "")
