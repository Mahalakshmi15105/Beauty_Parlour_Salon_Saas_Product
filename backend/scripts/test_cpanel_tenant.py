import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.services.cpanel_service import cpanel_service

app = create_app()

with app.app_context():
    print("==================================================")
    print("cPanel Integration Configuration Test")
    print("==================================================")
    print(f"Enabled:       {cpanel_service.enabled}")
    print(f"Host:          {cpanel_service.host}")
    print(f"Port:          {cpanel_service.port}")
    print(f"Username:      {cpanel_service.username}")
    print(f"API Token:     {cpanel_service.token[:4]}...{cpanel_service.token[-4:]}")
    print("==================================================")
    
    # Test cPanel UAPI connection if requested
    if len(sys.argv) > 1 and sys.argv[1] == "--create-sample":
        test_db = f"{cpanel_service.username}_tenant_sample_1"
        print(f"Testing database creation for '{test_db}'...")
        res = cpanel_service.create_database(test_db)
        print(f"cPanel UAPI Creation Result: {res}")
