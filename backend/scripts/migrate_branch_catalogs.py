import sys
import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app import create_app
from app.database import db
from app.models.branch import Branch
from app.models.catalog import Service, Product, ServiceCategory
from app.models.membership import MembershipPlan

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s in %(module)s: %(message)s")
logger = logging.getLogger("migrate_branch_catalogs")

def run_catalog_copy_migration():
    app = create_app()
    with app.app_context():
        # Get all active tenant DB URIs
        tenant_uris = []
        try:
            with db.get_master_engine().connect() as conn:
                rows = conn.execute(text("SELECT id, name, db_connection_uri FROM tenants WHERE is_deleted = 0")).fetchall()
                for r in rows:
                    tenant_uris.append({"id": r[0], "name": r[1], "uri": r[2]})
        except Exception as err:
            logger.error(f"Failed to fetch tenants from master: {err}")
            return

        logger.info(f"🚀 Starting Branch Catalog Copy Migration across {len(tenant_uris)} tenant(s)...")

        for t in tenant_uris:
            t_id = t["id"]
            t_name = t["name"]
            uri = t["uri"]
            logger.info(f"\n--- Processing Tenant {t_id}: {t_name} ---")

            try:
                engine = create_engine(uri, pool_pre_ping=True)
                Session = sessionmaker(bind=engine)
                session = Session()

                # Add missing branch_id columns safely if missing
                with engine.connect() as conn:
                    for table in ["notifications", "whatsapp_settings", "whatsapp_campaigns"]:
                        try:
                            cols = [c["name"] for c in db.inspect(engine).get_columns(table)]
                            if "branch_id" not in cols:
                                conn.execute(text(f"ALTER TABLE `{table}` ADD COLUMN `branch_id` INT NULL"))
                                conn.commit()
                        except Exception as c_err:
                            logger.warning(f"Column check for {table}: {c_err}")

                # Get all branches for this tenant
                branches = session.query(Branch).filter_by(is_deleted=False).all()
                if not branches:
                    logger.info("  No branches found, skipping.")
                    session.close()
                    continue

                main_branch = next((b for b in branches if b.is_main_branch), branches[0])
                sub_branches = [b for b in branches if b.id != main_branch.id]

                # Update any items with branch_id IS NULL to main_branch.id
                session.query(ServiceCategory).filter(ServiceCategory.branch_id.is_(None)).update({"branch_id": main_branch.id}, synchronize_session=False)
                session.query(Service).filter(Service.branch_id.is_(None)).update({"branch_id": main_branch.id}, synchronize_session=False)
                session.query(Product).filter(Product.branch_id.is_(None)).update({"branch_id": main_branch.id}, synchronize_session=False)
                session.query(MembershipPlan).filter(MembershipPlan.branch_id.is_(None)).update({"branch_id": main_branch.id}, synchronize_session=False)
                session.commit()

                if not sub_branches:
                    logger.info(f"  Only Main Branch exists (ID {main_branch.id}). Updated unassigned items to Main Branch.")
                    session.close()
                    continue

                # Copy Main Branch items to each Sub-Branch if sub-branch has no catalog items yet
                main_cats = session.query(ServiceCategory).filter_by(branch_id=main_branch.id, is_deleted=False).all()
                main_svcs = session.query(Service).filter_by(branch_id=main_branch.id, is_deleted=False).all()
                main_prods = session.query(Product).filter_by(branch_id=main_branch.id, is_deleted=False).all()
                main_plans = session.query(MembershipPlan).filter_by(branch_id=main_branch.id, is_deleted=False).all()

                for sub in sub_branches:
                    logger.info(f"  Duplicating Main Branch catalog to Sub-Branch: {sub.name} (ID {sub.id})...")

                    # Map old category ID -> new category ID
                    cat_map = {}
                    for cat in main_cats:
                        existing = session.query(ServiceCategory).filter_by(branch_id=sub.id, name=cat.name, is_deleted=False).first()
                        if not existing:
                            new_cat = ServiceCategory(
                                tenant_id=t_id,
                                branch_id=sub.id,
                                name=cat.name
                            )
                            session.add(new_cat)
                            session.flush()
                            cat_map[cat.id] = new_cat.id
                        else:
                            cat_map[cat.id] = existing.id

                    # Copy Services
                    for svc in main_svcs:
                        existing = session.query(Service).filter_by(branch_id=sub.id, name=svc.name, is_deleted=False).first()
                        if not existing:
                            new_svc = Service(
                                tenant_id=t_id,
                                branch_id=sub.id,
                                category_id=cat_map.get(svc.category_id),
                                name=svc.name,
                                description=getattr(svc, "description", None),
                                duration_minutes=getattr(svc, "duration_minutes", 30),
                                price=getattr(svc, "price", 0.00),
                                image_url=getattr(svc, "image_url", None),
                                status=getattr(svc, "status", "active")
                            )
                            session.add(new_svc)

                    # Copy Products
                    for prod in main_prods:
                        existing = session.query(Product).filter_by(branch_id=sub.id, name=prod.name, is_deleted=False).first()
                        if not existing:
                            new_prod = Product(
                                tenant_id=t_id,
                                branch_id=sub.id,
                                name=prod.name,
                                category=getattr(prod, "category", None),
                                sku=getattr(prod, "sku", None),
                                barcode=getattr(prod, "barcode", None),
                                selling_price=getattr(prod, "selling_price", 0.00),
                                cost_price=getattr(prod, "cost_price", 0.00),
                                mrp=getattr(prod, "mrp", 0.00),
                                stock_quantity=getattr(prod, "stock_quantity", 0),
                                low_stock_threshold=getattr(prod, "low_stock_threshold", 5),
                                status=getattr(prod, "status", "active")
                            )
                            session.add(new_prod)

                    # Copy Membership Plans
                    for plan in main_plans:
                        existing = session.query(MembershipPlan).filter_by(branch_id=sub.id, name=plan.name, is_deleted=False).first()
                        if not existing:
                            new_plan = MembershipPlan(
                                tenant_id=t_id,
                                branch_id=sub.id,
                                name=plan.name,
                                description=getattr(plan, "description", None),
                                price=getattr(plan, "price", 0.00),
                                duration_days=getattr(plan, "duration_days", 365),
                                service_discount_percentage=getattr(plan, "service_discount_percentage", 0.00),
                                product_discount_percentage=getattr(plan, "product_discount_percentage", 0.00),
                                status=getattr(plan, "status", "active")
                            )
                            session.add(new_plan)

                session.commit()
                logger.info(f"  ✅ Completed catalog duplication for Tenant {t_id}.")
                session.close()

            except Exception as tenant_err:
                logger.error(f"  ❌ Error migrating Tenant {t_id}: {tenant_err}")

        logger.info("\n🎉 BRANCH CATALOG MIGRATION COMPLETED SUCCESSFULLY!")

if __name__ == "__main__":
    run_catalog_copy_migration()
