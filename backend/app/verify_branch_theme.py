import requests
from app import create_app
from app.models.user import User
from app.models.branch import Branch
from flask_jwt_extended import create_access_token

BASE_URL = "http://localhost:5000/api/v1"

def get_tokens():
    app = create_app()
    with app.app_context():
        u_main = User.query.filter_by(tenant_id=13, role='ParlourAdmin').first()
        u_b26 = User.query.filter_by(tenant_id=13, branch_id=26, role='BranchAdmin').first()
        u_b27 = User.query.filter_by(tenant_id=13, branch_id=27, role='BranchAdmin').first()

        t_main = create_access_token(identity=str(u_main.id), additional_claims={'parlour_id': u_main.tenant_id, 'branch_id': None, 'role': u_main.role})
        t_b26 = create_access_token(identity=str(u_b26.id), additional_claims={'parlour_id': u_b26.tenant_id, 'branch_id': u_b26.branch_id, 'role': u_b26.role})
        t_b27 = create_access_token(identity=str(u_b27.id), additional_claims={'parlour_id': u_b27.tenant_id, 'branch_id': u_b27.branch_id, 'role': u_b27.role})
        return t_main, t_b26, t_b27

def test_full_theme_and_branding():
    print("================================================================")
    print(" VERIFYING MULTI-TENANT & BRANCH THEME + BRANDING ISOLATION ")
    print("================================================================")
    t_main, t_b26, t_b27 = get_tokens()

    # 1. Update Main Parlour Theme to Royal Purple
    print("\n1. UPDATING MAIN PARLOUR THEME -> Royal Purple (#7C3AED)")
    res = requests.put(f"{BASE_URL}/settings", json={
        "theme_settings": {"theme_name": "Royal Purple", "primary_color": "#7C3AED", "secondary_color": "#A78BFA", "accent_color": "#F5F3FF"}
    }, headers={"Authorization": f"Bearer {t_main}"})
    print(f"   Response Status: {res.status_code} | Message: {res.json().get('message')}")

    # 2. Update Branch A (www2.0) Theme to Ocean Blue (#3B82F6)
    print("\n2. UPDATING BRANCH A (www2.0) THEME -> Ocean Blue (#3B82F6)")
    res = requests.put(f"{BASE_URL}/settings", json={
        "theme_settings": {"theme_name": "Ocean Blue", "primary_color": "#3B82F6", "secondary_color": "#60A5FA", "accent_color": "#EFF6FF"}
    }, headers={"Authorization": f"Bearer {t_b26}"})
    print(f"   Response Status: {res.status_code} | Message: {res.json().get('message')}")

    # 3. Update Branch B (www3.0) Theme to Emerald Green (#10B981)
    print("\n3. UPDATING BRANCH B (www3.0) THEME -> Emerald Green (#10B981)")
    res = requests.put(f"{BASE_URL}/settings", json={
        "theme_settings": {"theme_name": "Emerald Green", "primary_color": "#10B981", "secondary_color": "#34D399", "accent_color": "#ECFDF5"}
    }, headers={"Authorization": f"Bearer {t_b27}"})
    print(f"   Response Status: {res.status_code} | Message: {res.json().get('message')}")

    # 4. Verify Theme Isolation via GET /settings
    print("\n4. VERIFYING ADMIN SETTINGS THEME ISOLATION via GET /settings:")
    m_theme = requests.get(f"{BASE_URL}/settings", headers={"Authorization": f"Bearer {t_main}"}).json()["data"]["theme_settings"]
    b26_theme = requests.get(f"{BASE_URL}/settings", headers={"Authorization": f"Bearer {t_b26}"}).json()["data"]["theme_settings"]
    b27_theme = requests.get(f"{BASE_URL}/settings", headers={"Authorization": f"Bearer {t_b27}"}).json()["data"]["theme_settings"]

    print(f"   Main Parlour Theme: {m_theme['theme_name']} ({m_theme['primary_color']})")
    print(f"   Branch A Theme:     {b26_theme['theme_name']} ({b26_theme['primary_color']})")
    print(f"   Branch B Theme:     {b27_theme['theme_name']} ({b27_theme['primary_color']})")

    assert m_theme["primary_color"] == "#7C3AED", "Main Parlour theme incorrect!"
    assert b26_theme["primary_color"] == "#3B82F6", "Branch A theme incorrect!"
    assert b27_theme["primary_color"] == "#10B981", "Branch B theme incorrect!"
    print("   [PASS] Main Parlour, Branch A, and Branch B maintain isolated themes!")

    # 5. Verify Public Booking Theme for Each Branch
    print("\n5. VERIFYING PUBLIC BOOKING THEME ISOLATION:")
    pub_b26 = requests.get(f"{BASE_URL}/public/booking/branch/26/config").json()["data"]["theme"]
    pub_b27 = requests.get(f"{BASE_URL}/public/booking/branch/27/config").json()["data"]["theme"]
    pub_main = requests.get(f"{BASE_URL}/public/booking/www-salon-13/config").json()["data"]["theme"]

    print(f"   Public Booking Main Parlour Primary: {pub_main['primary_color']}")
    print(f"   Public Booking Branch A Primary:     {pub_b26['primary_color']}")
    print(f"   Public Booking Branch B Primary:     {pub_b27['primary_color']}")

    assert pub_main["primary_color"] == "#7C3AED", "Public Main Parlour theme incorrect!"
    assert pub_b26["primary_color"] == "#3B82F6", "Public Branch A theme incorrect!"
    assert pub_b27["primary_color"] == "#10B981", "Public Branch B theme incorrect!"
    print("   [PASS] Public Booking pages correctly load isolated themes for each branch!")

    print("\n================================================================")
    print(" ALL THEME & BRANDING ISOLATION VERIFICATION TESTS PASSED! ")
    print("================================================================")

if __name__ == "__main__":
    test_full_theme_and_branding()
