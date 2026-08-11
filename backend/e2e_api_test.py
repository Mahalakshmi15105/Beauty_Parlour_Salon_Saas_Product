import sys
import os
import json
from datetime import datetime, timezone
from decimal import Decimal

# Reconfigure stdout/stderr to use UTF-8 on Windows command line
if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

# Ensure parent folder is in path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app import create_app
from app.database import db
from app.models.billing import Invoice

def run_e2e_tests():
    print("=" * 60)
    print(" STARTING END-TO-END REVENUE & UTF-8 CURRENCY API TEST")
    print("=" * 60)

    app = create_app()
    client = app.test_client()
    
    # 1. Login to get JWT Token
    print("\n[STEP 1] Logging in as Parlour Admin...")
    login_payload = {
        "email": "admin@smartgonext.com",
        "password": "ParlourAdmin123!"
    }
    response = client.post(
        "/api/v1/auth/login",
        data=json.dumps(login_payload),
        content_type="application/json"
    )
    if response.status_code != 200:
        print(f"FAIL: Login failed with code {response.status_code}")
        print(response.data.decode())
        sys.exit(1)
        
    res_data = response.get_json()
    token = res_data.get("data", {}).get("token")
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    print("OK: Logged in successfully!")

    # 2. Update Currency Symbol to '₹' (UTF-8 Indian Rupee)
    print("\n[STEP 2] Updating regional settings to use '₹' symbol...")
    currency_payload = {
        "currency_code": "INR",
        "currency_symbol": "₹"
    }
    update_res = client.put(
        "/api/v1/settings/currency",
        data=json.dumps(currency_payload),
        headers=headers
    )
    if update_res.status_code != 200:
        print(f"FAIL: Failed to update currency setting: {update_res.data.decode()}")
        sys.exit(1)
    print("OK: Currency setting update requested.")

    # 3. Retrieve settings to verify '₹' is correctly saved (and not replaced by '?')
    print("\n[STEP 3] Fetching currency settings to verify database save...")
    get_currency_res = client.get("/api/v1/settings/currency", headers=headers)
    if get_currency_res.status_code != 200:
        print(f"FAIL: Failed to get currency: {get_currency_res.data.decode()}")
        sys.exit(1)
        
    currency_data = get_currency_res.get_json().get("data", {})
    saved_symbol = currency_data.get("currency_symbol")
    print(f"Saved Currency Symbol: '{saved_symbol}'")
    
    if saved_symbol != "₹":
        print(f"FAIL: Currency symbol is '{saved_symbol}' instead of expected '₹'. UTF-8 database save failed!")
        sys.exit(1)
    print("OK: Currency symbol successfully verified as '₹' (no question marks!).")

    # 4. Fetch dynamic resources needed for checkout (Customer, Service, Employee)
    print("\n[STEP 4] Fetching active customer, service, and employee for billing checkout...")
    
    # Get customer
    cust_res = client.get("/api/v1/customers?limit=1", headers=headers)
    customers = cust_res.get_json().get("data", {}).get("items", [])
    if not customers:
        print("FAIL: No active customers found to generate invoice.")
        sys.exit(1)
    customer_id = customers[0]["id"]
    
    # Get service
    svc_res = client.get("/api/v1/services?limit=1", headers=headers)
    services = svc_res.get_json().get("data", {}).get("items", [])
    if not services:
        print("FAIL: No active services found to generate invoice.")
        sys.exit(1)
    service_id = services[0]["id"]
    service_price = Decimal(str(services[0]["price"]))
    
    # Get employee
    emp_res = client.get("/api/v1/employees?limit=1", headers=headers)
    employees = emp_res.get_json().get("data", {}).get("items", [])
    if not employees:
        print("FAIL: No active employees found to assign service.")
        sys.exit(1)
    employee_id = employees[0]["id"]
    
    print(f"Selected Customer ID: {customer_id}")
    print(f"Selected Service: '{services[0]['name']}' (Price: {service_price})")
    print(f"Selected Employee: '{employees[0]['first_name']}' (ID: {employee_id})")

    # Get settings tax rate
    settings_res = client.get("/api/v1/settings", headers=headers)
    tax_rate = Decimal(str(settings_res.get_json().get("data", {}).get("invoice_settings", {}).get("tax_rate", 18.00)))
    print(f"Tax Rate (GST): {tax_rate}%")

    # 5. Calculate checkout amounts and submit billing
    print("\n[STEP 5] Performing checkout checkout...")
    tax_amount = service_price * (tax_rate / Decimal("100.00"))
    total_amount = service_price + tax_amount
    
    checkout_payload = {
        "customer_id": customer_id,
        "line_items": [
            {
                "type": "service",
                "item_id": service_id,
                "quantity": 1,
                "employee_id": employee_id
            }
        ],
        "payments": [
            {
                "method": "cash",
                "amount": float(total_amount)
            }
        ]
    }
    
    checkout_res = client.post(
        "/api/v1/billing/checkout",
        data=json.dumps(checkout_payload),
        headers=headers
    )
    if checkout_res.status_code not in (200, 201):
        print(f"FAIL: Checkout failed with code {checkout_res.status_code}: {checkout_res.data.decode()}")
        sys.exit(1)
        
    invoice_data = checkout_res.get_json().get("data", {})
    invoice_number = invoice_data.get("invoice_number")
    invoice_total = invoice_data.get("total")
    print(f"OK: Invoice created successfully! Number: {invoice_number}, Total: {invoice_total}")

    # 6. Fetch Dashboard Summary & Verify Revenue calculations
    print("\n[STEP 6] Checking dashboard summary metrics...")
    summary_res = client.get("/api/v1/dashboard/summary", headers=headers)
    if summary_res.status_code != 200:
        print(f"FAIL: Failed to get dashboard summary: {summary_res.data.decode()}")
        sys.exit(1)
        
    summary_data = summary_res.get_json().get("data", {})
    revenue = summary_data.get("revenue", {})
    invoices = summary_data.get("invoices", {})
    
    print(f"Today's Revenue:    {revenue.get('today')}")
    print(f"Weekly Revenue:     {revenue.get('weekly')}")
    print(f"Monthly Revenue:    {revenue.get('monthly')}")
    print(f"Today's Bills:      {invoices.get('today')}")
    print(f"This Month's Bills: {invoices.get('this_month')}")
    
    # Assertions
    assert revenue.get("today") > 0, "Today's revenue should be greater than 0"
    assert revenue.get("weekly") > 0, "Weekly revenue should be greater than 0"
    assert revenue.get("monthly") > 0, "Monthly revenue should be greater than 0"
    assert invoices.get("today") > 0, "Today's bills processed count should be greater than 0"
    assert invoices.get("this_month") > 0, "This month's bills count should be greater than 0"
    
    print("\n" + "=" * 60)
    print(" SUCCESS: ALL END-TO-END INTEGRATION TESTS PASSED!")
    print("=" * 60)

if __name__ == "__main__":
    run_e2e_tests()
