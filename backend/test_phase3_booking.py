import sys
import json
import logging
from datetime import datetime, date, timedelta

# Set up app context
from app import create_app
from app.database import db
from app.models.global_models import Tenant, SubscriptionPlan
from app.models.user import User, TenantSetting
from app.models.catalog import Service, ServiceCategory
from app.models.employee import Employee
from app.models.customer import Customer
from app.models.appointment import Appointment, AppointmentItem
from app.services.booking_service import BookingService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("Phase3Test")

app = create_app()

def test_phase3_end_to_end():
    with app.app_context():
        logger.info("=== STARTING PHASE 3 END-TO-END VERIFICATION ===")

        # 1. Ensure test tenants exist
        tenant1 = Tenant.query.filter_by(id=1).first()
        if not tenant1:
            plan = SubscriptionPlan.query.first()
            if not plan:
                plan = SubscriptionPlan(name="Basic", price=999, duration_days=30)
                db.session.add(plan)
                db.session.flush()
            tenant1 = Tenant(id=1, name="Lotus Beauty Parlour", subscription_plan_id=plan.id)
            db.session.add(tenant1)
            db.session.commit()

        tenant2 = Tenant.query.filter_by(id=2).first()
        if not tenant2:
            plan = SubscriptionPlan.query.first()
            tenant2 = Tenant(id=2, name="Orchid Spa", subscription_plan_id=plan.id)
            db.session.add(tenant2)
            db.session.commit()

        # Settings for Tenant 1
        s1 = TenantSetting.query.filter_by(tenant_id=1).first()
        if not s1:
            s1 = TenantSetting(tenant_id=1, owner_name="Priya Sharma", alternate_phone="9876543210")
            db.session.add(s1)
        s1.booking_enabled = True
        s1.booking_type = "Token"
        s1.working_days = json.dumps(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"])
        s1.opening_time = "09:00"
        s1.closing_time = "20:00"
        s1.break_start_time = "13:00"
        s1.break_end_time = "14:00"
        s1.max_daily_bookings = 50
        s1.allow_staff_selection = True
        db.session.commit()

        # Services for Tenant 1
        cat1 = ServiceCategory.query.filter_by(tenant_id=1).first()
        if not cat1:
            cat1 = ServiceCategory(tenant_id=1, name="Hair Care")
            db.session.add(cat1)
            db.session.flush()

        srv1 = Service.query.filter_by(tenant_id=1).first()
        if not srv1:
            srv1 = Service(tenant_id=1, category_id=cat1.id, name="Hair Cut & Spa", price=499.00, duration_minutes=45)
            db.session.add(srv1)
            db.session.commit()

        # Employee for Tenant 1
        emp1 = Employee.query.filter_by(tenant_id=1).first()
        if not emp1:
            emp1 = Employee(tenant_id=1, first_name="Anjali", phone="9988776655", specialization="Hair Stylist")
            db.session.add(emp1)
            db.session.commit()

        client = app.test_client()

        # TEST 1: Public Config API
        res = client.get("/api/v1/public/booking/1/config")
        assert res.status_code == 200, f"Config failed: {res.data}"
        cfg_data = json.loads(res.data)["data"]
        assert "parlour_name" in cfg_data and len(cfg_data["parlour_name"]) > 0
        logger.info("✅ TEST 1 PASSED: Public Config loaded successfully.")

        # TEST 2: Public Services API
        res = client.get("/api/v1/public/booking/1/services")
        assert res.status_code == 200, f"Services failed: {res.data}"
        srv_data = json.loads(res.data)["data"]
        assert len(srv_data) > 0
        logger.info("✅ TEST 2 PASSED: Active Services loaded successfully.")

        # TEST 3: Public Staff API
        res = client.get("/api/v1/public/booking/1/staff")
        assert res.status_code == 200, f"Staff failed: {res.data}"
        stf_data = json.loads(res.data)["data"]
        assert len(stf_data) > 0
        logger.info("✅ TEST 3 PASSED: Staff directory loaded successfully.")

        # TEST 4: Token Mode Slot Generation
        test_date = (date.today() + timedelta(days=1)).strftime("%Y-%m-%d")
        res = client.get(f"/api/v1/public/booking/1/slots?date={test_date}")
        assert res.status_code == 200
        tokens_data = json.loads(res.data)["data"]
        assert tokens_data["booking_type"] == "Token"
        assert len(tokens_data["tokens"]) == 50
        logger.info("✅ TEST 4 PASSED: Token booking slots generated successfully.")

        # TEST 5: Create Website Token Booking
        import random
        phone_tok = f"98{random.randint(10000000, 99999999)}"
        booking_payload = {
            "customer_name": "Divya Gupta",
            "customer_phone": phone_tok,
            "customer_email": "divya@example.com",
            "gender": "Female",
            "appointment_date": test_date,
            "token_number": 1,
            "booking_source": "Website Token",
            "booking_channel": "Website",
            "notes": "Test Token Booking",
            "items": [{"service_id": srv1.id, "employee_id": emp1.id}]
        }
        res = client.post("/api/v1/public/booking/1", json=booking_payload)
        assert res.status_code == 201, f"Website booking failed: {res.data}"
        b_res = json.loads(res.data)["data"]
        assert b_res["appointment_number"].startswith("APT-")
        assert b_res["booking_channel"] == "Website"
        logger.info("✅ TEST 5 PASSED: Website Token Booking submitted & saved into database successfully.")

        # TEST 6: Duplicate Token Booking Check
        res_dup = client.post("/api/v1/public/booking/1", json=booking_payload)
        assert res_dup.status_code == 400
        assert json.loads(res_dup.data)["error_code"] == "DUPLICATE_BOOKING"
        logger.info("✅ TEST 6 PASSED: Duplicate booking prevention verified.")

        # TEST 7: Customer Phone Auto-Lookup
        res_lookup = client.get(f"/api/v1/public/booking/1/customer-lookup?phone={phone_tok}")
        assert res_lookup.status_code == 200
        l_data = json.loads(res_lookup.data)["data"]
        assert l_data["found"] is True
        assert l_data["first_name"] == "Divya"
        logger.info("✅ TEST 7 PASSED: Customer Phone Auto-Lookup verified.")

        # TEST 8: Time Slot Mode Test & Break Time Exclusion
        s1.booking_type = "Slot"
        db.session.commit()

        res_slots = client.get(f"/api/v1/public/booking/1/slots?date={test_date}")
        assert res_slots.status_code == 200
        slots_data = json.loads(res_slots.data)["data"]
        assert slots_data["booking_type"] == "Slot"
        assert len(slots_data["slots"]) > 0
        
        # Verify break time slots are marked unavailable
        break_slots = [s for s in slots_data["slots"] if s["time"] in ["13:00", "13:30"]]
        for bs in break_slots:
            assert bs["available"] is False
            assert bs["reason"] == "Break time"
        logger.info("✅ TEST 8 PASSED: Time Slot generation & break time exclusion verified.")

        # TEST 9: Time Slot Booking Creation (No token_number, start_time & end_time populated)
        phone_slot = f"97{random.randint(10000000, 99999999)}"
        slot_payload = {
            "customer_name": "Rohan Patel",
            "customer_phone": phone_slot,
            "appointment_date": test_date,
            "start_time": "10:00",
            "booking_source": "Website Slot",
            "booking_channel": "Website",
            "items": [{"service_id": srv1.id}]
        }
        res_slot_book = client.post("/api/v1/public/booking/1", json=slot_payload)
        assert res_slot_book.status_code == 201
        slot_res_data = json.loads(res_slot_book.data)["data"]
        assert slot_res_data["start_time"] == "10:00"
        assert slot_res_data["end_time"] == "10:45"
        assert slot_res_data["token_number"] is None
        logger.info("✅ TEST 9 PASSED: Website Time Slot Booking created with start_time and calculated end_time (10:00 - 10:45).")

        # TEST 10: Multi-Tenant Data Isolation Test
        res_t2_services = client.get("/api/v1/public/booking/2/services")
        assert res_t2_services.status_code == 200
        t2_srv = json.loads(res_t2_services.data)["data"]
        assert all(s["id"] != srv1.id for s in t2_srv)
        logger.info("✅ TEST 10 PASSED: Tenant data isolation strictly maintained.")

        # TEST 11: Dynamic Booking Mode Switching (Token <-> Slot)
        # Switch to Token
        s1.booking_type = "Token"
        db.session.commit()
        res_cfg_tok = client.get("/api/v1/public/booking/1/config")
        assert json.loads(res_cfg_tok.data)["data"]["booking_type"] == "Token"
        res_slots_tok = client.get(f"/api/v1/public/booking/1/slots?date={test_date}")
        assert json.loads(res_slots_tok.data)["data"]["booking_type"] == "Token"

        # Switch to Slot
        s1.booking_type = "Slot"
        db.session.commit()
        res_cfg_slot = client.get("/api/v1/public/booking/1/config")
        assert json.loads(res_cfg_slot.data)["data"]["booking_type"] == "Slot"
        res_slots_slot = client.get(f"/api/v1/public/booking/1/slots?date={test_date}")
        assert json.loads(res_slots_slot.data)["data"]["booking_type"] == "Slot"
        logger.info("✅ TEST 11 PASSED: Dynamic Booking Mode Switching (Token <-> Slot) verified.")

        # TEST 12: Null Payload Fields Safety
        phone_null_test = f"96{random.randint(10000000, 99999999)}"
        null_payload = {
            "customer_name": "Meera Joshi",
            "customer_phone": phone_null_test,
            "customer_email": None,
            "gender": None,
            "appointment_date": test_date,
            "start_time": "14:30",
            "token_number": None,
            "booking_source": None,
            "booking_channel": None,
            "notes": None,
            "items": [{"service_id": srv1.id}]
        }
        res_null = client.post("/api/v1/public/booking/lotus-beauty-parlour-1", json=null_payload)
        assert res_null.status_code == 201, f"Null payload booking failed: {res_null.data}"
        logger.info("✅ TEST 12 PASSED: Null payload field safety (no NoneType strip error) verified.")

        # TEST 13: Shared Manual Booking Compatibility Test
        phone_manual = f"95{random.randint(10000000, 99999999)}"
        manual_payload = {
            "customer_name": "Pooja Hegde",
            "customer_phone": phone_manual,
            "customer_email": "pooja@example.com",
            "gender": "Female",
            "appointment_date": test_date,
            "start_time": "16:30",
            "booking_source": "Walk-in",
            "booking_channel": "Phone/Walk-in",
            "appointment_type": "Regular",
            "notes": "Walk-in hair cut appointment",
            "items": [{"service_id": srv1.id}]
        }
        ok, m_res, m_status = BookingService.validate_and_create_appointment(
            tenant_id=1,
            payload=manual_payload,
            booking_source="Walk-in",
            default_channel="Walk-in"
        )
        assert ok is True, f"Manual booking creation via shared service failed: {m_res}"
        assert m_res["customer_name"] == "Pooja Hegde"
        logger.info("✅ TEST 13 PASSED: Shared Manual Booking compatibility verified 100%.")

        # TEST 14: Allow Staff Selection Persistence - ON Case
        s1.allow_staff_selection = True
        db.session.commit()
        res_cfg_on = client.get("/api/v1/public/booking/1/config")
        assert json.loads(res_cfg_on.data)["data"]["allow_staff_selection"] is True
        res_staff_on = client.get("/api/v1/public/booking/1/staff")
        assert len(json.loads(res_staff_on.data)["data"]) > 0
        logger.info("✅ TEST 14 PASSED: Allow Staff Selection = True persists in DB & Public Config API.")

        # TEST 15: Allow Staff Selection Persistence - OFF Case
        s1.allow_staff_selection = False
        db.session.commit()
        res_cfg_off = client.get("/api/v1/public/booking/1/config")
        assert json.loads(res_cfg_off.data)["data"]["allow_staff_selection"] is False
        res_staff_off = client.get("/api/v1/public/booking/1/staff")
        assert len(json.loads(res_staff_off.data)["data"]) == 0
        logger.info("✅ TEST 15 PASSED: Allow Staff Selection = False persists in DB & returns empty staff list.")

        logger.info("=== ALL PHASE 3 VERIFICATION TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    test_phase3_end_to_end()
