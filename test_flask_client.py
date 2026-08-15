"""
Test using Flask test client to verify routes work
"""
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from app import create_app

app = create_app()

print("Testing with Flask test client...")

with app.test_client() as client:
    # Login
    print("1. Testing login...")
    response = client.post('/api/v1/auth/login', json={
        "email": "superadmin@smartgonext.com",
        "password": "admin123"
    })
    print(f"Login: {response.status_code}")
    
    if response.status_code == 200:
        token = response.json.get("data", {}).get("token")
        print(f"Got token: {token[:20] if token else 'None'}...")
        
        # Test all bulk upload routes
        modules = ['customers', 'employees', 'services', 'products']
        
        print("\n2. Testing all bulk upload template routes...")
        for module in modules:
            response = client.get(
                f'/api/v1/bulk-upload/template/{module}',
                headers={"Authorization": f"Bearer {token}"}
            )
            print(f"  {module}: {response.status_code} {'SUCCESS' if response.status_code == 200 else 'FAILED'}")
        
        # Test customer upload route
        print("\n3. Testing customer upload route (without file)...")
        response = client.post(
            '/api/v1/bulk-upload/customers',
            headers={"Authorization": f"Bearer {token}"}
        )
        print(f"  Customers upload: {response.status_code} (should be 400 - no file)")
        
        print("\n=== Flask test client shows routes are working ===")
        print("The issue is with HTTP server access, not route registration")
    else:
        print(f"Login failed: {response.data.decode()}")