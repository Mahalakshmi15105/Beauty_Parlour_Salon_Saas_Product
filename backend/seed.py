from flask import g, current_app
from sqlalchemy import create_engine
from app.database import db, master_metadata, tenant_metadata
from app.models.global_models import SubscriptionPlan, Tenant, TenantLookup, MasterUser
from app.models.user import User, TenantSetting
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.catalog import ServiceCategory, Service, Product
from app.models.membership import MembershipPlan, CustomerMembership, MembershipBenefit, MembershipPlanService
from app.db_bootstrap import ensure_database_exists
from datetime import date, datetime, timedelta
import json
from decimal import Decimal

def seed_database():
    """Seed the database with default data.
    - Master models -> parlour_master DB
    - Operational models -> tenant DB
    """
    app = current_app._get_current_object()

    with app.app_context():
        g.use_master_db = True

        # 1. Create Default Subscription Plan in Master DB
        plan = SubscriptionPlan.query.filter_by(name="Standard Business Plan").first()
        if not plan:
            plan = SubscriptionPlan(
                name="Standard Business Plan",
                price=2999.00,
                duration_days=365,
                max_employees=15,
                max_services=100,
                max_customers=1000,
                max_branches=3
            )
            db.session.add(plan)
            db.session.commit()
            print("Standard Business Plan created in Master DB.")

        # 2. Create Super Admin User in Master DB
        super_admin = MasterUser.query.filter_by(email="superadmin@smartgonext.com").first()
        if not super_admin:
            super_admin = MasterUser(
                email="superadmin@smartgonext.com",
                role="SuperAdmin",
                status="active"
            )
            super_admin.set_password("SuperAdmin123!")
            db.session.add(super_admin)
            db.session.commit()
            print("Super Admin user created in Master DB.")

        # 3. Create Default Beauty Parlour Tenant in Master DB
        tenant = Tenant.query.filter_by(name="SmartGoNext Beauty Salon").first()
        base_uri = app.config.get("MYSQL_BASE_URI", "mysql+pymysql://root:root@localhost:3306/")
        
        if not tenant:
            tenant = Tenant(
                name="SmartGoNext Beauty Salon",
                status="active",
                subscription_plan_id=plan.id
            )
            db.session.add(tenant)
            db.session.flush()
            
            tenant_id = tenant.id
            slug_clean = tenant.slug.replace('-', '_')
            db_name = f"tenant_{slug_clean}_{tenant_id}"
            tenant_db_uri = f"{base_uri}{db_name}?charset=utf8mb4"
            tenant.db_name = db_name
            tenant.db_connection_uri = tenant_db_uri

            lookup = TenantLookup(
                email="admin@smartgonext.com",
                tenant_id=tenant_id,
                db_name=db_name,
                db_connection_uri=tenant_db_uri
            )
            db.session.add(lookup)
            db.session.commit()
            print("SmartGoNext Beauty Salon Tenant & Lookup created in Master DB.")
        else:
            tenant_id = tenant.id
            slug_clean = tenant.slug.replace('-', '_')
            db_name = tenant.db_name or f"tenant_{slug_clean}_{tenant_id}"
            tenant_db_uri = tenant.db_connection_uri or f"{base_uri}{db_name}?charset=utf8mb4"

        # 4. Provision Tenant DB & Schema
        ensure_database_exists(tenant_db_uri)
        tenant_engine = create_engine(tenant_db_uri)
        tenant_metadata.create_all(bind=tenant_engine)

        # 5. Switch to Tenant DB Context
        db.session.remove()
        g.use_master_db = False
        g.tenant_db_uri = tenant_db_uri

        # 6. Seed Parlour Admin User in Tenant DB
        parlour_admin = User.query.filter_by(email="admin@smartgonext.com").first()
        if not parlour_admin:
            parlour_admin = User(
                email="admin@smartgonext.com",
                role="ParlourAdmin",
                status="active",
                tenant_id=tenant_id
            )
            parlour_admin.set_password("ParlourAdmin123!")
            db.session.add(parlour_admin)
            db.session.commit()
            print("Parlour Admin user created in Tenant DB.")

        # 7. Create Default Settings in Tenant DB
        settings = TenantSetting.query.filter_by(tenant_id=tenant_id).first()
        if not settings:
            settings = TenantSetting(
                tenant_id=tenant_id,
                tax_name="GST",
                tax_rate=18.00,
                currency="INR",
                receipt_header="Welcome to SmartGoNext Beauty Salon!",
                receipt_footer="Thank you for visiting us. Have a wonderful day!",
                booking_enabled=True,
                booking_type="Token",
                allow_staff_selection=False,
                working_days='["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]',
                opening_time="09:00",
                closing_time="20:00",
                break_start_time="13:00",
                break_end_time="14:00",
                booking_interval_minutes=30,
                max_daily_bookings=50,
                max_concurrent_slots=2
            )
            db.session.add(settings)
            db.session.commit()
            print("Default settings created in Tenant DB.")

        # 8. Seed Service Categories & Services
        if ServiceCategory.query.count() == 0:
            print("Seeding service categories and services in Tenant DB...")
            categories_data = {
                "Hair Care": [
                    {"name": "Haircut & Styling", "price": 450.00, "duration": 40},
                    {"name": "Hair Coloring (Global)", "price": 2500.00, "duration": 120},
                    {"name": "Keratin Treatment", "price": 4500.00, "duration": 180},
                    {"name": "Deep Conditioning Spa", "price": 1200.00, "duration": 60}
                ],
                "Skin Care": [
                    {"name": "Hydra Facial", "price": 3000.00, "duration": 75},
                    {"name": "Organic Fruit Clean-up", "price": 800.00, "duration": 45},
                    {"name": "De-Tan Therapy", "price": 600.00, "duration": 30},
                    {"name": "Gold Radiance Facial", "price": 2000.00, "duration": 90}
                ],
                "Makeup & Styling": [
                    {"name": "Bridal Makeup Package", "price": 15000.00, "duration": 240},
                    {"name": "Party Makeup", "price": 3500.00, "duration": 90},
                    {"name": "Saree Draping & Hair Do", "price": 1500.00, "duration": 60}
                ]
            }

            for cat_name, services in categories_data.items():
                category = ServiceCategory(tenant_id=tenant_id, name=cat_name)
                db.session.add(category)
                db.session.flush()

                for s_data in services:
                    service = Service(
                        tenant_id=tenant_id,
                        category_id=category.id,
                        name=s_data["name"],
                        price=s_data["price"],
                        duration_minutes=s_data["duration"]
                    )
                    db.session.add(service)

            db.session.commit()

        # 9. Seed Employees
        if Employee.query.count() == 0:
            print("Seeding employees in Tenant DB...")
            employees_data = [
                {"first": "Ananya", "last": "Sharma", "phone": "9876543210", "spec": "Hair Care", "role": "Senior Stylist"},
                {"first": "Priya", "last": "Patel", "phone": "9876543211", "spec": "Skin Care", "role": "Facial Specialist"},
                {"first": "Sneha", "last": "Reddy", "phone": "9876543212", "spec": "Makeup", "role": "Makeup Artist"}
            ]

            for emp in employees_data:
                e = Employee(
                    tenant_id=tenant_id,
                    first_name=emp["first"],
                    last_name=emp["last"],
                    phone=emp["phone"],
                    specialization=emp["spec"],
                    role=emp["role"],
                    salary=25000.00
                )
                db.session.add(e)
            db.session.commit()

        # 10. Seed Customers
        if Customer.query.count() == 0:
            print("Seeding customers in Tenant DB...")
            customers_data = [
                {"first": "Meera", "last": "Nair", "phone": "9988776655", "email": "meera@example.com"},
                {"first": "Kavya", "last": "Singh", "phone": "9988776656", "email": "kavya@example.com"}
            ]

            for cust in customers_data:
                c = Customer(
                    tenant_id=tenant_id,
                    first_name=cust["first"],
                    last_name=cust["last"],
                    phone=cust["phone"],
                    email=cust["email"]
                )
                db.session.add(c)
            db.session.commit()

        print("DEFAULT DATABASE SEEDING COMPLETED SUCCESSFULLY!")
