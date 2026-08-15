"""
Test routes directly in Python
"""
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from app import create_app

app = create_app()

print("Testing Flask app...")

# Test the routes
with app.test_client() as client:
    # Test login
    print("Testing login...")
    response = client.post('/api/v1/auth/login', json={
        "email": "superadmin@smartgonext.com",
        "password": "admin123"
    })
    print(f"Login: {response.status_code}")
    
    if response.status_code == 200:
        token = response.json.get("data", {}).get("token")
        print(f"Got token: {token[:20] if token else 'None'}...")
        
        # Test bulk upload with auth
        print("\nTesting bulk upload template...")
        response = client.get(
            '/api/v1/bulk-upload/template/customers',
            headers={"Authorization": f"Bearer {token}"}
        )
        print(f"Bulk upload template: {response.status_code}")
        if response.status_code == 200:
            print("SUCCESS: Template download works!")
            print(f"Content type: {response.content_type}")
            print(f"Content length: {len(response.data)} bytes")
        else:
            print(f"Response: {response.data.decode()[:200]}")
    else:
        print(f"Login failed: {response.data.decode()}")