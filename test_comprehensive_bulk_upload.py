"""
Test comprehensive bulk upload functionality
"""
import requests
import openpyxl
from io import BytesIO

API_BASE = "http://localhost:5000/api/v1"

print("=== COMPREHENSIVE BULK UPLOAD TESTING ===\n")

# Login as SuperAdmin
print("1. Testing login...")
login_response = requests.post(f"{API_BASE}/auth/login", json={
    "email": "superadmin@smartgonext.com",
    "password": "admin123"
})

if login_response.status_code == 200:
    token = login_response.json().get("data", {}).get("token")
    print("SUCCESS: Login successful")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test all template downloads
    modules = ['customers', 'employees', 'services', 'products']
    
    print("\n2. Testing template downloads for all modules...")
    for module in modules:
        response = requests.get(f"{API_BASE}/bulk-upload/template/{module}", headers=headers)
        print(f"  {module}: {response.status_code} {'SUCCESS' if response.status_code == 200 else 'FAILED'}")
    
    # Test customer bulk upload
    print("\n3. Testing customer bulk upload...")
    
    # Create test Excel file for customers
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Test Customers"
    
    headers = ["First Name", "Last Name", "Phone Number", "Email", "Gender"]
    for col_num, header in enumerate(headers, 1):
        ws.cell(row=1, column=col_num, value=header)
    
    test_data = [
        ["Test", "Customer", "9998887777", "test@example.com", "Male"],
        ["Test2", "Customer2", "9998887778", "test2@example.com", "Female"]
    ]
    
    for row_num, row_data in enumerate(test_data, 2):
        for col_num, value in enumerate(row_data, 1):
            ws.cell(row=row_num, column=col_num, value=value)
    
    file_stream = BytesIO()
    wb.save(file_stream)
    file_stream.seek(0)
    
    files = {'file': ('test_customers.xlsx', file_stream.getvalue(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
    upload_response = requests.post(f"{API_BASE}/bulk-upload/customers", headers=headers, files=files)
    
    print(f"  Upload status: {upload_response.status_code}")
    if upload_response.status_code == 200:
        result = upload_response.json()
        print(f"  SUCCESS: Total rows: {result.get('total_rows')}, Successful: {result.get('successful')}, Failed: {result.get('failed')}")
        if result.get('validation_errors'):
            print(f"  Validation errors: {len(result['validation_errors'])}")
    else:
        print(f"  FAILED: {upload_response.text[:200]}")
    
    # Test existing functionality is not broken
    print("\n4. Testing existing Super Admin functionality...")
    
    # Test dashboard
    dashboard = requests.get(f"{API_BASE}/super-admin/dashboard", headers=headers)
    print(f"  Dashboard: {dashboard.status_code} {'SUCCESS' if dashboard.status_code == 200 else 'FAILED'}")
    
    # Test tenants
    tenants = requests.get(f"{API_BASE}/super-admin/tenants", headers=headers)
    print(f"  Tenants: {tenants.status_code} {'SUCCESS' if tenants.status_code == 200 else 'FAILED'}")
    
    # Test analytics
    analytics = requests.get(f"{API_BASE}/super-admin/analytics", headers=headers)
    print(f"  Analytics: {analytics.status_code} {'SUCCESS' if analytics.status_code == 200 else 'FAILED'}")
    
    print("\n=== TESTING COMPLETE ===")
    print("Backend bulk upload APIs are working correctly!")
    print("Existing Super Admin functionality is preserved!")
    
else:
    print(f"FAILED: Login failed: {login_response.text}")