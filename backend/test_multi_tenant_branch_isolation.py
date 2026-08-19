import sys
import os
import unittest

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app import create_app
from app.database import db
from app.models.global_models import Tenant, SubscriptionPlan
from app.models.user import User
from app.models.branch import Branch
from app.models.customer import Customer
from app.models.appointment import Appointment, AppointmentItem
from app.models.billing import Invoice, InvoiceLineItem
from app.models.membership import MembershipPlan
from app.models.catalog import ServiceCategory, Service
from app.models.employee import Employee
from app.services.booking_service import BookingService
from flask_jwt_extended import create_access_token
from datetime import date, datetime

class TestMultiTenantBranchIsolation(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config["TESTING"] = True
        cls.app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
        cls.client = cls.app.test_client()

        with cls.app.app_context():
            db.create_all()

            plan = SubscriptionPlan.query.first()
            if not plan:
                plan = SubscriptionPlan(name="Isolation Test Plan", price=0.00)
                db.session.add(plan)
                db.session.flush()

            # Create Main Tenant 1
            tenant1 = Tenant(name="Main Parlour 1", subscription_plan_id=plan.id, status="active")
            db.session.add(tenant1)
            db.session.flush()

            # Create Branch 1 & Branch 2 for Tenant 1
            branch1 = Branch(tenant_id=tenant1.id, name="Branch Downtown", status="active")
            branch2 = Branch(tenant_id=tenant1.id, name="Branch Uptown", status="active")
            db.session.add_all([branch1, branch2])
            db.session.flush()

            # Create Users
            import time
            ts = int(time.time())
            b1_user = User(tenant_id=tenant1.id, branch_id=branch1.id, email=f"admin_b1_{ts}@test.com", role="BranchAdmin")
            b2_user = User(tenant_id=tenant1.id, branch_id=branch2.id, email=f"admin_b2_{ts}@test.com", role="BranchAdmin")
            b1_user.set_password("pass123")
            b2_user.set_password("pass123")

            db.session.add_all([b1_user, b2_user])

            # Create Service for Tenant 1
            cat = ServiceCategory(tenant_id=tenant1.id, name="Hair Care")
            db.session.add(cat)
            db.session.flush()

            service1 = Service(tenant_id=tenant1.id, category_id=cat.id, name="Haircut", price=500.00, duration_minutes=30, status="active")
            db.session.add(service1)

            db.session.commit()

            cls.tenant1_id = tenant1.id
            cls.branch1_id = branch1.id
            cls.branch2_id = branch2.id
            cls.service1_id = service1.id

            cls.b1_token = create_access_token(identity=str(b1_user.id), additional_claims={"parlour_id": tenant1.id, "branch_id": branch1.id, "role": "BranchAdmin"})
            cls.b2_token = create_access_token(identity=str(b2_user.id), additional_claims={"parlour_id": tenant1.id, "branch_id": branch2.id, "role": "BranchAdmin"})

    def test_01_customer_creation_branch_isolation(self):
        """Verify that customer created in Branch 1 is assigned branch_id=1 and isolated from Branch 2 query."""
        with self.app.app_context():
            # 1. Create customer via Branch 1 API
            headers_b1 = {"Authorization": f"Bearer {self.b1_token}"}
            res1 = self.client.post("/api/v1/customers", json={
                "first_name": "Alice",
                "last_name": "Branch1",
                "phone": "9998887771",
                "gender": "Female"
            }, headers=headers_b1)
            self.assertEqual(res1.status_code, 200, f"Branch 1 customer creation failed: {res1.json}")

            c1_id = res1.json["data"]["id"]
            cust1 = db.session.get(Customer, c1_id)
            self.assertEqual(cust1.branch_id, self.branch1_id, "Customer created by Branch 1 must have branch_id set to Branch 1")

            # 2. Branch 1 list customers should return Alice
            res_b1_list = self.client.get("/api/v1/customers", headers=headers_b1)
            b1_cust_ids = [c["id"] for c in res_b1_list.json["data"]["items"]]
            self.assertIn(c1_id, b1_cust_ids)

            # 3. Branch 2 list customers should NOT return Alice (Branch Isolation!)
            headers_b2 = {"Authorization": f"Bearer {self.b2_token}"}
            res_b2_list = self.client.get("/api/v1/customers", headers=headers_b2)
            b2_cust_ids = [c["id"] for c in res_b2_list.json["data"]["items"]]
            self.assertNotIn(c1_id, b2_cust_ids, "Branch 2 must NOT see customer created in Branch 1")

    def test_02_appointment_creation_branch_isolation(self):
        """Verify that appointment created in Branch 1 has branch_id set and does not leak to Branch 2."""
        with self.app.app_context():
            headers_b1 = {"Authorization": f"Bearer {self.b1_token}"}
            headers_b2 = {"Authorization": f"Bearer {self.b2_token}"}

            today_str = date.today().strftime("%Y-%m-%d")

            res1 = self.client.post("/api/v1/appointments", json={
                "customer_name": "Bob Branch1",
                "customer_phone": "9998887772",
                "appointment_date": today_str,
                "booking_source": "Walk-in",
                "items": [{"service_id": self.service1_id}]
            }, headers=headers_b1)
            self.assertEqual(res1.status_code, 200, f"Appointment creation in Branch 1 failed: {res1.json}")

            app1_id = res1.json["data"]["id"]
            app1 = db.session.get(Appointment, app1_id)
            self.assertEqual(app1.branch_id, self.branch1_id, "Appointment created by Branch 1 must have branch_id set to Branch 1")

            # Verify listing for Branch 1 includes app1_id
            res_b1 = self.client.get("/api/v1/appointments", headers=headers_b1)
            b1_app_ids = [a["id"] for a in res_b1.json["data"]]
            self.assertIn(app1_id, b1_app_ids)

            # Verify listing for Branch 2 does NOT include app1_id
            res_b2 = self.client.get("/api/v1/appointments", headers=headers_b2)
            b2_app_ids = [a["id"] for a in res_b2.json["data"]]
            self.assertNotIn(app1_id, b2_app_ids, "Branch 2 must NOT see appointment created in Branch 1")

    def test_03_billing_checkout_branch_isolation(self):
        """Verify that Invoice and line items created in Branch 1 have branch_id set and do not appear in Branch 2."""
        with self.app.app_context():
            headers_b1 = {"Authorization": f"Bearer {self.b1_token}"}
            headers_b2 = {"Authorization": f"Bearer {self.b2_token}"}

            emp = Employee(tenant_id=self.tenant1_id, branch_id=self.branch1_id, first_name="Staff 1", phone="9991112223", status="active")
            db.session.add(emp)
            db.session.commit()

            # Checkout via Branch 1
            res = self.client.post("/api/v1/billing/checkout", json={
                "customer_id": "walkin",
                "line_items": [
                    {"type": "service", "item_id": self.service1_id, "quantity": 1, "unit_price": 500.00, "employee_ids": [emp.id]}
                ],
                "payments": [
                    {"method": "cash", "amount": 500.00}
                ]
            }, headers=headers_b1)

            self.assertEqual(res.status_code, 200, f"Checkout failed: {res.json}")
            inv_id = res.json["data"]["id"]

            inv = db.session.get(Invoice, inv_id)
            self.assertEqual(inv.branch_id, self.branch1_id, "Invoice created in Branch 1 must have branch_id set to Branch 1")

            # Branch 1 invoice list should contain inv_id
            res_b1_inv = self.client.get("/api/v1/invoices", headers=headers_b1)
            b1_inv_items = res_b1_inv.json.get("data", {}).get("items") or res_b1_inv.json.get("items", [])
            b1_inv_ids = [i["id"] for i in b1_inv_items]
            self.assertIn(inv_id, b1_inv_ids)

            # Branch 2 invoice list should NOT contain inv_id
            res_b2_inv = self.client.get("/api/v1/invoices", headers=headers_b2)
            b2_inv_items = res_b2_inv.json.get("data", {}).get("items") or res_b2_inv.json.get("items", [])
            b2_inv_ids = [i["id"] for i in b2_inv_items]
            self.assertNotIn(inv_id, b2_inv_ids, "Branch 2 must NOT see invoice created in Branch 1")

    def test_04_catalog_service_product_branch_isolation(self):
        """Verify that Services and Products created in Branch 1 do not leak to Branch 2 or Main Parlour."""
        with self.app.app_context():
            headers_b1 = {"Authorization": f"Bearer {self.b1_token}"}
            headers_b2 = {"Authorization": f"Bearer {self.b2_token}"}

            # Create Service Category in Branch 1
            res_cat = self.client.post("/api/v1/service-categories", json={"name": "Special Branch 1 Spa"}, headers=headers_b1)
            self.assertIn(res_cat.status_code, (200, 201), f"Category creation failed: {res_cat.json}")
            cat_id = res_cat.json["data"]["id"]

            # Create Service in Branch 1
            res_svc = self.client.post("/api/v1/services", json={
                "name": "Branch 1 Exclusive Massage",
                "category_id": cat_id,
                "price": 1500.00,
                "duration_minutes": 60
            }, headers=headers_b1)
            self.assertIn(res_svc.status_code, (200, 201), f"Service creation failed: {res_svc.json}")
            svc_id = res_svc.json["data"]["id"]

            svc = db.session.get(Service, svc_id)
            self.assertEqual(svc.branch_id, self.branch1_id, "Service created by Branch 1 must have branch_id set to Branch 1")

            # Branch 1 service list should contain svc_id
            res_b1 = self.client.get("/api/v1/services", headers=headers_b1)
            b1_svc_ids = [s["id"] for s in res_b1.json["data"]["items"]]
            self.assertIn(svc_id, b1_svc_ids)

            # Branch 2 service list should NOT contain svc_id
            res_b2 = self.client.get("/api/v1/services", headers=headers_b2)
            b2_svc_ids = [s["id"] for s in res_b2.json["data"]["items"]]
            self.assertNotIn(svc_id, b2_svc_ids, "Branch 2 must NOT see service created in Branch 1")

    def test_05_membership_plan_branch_isolation(self):
        """Verify that Membership Plans created in Branch 1 have branch_id set and do not leak to Branch 2."""
        with self.app.app_context():
            headers_b1 = {"Authorization": f"Bearer {self.b1_token}"}
            headers_b2 = {"Authorization": f"Bearer {self.b2_token}"}

            res = self.client.post("/api/v1/membership-plans", json={
                "name": "Branch 1 VIP Club",
                "price": 5000.00,
                "duration_days": 365,
                "service_discount_percentage": 20.0
            }, headers=headers_b1)
            self.assertEqual(res.status_code, 200, f"Membership plan creation failed: {res.json}")
            plan_id = res.json["data"]["id"]

            plan = db.session.get(MembershipPlan, plan_id)
            self.assertEqual(plan.branch_id, self.branch1_id, "Membership plan created by Branch 1 must have branch_id set to Branch 1")

            # Branch 1 membership list should contain plan_id
            res_b1 = self.client.get("/api/v1/membership-plans", headers=headers_b1)
            b1_plan_ids = [p["id"] for p in res_b1.json["data"]["items"]]
            self.assertIn(plan_id, b1_plan_ids)

            # Branch 2 membership list should NOT contain plan_id
            res_b2 = self.client.get("/api/v1/membership-plans", headers=headers_b2)
            b2_plan_ids = [p["id"] for p in res_b2.json["data"]["items"]]
            self.assertNotIn(plan_id, b2_plan_ids, "Branch 2 must NOT see membership plan created in Branch 1")

if __name__ == "__main__":
    unittest.main()
