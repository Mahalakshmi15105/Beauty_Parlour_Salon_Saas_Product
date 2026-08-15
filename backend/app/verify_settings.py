import requests
from app import create_app
from app.models.user import User
from flask_jwt_extended import create_access_token

BASE_URL = "http://localhost:5000/api/v1"

def get_tokens():
    app = create_app()
    with app.app_context():
        # ParlourAdmin for Tenant 13 (www salon)
        u_main = User.query.filter_by(tenant_id=13, role='ParlourAdmin').first()
        # BranchAdmin for Branch 26 (www2.0)
        u_b26 = User.query.filter_by(tenant_id=13, branch_id=26, role='BranchAdmin').first()
        # BranchAdmin for Branch 27 (www3.0)
        u_b27 = User.query.filter_by(tenant_id=13, branch_id=27, role='BranchAdmin').first()

        t_main = create_access_token(identity=str(u_main.id), additional_claims={'parlour_id': u_main.tenant_id, 'branch_id': None, 'role': u_main.role})
        t_b26 = create_access_token(identity=str(u_b26.id), additional_claims={'parlour_id': u_b26.tenant_id, 'branch_id': u_b26.branch_id, 'role': u_b26.role})
        t_b27 = create_access_token(identity=str(u_b27.id), additional_claims={'parlour_id': u_b27.tenant_id, 'branch_id': u_b27.branch_id, 'role': u_b27.role})
        return t_main, t_b26, t_b27

def test_settings():
    print("=== TESTING GET /SETTINGS & BRANDING ISOLATION ACROSS BRANCHES ===")
    t_main, t_b26, t_b27 = get_tokens()

    # 1. Test GET /settings for Main Parlour (www salon)
    res_main = requests.get(f"{BASE_URL}/settings", headers={"Authorization": f"Bearer {t_main}"})
    print(f"\n1. GET /settings (Main Parlour): Status {res_main.status_code}")
    if res_main.status_code == 200:
        data_main = res_main.json().get("data", {}).get("business_profile", {})
        print(f"   Name: {data_main.get('name')} | Logo: {data_main.get('logo_url')}")
        print("   [PASS] Main Parlour settings loaded cleanly with status 200.")
    else:
        print(f"   [FAIL] Main Parlour settings failed with status {res_main.status_code}")

    # 2. Test GET /settings for Branch 26 (www2.0)
    res_b26 = requests.get(f"{BASE_URL}/settings", headers={"Authorization": f"Bearer {t_b26}"})
    print(f"\n2. GET /settings (Branch 26 - www2.0): Status {res_b26.status_code}")
    if res_b26.status_code == 200:
        data_b26 = res_b26.json().get("data", {}).get("business_profile", {})
        print(f"   Name: {data_b26.get('name')} | Logo: {data_b26.get('logo_url')}")
        print("   [PASS] Branch 26 settings loaded cleanly without 500 error!")
    else:
        print(f"   [FAIL] Branch 26 settings failed with status {res_b26.status_code}")

    # 3. Test GET /settings for Branch 27 (www3.0)
    res_b27 = requests.get(f"{BASE_URL}/settings", headers={"Authorization": f"Bearer {t_b27}"})
    print(f"\n3. GET /settings (Branch 27 - www3.0): Status {res_b27.status_code}")
    if res_b27.status_code == 200:
        data_b27 = res_b27.json().get("data", {}).get("business_profile", {})
        print(f"   Name: {data_b27.get('name')} | Logo: {data_b27.get('logo_url')}")
        print("   [PASS] Branch 27 settings loaded cleanly without 500 error!")
    else:
        print(f"   [FAIL] Branch 27 settings failed with status {res_b27.status_code}")

    # 4. Test GET /branches/26 for sidebar details
    res_br26 = requests.get(f"{BASE_URL}/branches/26", headers={"Authorization": f"Bearer {t_b26}"})
    print(f"\n4. GET /branches/26 (Branch Info): Status {res_br26.status_code}")
    if res_br26.status_code == 200:
        b_info = res_br26.json().get("data", {})
        print(f"   Branch Name: {b_info.get('name')} | Logo: {b_info.get('logo_url')}")
        print("   [PASS] Branch 26 details loaded for sidebar layout.")

    print("\n=== SETTINGS & BRANDING VERIFICATION TESTS COMPLETED ===")

if __name__ == "__main__":
    test_settings()
