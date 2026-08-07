from app import create_app
from app.database import db
from app.models.global_models import SubscriptionPlan, Tenant
from app.models.user import User, TenantSetting
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.catalog import ServiceCategory, Service, Product
from app.models.membership import MembershipPlan, CustomerMembership, MembershipBenefit, MembershipPlanService
from datetime import date, datetime, timedelta
import json
from decimal import Decimal

app = create_app()

def seed_database():
    with app.app_context():
        # 1. Create Default Subscription Plan
        plan = SubscriptionPlan.query.filter_by(name="Standard Business Plan").first()
        if not plan:
            plan = SubscriptionPlan(
                name="Standard Business Plan",
                price=2999.00,
                duration_days=365,
                max_employees=15,
                max_services=100,
                max_customers=1000
            )
            db.session.add(plan)
            db.session.commit()
            print("Standard Business Plan created.")

        # 2. Create Beauty Parlour Tenant
        tenant = Tenant.query.filter_by(name="SmartGoNext Beauty Salon").first()
        if not tenant:
            tenant = Tenant(
                name="SmartGoNext Beauty Salon",
                status="active",
                subscription_plan_id=plan.id
            )
            db.session.add(tenant)
            db.session.commit()
            print("SmartGoNext Beauty Salon Tenant created.")

        # 3. Create Super Admin User
        super_admin = User.query.filter_by(email="superadmin@smartgonext.com").first()
        if not super_admin:
            super_admin = User(
                email="superadmin@smartgonext.com",
                role="SuperAdmin",
                status="active",
                tenant_id=None
            )
            super_admin.set_password("SuperAdmin123!")
            db.session.add(super_admin)
            print("Super Admin user created.")

        # 4. Create Beauty Parlour Admin User
        parlour_admin = User.query.filter_by(email="admin@smartgonext.com").first()
        if not parlour_admin:
            parlour_admin = User(
                email="admin@smartgonext.com",
                role="ParlourAdmin",
                status="active",
                tenant_id=tenant.id
            )
            parlour_admin.set_password("ParlourAdmin123!")
            db.session.add(parlour_admin)
            print("Parlour Admin user created.")

        # 5. Create Default Settings
        settings = TenantSetting.query.filter_by(tenant_id=tenant.id).first()
        if not settings:
            settings = TenantSetting(
                tenant_id=tenant.id,
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
            print("Default settings created.")

        # 6. Seed Service Categories & Services
        print("Seeding service categories and services...")
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

        services_list = []
        for cat_name, svcs in categories_data.items():
            category = ServiceCategory.query.filter_by(tenant_id=tenant.id, name=cat_name).first()
            if not category:
                category = ServiceCategory(tenant_id=tenant.id, name=cat_name)
                db.session.add(category)
                db.session.flush() # Populate ID

            for s in svcs:
                service = Service.query.filter_by(tenant_id=tenant.id, name=s["name"]).first()
                if not service:
                    service = Service(
                        tenant_id=tenant.id,
                        category_id=category.id,
                        name=s["name"],
                        price=Decimal(str(s["price"])),
                        duration_minutes=s["duration"],
                        status="active",
                        description=f"Premium {s['name']} service tailored for best results."
                    )
                    db.session.add(service)
                    db.session.flush()
                services_list.append(service)
        print("Services & Categories seeded.")

        # 7. Seed Products
        print("Seeding products...")
        products_data = [
            {"name": "L'Oreal Professional Shampoo 300ml", "category": "Hair Care", "sku": "HS-LOR-300", "barcode": "8901526001234", "cost": 450.00, "selling": 650.00, "stock": 25},
            {"name": "Moroccanoil Treatment Oil 100ml", "category": "Hair Care", "sku": "HO-MOR-100", "barcode": "7290011521011", "cost": 2200.00, "selling": 3100.00, "stock": 10},
            {"name": "Cetaphil Gentle Skin Cleanser 250ml", "category": "Skin Care", "sku": "SC-CET-250", "barcode": "3490720002501", "cost": 250.00, "selling": 390.00, "stock": 35},
            {"name": "O3+ Bridal Glow Facial Kit", "category": "Skin Care", "sku": "SC-O3B-KIT", "barcode": "8903426008711", "cost": 1800.00, "selling": 2800.00, "stock": 15},
            {"name": "MAC Prep + Prime Fix+ 100ml", "category": "Makeup & Styling", "sku": "MK-MAC-FIX", "barcode": "7736021234512", "cost": 1400.00, "selling": 2200.00, "stock": 8}
        ]

        for p in products_data:
            product = Product.query.filter_by(tenant_id=tenant.id, sku=p["sku"]).first()
            if not product:
                product = Product(
                    tenant_id=tenant.id,
                    name=p["name"],
                    category=p["category"],
                    sku=p["sku"],
                    barcode=p["barcode"],
                    cost_price=Decimal(str(p["cost"])),
                    selling_price=Decimal(str(p["selling"])),
                    stock_quantity=p["stock"],
                    low_stock_threshold=5,
                    status="active"
                )
                db.session.add(product)
        print("Products seeded.")

        # 8. Seed Employees
        print("Seeding employees...")
        employees_data = [
            {"first_name": "Rohan", "last_name": "Sharma", "phone": "9876543211", "specialization": "Hair Stylist & Keratin Expert", "role": "Senior Stylist", "salary": 25000.00, "commission": 10.0},
            {"first_name": "Ananya", "last_name": "Sen", "phone": "9876543212", "specialization": "Hydra Facial & Skin Care", "role": "Skin Therapist", "salary": 20000.00, "commission": 8.0},
            {"first_name": "Priya", "last_name": "Nair", "phone": "9876543213", "specialization": "Bridal & Party Makeup", "role": "Makeup Artist", "salary": 28000.00, "commission": 15.0}
        ]

        for e in employees_data:
            employee = Employee.query.filter_by(tenant_id=tenant.id, phone=e["phone"]).first()
            if not employee:
                employee = Employee(
                    tenant_id=tenant.id,
                    first_name=e["first_name"],
                    last_name=e["last_name"],
                    phone=e["phone"],
                    specialization=e["specialization"],
                    role=e["role"],
                    salary=Decimal(str(e["salary"])),
                    commission_percentage=Decimal(str(e["commission"])),
                    joining_date=date.today() - timedelta(days=180),
                    status="active"
                )
                db.session.add(employee)
        print("Employees seeded.")

        # 9. Seed Customers
        print("Seeding customers...")
        customers_data = [
            {"first_name": "Kumara", "last_name": "samy", "phone": "9655321915", "email": "kumarasamy@example.com", "gender": "Male", "address": "Sedarapet, Puducherry", "notes": "Regular visitor. Prefers senior stylist Rohan."},
            {"first_name": "Deepika", "last_name": "Padukone", "phone": "9751109239", "email": "deepika@example.com", "gender": "Female", "address": "ECR, Chennai", "notes": "Prefers premium organic skin care treatments."},
            {"first_name": "Aishwarya", "last_name": "Rai", "phone": "9876500123", "email": "aishwarya@example.com", "gender": "Female", "address": "Nungambakkam, Chennai", "notes": "Bridal package subscriber."},
            {"first_name": "Vijay", "last_name": "Chandrasekhar", "phone": "9876500456", "email": "vijay@example.com", "gender": "Male", "address": "Adyar, Chennai", "notes": "Needs haircut reminder every 3 weeks."}
        ]

        seeded_customers = []
        for c in customers_data:
            customer = Customer.query.filter_by(tenant_id=tenant.id, phone=c["phone"]).first()
            if not customer:
                customer = Customer(
                    tenant_id=tenant.id,
                    first_name=c["first_name"],
                    last_name=c["last_name"],
                    phone=c["phone"],
                    email=c["email"],
                    gender=c["gender"],
                    date_of_birth=date.today() - timedelta(days=365 * 30),
                    address=c["address"],
                    notes=c["notes"]
                )
                db.session.add(customer)
                db.session.flush()
            seeded_customers.append(customer)
        print("Customers seeded.")

        # 10. Seed Membership Plans
        print("Seeding membership plans...")
        plans_data = [
            {"name": "Gold Club Membership", "description": "10% off services, 5% off products, valid for 1 year.", "price": 1999.00, "duration": 365, "svc_disc": 10.00, "prod_disc": 5.00},
            {"name": "Platinum Royal Membership", "description": "20% off services, 10% off products, free 5 haircuts, valid for 1 year.", "price": 4999.00, "duration": 365, "svc_disc": 20.00, "prod_disc": 10.00},
            {"name": "Bridal Special Glow Pack", "description": "Complete skin, hair and makeup bridal prep package.", "price": 12000.00, "duration": 90, "svc_disc": 25.00, "prod_disc": 15.00}
        ]

        for p in plans_data:
            m_plan = MembershipPlan.query.filter_by(tenant_id=tenant.id, name=p["name"]).first()
            if not m_plan:
                m_plan = MembershipPlan(
                    tenant_id=tenant.id,
                    name=p["name"],
                    description=p["description"],
                    price=Decimal(str(p["price"])),
                    duration_days=p["duration"],
                    service_discount_percentage=Decimal(str(p["svc_disc"])),
                    product_discount_percentage=Decimal(str(p["prod_disc"])),
                    status="active",
                    day_restrictions=json.dumps(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
                )
                db.session.add(m_plan)
                db.session.flush()

                # Add some eligible services linked to plan
                for svc in services_list[:4]:
                    mps = MembershipPlanService(
                        tenant_id=tenant.id,
                        membership_plan_id=m_plan.id,
                        service_id=svc.id
                    )
                    db.session.add(mps)

                # Link a customer membership to Aishwarya and Deepika for demonstration
                if p["name"] == "Gold Club Membership" and len(seeded_customers) >= 2:
                    cust = seeded_customers[1] # Deepika
                    existing_cm = CustomerMembership.query.filter_by(tenant_id=tenant.id, customer_id=cust.id).first()
                    if not existing_cm:
                        cm = CustomerMembership(
                            tenant_id=tenant.id,
                            customer_id=cust.id,
                            membership_plan_id=m_plan.id,
                            expires_at=datetime.utcnow() + timedelta(days=365),
                            status="active"
                        )
                        db.session.add(cm)
                        db.session.flush()

                        # Add benefits
                        benefit = MembershipBenefit(
                            tenant_id=tenant.id,
                            customer_membership_id=cm.id,
                            service_id=services_list[0].id,
                            total_quantity=5,
                            remaining_quantity=5
                        )
                        db.session.add(benefit)

                if p["name"] == "Platinum Royal Membership" and len(seeded_customers) >= 3:
                    cust = seeded_customers[2] # Aishwarya
                    existing_cm = CustomerMembership.query.filter_by(tenant_id=tenant.id, customer_id=cust.id).first()
                    if not existing_cm:
                        cm = CustomerMembership(
                            tenant_id=tenant.id,
                            customer_id=cust.id,
                            membership_plan_id=m_plan.id,
                            expires_at=datetime.utcnow() + timedelta(days=365),
                            status="active"
                        )
                        db.session.add(cm)
                        db.session.flush()

                        # Add benefits
                        benefit1 = MembershipBenefit(
                            tenant_id=tenant.id,
                            customer_membership_id=cm.id,
                            service_id=services_list[0].id,
                            total_quantity=10,
                            remaining_quantity=8
                        )
                        benefit2 = MembershipBenefit(
                            tenant_id=tenant.id,
                            customer_membership_id=cm.id,
                            service_id=services_list[4].id,
                            total_quantity=3,
                            remaining_quantity=3
                        )
                        db.session.add(benefit1)
                        db.session.add(benefit2)

        db.session.commit()
        print("Database seeding completed successfully.")

if __name__ == "__main__":
    seed_database()
