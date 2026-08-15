"""
Test plans API directly
"""
import requests
import json

BASE = 'http://localhost:5000/api/v1'

# Login as Super Admin
r = requests.post(f'{BASE}/auth/login', json={'email': 'superadmin@smartgonext.com', 'password': 'admin123'}, timeout=10)
token = r.json()['data']['token']
headers = {'Authorization': f'Bearer {token}'}

# Get plans
r = requests.get(f'{BASE}/super-admin/subscription-plans', headers=headers, timeout=10)
print(f"Status: {r.status_code}")
print(f"Response: {json.dumps(r.json(), indent=2)}")
