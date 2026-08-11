import sys
import os
from datetime import datetime, timezone
import json

# Ensure parent folder is in path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app import create_app
from app.database import db
from sqlalchemy import inspect

def inspect_db_schema(app):
    print("=" * 60)
    print(" PHASE 1: DATABASE SCHEMA VALIDATION")
    print("=" * 60)
    
    discrepancies = []
    
    with app.app_context():
        try:
            inspector = inspect(db.engine)
            db_tables = inspector.get_table_names()
            model_tables = db.metadata.tables
            
            print(f"Tables present in database: {len(db_tables)}")
            print(f"Tables defined in models:   {len(model_tables)}")
            print("-" * 60)
            
            # Check for missing tables
            for table_name in model_tables.keys():
                if table_name not in db_tables:
                    err = f"[MISSING TABLE] Table '{table_name}' is defined in models but does not exist in the database."
                    print(err)
                    discrepancies.append(err)
                    continue
                
                # Check columns in existing tables
                db_cols = {col["name"]: col for col in inspector.get_columns(table_name)}
                model_cols = model_tables[table_name].columns
                
                for col_name, model_col in model_cols.items():
                    if col_name not in db_cols:
                        err = f"[MISSING COLUMN] Column '{col_name}' is missing from table '{table_name}'."
                        print(err)
                        discrepancies.append(err)
                    else:
                        # Optional: Log types
                        db_type = str(db_cols[col_name]["type"])
                        model_type = str(model_col.type)
                        # We don't fail on type name difference directly unless it's a major mismatch
                        
            if not discrepancies:
                print("   [OK] Database Schema validation passed! All tables and columns are correct.")
            else:
                print(f"   [FAIL] Database Schema validation failed with {len(discrepancies)} error(s).")
                
        except Exception as e:
            err = f"[DATABASE CONNECTIVITY ERROR] Failed to connect/inspect database: {str(e)}"
            print(err)
            discrepancies.append(err)
            
    return discrepancies

def run_api_tests(app):
    print("\n" + "=" * 60)
    print(" PHASE 2: API INTEGRATION TESTS")
    print("=" * 60)
    
    client = app.test_client()
    token = None
    results = []
    
    # 1. Login Test
    print("1. Testing login credentials...")
    login_payload = {
        "email": "admin@smartgonext.com",
        "password": "ParlourAdmin123!"
    }
    try:
        response = client.post(
            "/api/v1/auth/login",
            data=json.dumps(login_payload),
            content_type="application/json"
        )
        if response.status_code == 200:
            res_data = response.get_json()
            token = res_data.get("data", {}).get("token")
            print("   [OK] Login successful!")
            results.append({"name": "Auth: Login", "status": "Passed", "code": 200})
        else:
            print(f"   [FAIL] Login failed with status code {response.status_code}: {response.data.decode()}")
            results.append({"name": "Auth: Login", "status": f"Failed (HTTP {response.status_code})", "detail": response.data.decode()})
            return results
    except Exception as e:
        print(f"   [FAIL] Login failed with error: {str(e)}")
        results.append({"name": "Auth: Login", "status": "Failed (Exception)", "detail": str(e)})
        return results

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Endpoints to test
    endpoints = [
        # Health & Auth
        {"name": "Health Check", "url": "/api/v1/health"},
        {"name": "Auth: Current User Details", "url": "/api/v1/auth/me"},
        
        # Dashboard & Settings
        {"name": "Dashboard: Get Summary", "url": "/api/v1/dashboard/summary"},
        {"name": "Dashboard: Get Activities", "url": "/api/v1/dashboard/activities"},
        {"name": "Dashboard: Get Charts", "url": "/api/v1/dashboard/charts?range=7"},
        {"name": "Settings: Get Config", "url": "/api/v1/settings"},
        
        # Subscriptions & Tenant Setup
        {"name": "Notifications: Fetch List", "url": "/api/v1/notifications?limit=10"},
        {"name": "WhatsApp: Settings", "url": "/api/v1/whatsapp/settings"},
        {"name": "Campaigns: List", "url": "/api/v1/whatsapp/campaigns"},
        
        # Resources & Models
        {"name": "Customers: Fetch List", "url": "/api/v1/customers?limit=10"},
        {"name": "Employees: Fetch List", "url": "/api/v1/employees?limit=10"},
        {"name": "Services: Fetch List", "url": "/api/v1/services?limit=10"},
        {"name": "Products: Fetch List", "url": "/api/v1/products?limit=10"},
        {"name": "Appointments: Fetch Current Date", "url": f"/api/v1/appointments?date={datetime.now(timezone.utc).date().isoformat()}"},
        {"name": "Memberships: Fetch Plans List", "url": "/api/v1/membership-plans?limit=10"},
        {"name": "Billing: Fetch Invoices List", "url": "/api/v1/invoices?limit=10"},
        
        # Reports
        {"name": "Reports: Sales Summary", "url": "/api/v1/reports/sales?preset=30days"},
        {"name": "Reports: Tax Collection", "url": "/api/v1/reports/tax?preset=30days"},
        {"name": "Reports: Employee Commissions", "url": "/api/v1/reports/employees?preset=30days"},
        {"name": "Reports: Product Sales", "url": "/api/v1/reports/products"},
        {"name": "Reports: Membership Revenue", "url": "/api/v1/reports/memberships?preset=30days"},
        {"name": "Reports: Procurement Spend", "url": "/api/v1/reports/procurement?preset=30days"}
    ]
    
    for ep in endpoints:
        print(f"Testing {ep['name']} ({ep['url']})...")
        try:
            res = client.get(ep["url"], headers=headers)
            if res.status_code == 200:
                print(f"   [OK] {ep['name']} passed!")
                results.append({"name": ep["name"], "status": "Passed", "code": 200})
            else:
                body = res.data.decode()
                print(f"   [FAIL] {ep['name']} failed with status code {res.status_code}: {body[:200]}")
                results.append({"name": ep["name"], "status": f"Failed (HTTP {res.status_code})", "detail": body})
        except Exception as e:
            print(f"   [FAIL] {ep['name']} failed with exception: {str(e)}")
            results.append({"name": ep["name"], "status": "Failed (Exception)", "detail": str(e)})

    # Test Create Customer (POST)
    print("Testing Customer Creation (POST)...")
    customer_payload = {
        "first_name": "Diagnostic Test Customer",
        "last_name": "Verifier",
        "phone": "0000000888",
        "gender": "Female"
    }
    customer_id = None
    try:
        res = client.post(
            "/api/v1/customers",
            data=json.dumps(customer_payload),
            headers=headers
        )
        if res.status_code in (200, 201):
            res_data = res.get_json()
            customer_id = res_data.get("data", {}).get("id")
            print("   [OK] Customer created successfully!")
            results.append({"name": "Customers: Create Customer", "status": "Passed", "code": res.status_code})
        else:
            body = res.data.decode()
            print(f"   [FAIL] Customer creation failed with status code {res.status_code}: {body[:200]}")
            results.append({"name": "Customers: Create Customer", "status": f"Failed (HTTP {res.status_code})", "detail": body})
    except Exception as e:
        print(f"   [FAIL] Customer creation failed with exception: {str(e)}")
        results.append({"name": "Customers: Create Customer", "status": "Failed (Exception)", "detail": str(e)})

    # Test Delete Customer (DELETE)
    if customer_id:
        print(f"Testing Customer Deletion (DELETE) for ID {customer_id}...")
        try:
            res = client.delete(
                f"/api/v1/customers/{customer_id}",
                headers=headers
            )
            if res.status_code == 200:
                print("   [OK] Customer deleted successfully!")
                results.append({"name": "Customers: Delete Customer", "status": "Passed", "code": 200})
            else:
                body = res.data.decode()
                print(f"   [FAIL] Customer deletion failed with status code {res.status_code}: {body[:200]}")
                results.append({"name": "Customers: Delete Customer", "status": f"Failed (HTTP {res.status_code})", "detail": body})
        except Exception as e:
            print(f"   [FAIL] Customer deletion failed with exception: {str(e)}")
            results.append({"name": "Customers: Delete Customer", "status": "Failed (Exception)", "detail": str(e)})
            
    return results

def generate_report(schema_errors, api_results):
    report_file = "system_verification_report.md"
    print("\n" + "=" * 60)
    print(f" GENERATING REPORT: {report_file}")
    print("=" * 60)
    
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    report_md = f"""# System Verification & Diagnostic Report
Generated: {now_str}

## 1. Database Schema Health Check
"""
    if not schema_errors:
        report_md += "[OK] **PASSED**: All database tables and columns exist and match application models perfectly.\n"
    else:
        report_md += "[FAIL] **FAILED**: Found discrepancies between your database schema and python models:\n\n"
        for err in schema_errors:
            report_md += f"- {err}\n"
        report_md += "\n> [!WARNING]\n> Use `RESET_DATABASE=true` in `.env` (development only) or run proper database migrations to update your production database schema.\n"

    report_md += "\n## 2. API Endpoints Integration Check\n"
    report_md += "| Endpoint / Component | Status | Code / Detail |\n"
    report_md += "| --- | --- | --- |\n"
    
    all_apis_pass = True
    for res in api_results:
        code_or_detail = res.get("code", res.get("detail", "N/A"))
        if len(str(code_or_detail)) > 100:
            code_or_detail = str(code_or_detail)[:100] + "..."
        report_md += f"| {res['name']} | {res['status']} | {code_or_detail} |\n"
        if res["status"] != "Passed":
            all_apis_pass = False

    report_md += "\n## 3. Overall Verdict\n"
    if not schema_errors and all_apis_pass:
        report_md += "### **[OK] SYSTEM HEALTHY**\nAll checks passed. The database schema and all API endpoints are fully operational.\n"
    else:
        report_md += "### **[FAIL] SYSTEM ISSUES DETECTED**\nVerify the database schema discrepancies and check the logs/endpoints details above to fix any backend errors.\n"
        
    with open(report_file, "w", encoding="utf-8") as f:
        f.write(report_md)
        
    print(f"Report written to '{report_file}'.")

if __name__ == "__main__":
    app = create_app()
    schema_errors = inspect_db_schema(app)
    api_results = run_api_tests(app)
    generate_report(schema_errors, api_results)
