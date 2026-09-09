"""
Database Bootstrap
==================
Automatically creates the database (schema/database) if it does not exist.

Supports:
  - MySQL / MariaDB:  connects to the server without a database, runs
                      `CREATE DATABASE IF NOT EXISTS <dbname>`
  - SQLite:           SQLAlchemy creates the file automatically.

This is invoked from `create_app()` BEFORE `db.create_all()`, so the
backend can be started on a completely fresh server without any manual
database setup step.
"""
import re
import logging

from sqlalchemy import create_engine, text

logger = logging.getLogger(__name__)


def sanitize_tenant_uri(tenant_uri: str, master_uri: str) -> str:
    """
    Ensures the tenant connection URI uses the valid credentials from master_uri 
    instead of outdated credentials (e.g. root:root) stored in database rows,
    and enforces the cPanel user prefix (e.g. smartgo1_) on database names.
    """
    if not tenant_uri or not master_uri:
        return tenant_uri
    
    # Extract base prefix (mysql+pymysql://user:pass@host:port/) from master_uri
    m_master = re.match(r"^(mysql\+[a-z0-9]+://[^/]+/).*", master_uri)
    if not m_master:
        return tenant_uri
    base_prefix = m_master.group(1)

    # Extract dbname and parameters from tenant_uri
    m_dbname = re.search(r"/([^/?]+)(\?.*)?$", tenant_uri)
    if not m_dbname:
        return tenant_uri
    dbname = m_dbname.group(1)
    params = m_dbname.group(2) or "?charset=utf8mb4"

    # Enforce cPanel username prefix on database name if configured
    import os
    cpanel_user = os.getenv("CPANEL_USERNAME", "smartgo1")
    if cpanel_user and not dbname.startswith(f"{cpanel_user}_"):
        dbname = f"{cpanel_user}_{dbname}"

    return f"{base_prefix}{dbname}{params}"


def ensure_database_exists(database_uri: str):
    """
    Ensure the target database exists.

    - For MySQL: connect without a database and CREATE DATABASE IF NOT EXISTS.
    - For SQLite: nothing to do (file is auto-created by SQLAlchemy).
    - For Postgres: connect to 'postgres' db and CREATE DATABASE (best-effort).
    """
    if not database_uri:
        return

    # Auto-sanitize database_uri if it contains old root credentials
    try:
        from flask import current_app
        master_uri = current_app.config.get("MASTER_DATABASE_URI") or current_app.config.get("SQLALCHEMY_DATABASE_URI", "")
        if master_uri:
            database_uri = sanitize_tenant_uri(database_uri, master_uri)
    except Exception:
        pass

    # SQLite needs no bootstrap - file is created automatically
    if database_uri.startswith("sqlite"):
        logger.info("SQLite database file will be auto-created by SQLAlchemy.")
        return

    # Parse the URI (handles mysql+pymysql://, postgresql://, etc.)
    match = re.match(
        r"^(?P<dialect>[a-z0-9+]+)://(?:(?P<user>[^:@/]+)(?::(?P<password>[^@/]*))?@)?"
        r"(?P<host>[^:/]+)(?::(?P<port>\d+))?/(?P<dbname>[^?/]+)",
        database_uri,
    )
    if not match:
        logger.warning("Could not parse DATABASE_URL; skipping auto-create.")
        return

    parts = match.groupdict()
    dbname = parts["dbname"]
    user = parts.get("user") or ""
    password = parts.get("password") or ""
    host = parts.get("host") or "localhost"
    port = parts.get("port") or "3306"
    dialect = parts["dialect"]

    # Build an admin URI that connects without selecting the target DB
    if dialect.startswith("mysql"):
        # First attempt via cPanel API if configured (required on shared cPanel hosting)
        try:
            from app.services.cpanel_service import cpanel_service
            if cpanel_service.is_configured():
                cpanel_service.create_database(dbname, user)
        except Exception as cp_err:
            logger.warning(f"[cPanel API] Pre-create attempt notice: {cp_err}")

        admin_uri = f"mysql+pymysql://{user}:{password}@{host}:{port}/"
        create_sql = f"CREATE DATABASE IF NOT EXISTS `{dbname}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    elif dialect.startswith("postgresql"):
        admin_uri = f"postgresql://{user}:{password}@{host}:{port}/postgres"
        create_sql = f"CREATE DATABASE \"{dbname}\";"
    else:
        logger.info(f"Auto-create not implemented for dialect: {dialect}")
        return

    try:
        engine = create_engine(admin_uri, pool_pre_ping=True)
        with engine.connect() as conn:
            conn.execute(text(create_sql))
            conn.commit()
            
            # Ensure missing columns in existing tables are safely patched
            try:
                conn.execute(text("USE `" + dbname + "`;"))
                conn.execute(text("ALTER TABLE customer_memberships ADD COLUMN IF NOT EXISTS renew_count INT NOT NULL DEFAULT 0;"))
                conn.execute(text("ALTER TABLE membership_plan_services ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2) DEFAULT 0.00;"))
                conn.execute(text("ALTER TABLE membership_plan_services ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0.00;"))
                conn.execute(text("ALTER TABLE whatsapp_campaigns ADD COLUMN IF NOT EXISTS template_name VARCHAR(100) NULL;"))
                conn.execute(text("ALTER TABLE whatsapp_campaigns ADD COLUMN IF NOT EXISTS template_params_json TEXT NULL;"))
                conn.execute(text("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS db_name VARCHAR(100) NULL;"))
                conn.execute(text("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS db_connection_uri VARCHAR(255) NULL;"))
                conn.commit()
            except Exception:
                try:
                    conn.execute(text("ALTER TABLE customer_memberships ADD COLUMN renew_count INT NOT NULL DEFAULT 0;"))
                    conn.execute(text("ALTER TABLE membership_plan_services ADD COLUMN discount_percentage DECIMAL(5,2) DEFAULT 0.00;"))
                    conn.execute(text("ALTER TABLE membership_plan_services ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0.00;"))
                    conn.execute(text("ALTER TABLE whatsapp_campaigns ADD COLUMN template_name VARCHAR(100) NULL;"))
                    conn.execute(text("ALTER TABLE whatsapp_campaigns ADD COLUMN template_params_json TEXT NULL;"))
                    conn.execute(text("ALTER TABLE tenants ADD COLUMN db_name VARCHAR(100) NULL;"))
                    conn.execute(text("ALTER TABLE tenants ADD COLUMN db_connection_uri VARCHAR(255) NULL;"))
                    conn.commit()
                except Exception:
                    pass

        logger.info(f"SUCCESS: Database '{dbname}' is ready (auto-created if missing).")
    except Exception as e:
        logger.warning(f"Could not auto-create database '{dbname}': {e}")
        logger.warning("If the database user lacks CREATE privileges, create the database manually.")
    finally:
        try:
            engine.dispose()
        except Exception:
            pass