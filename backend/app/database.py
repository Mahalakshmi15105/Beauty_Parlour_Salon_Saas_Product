import logging
from flask import g, current_app
from flask_sqlalchemy import SQLAlchemy
from flask_sqlalchemy.session import Session as BaseSession
from flask_migrate import Migrate
from sqlalchemy import create_engine, inspect, MetaData

logger = logging.getLogger(__name__)

# Two distinct MetaData collections to isolate Master DB tables from Tenant DB tables
master_metadata = MetaData()
tenant_metadata = MetaData()

class DynamicMultiTenantSession(BaseSession):
    def get_bind(self, mapper=None, clause=None, bind=None, **kwargs):
        if bind is not None:
            return bind
        bind_key = None
        if mapper is not None:
            try:
                insp = inspect(mapper)
                bind_key = getattr(insp, "bind_key", None)
            except Exception:
                pass
        return self._db.get_engine(bind=bind_key)

class MySQLMultiTenantSQLAlchemy(SQLAlchemy):
    """
    SQLAlchemy extension wrapper that dynamically routes session binds
    to either the Master MySQL DB or the active Tenant MySQL DB per request.
    """
    def __init__(self, *args, **kwargs):
        kwargs["session_options"] = kwargs.get("session_options", {})
        kwargs["session_options"]["class_"] = DynamicMultiTenantSession
        super().__init__(*args, **kwargs)
        self._engine_cache = {}

    @property
    def engines(self):
        return {None: self.get_engine(), "master": self.get_master_engine()}

    def get_master_engine(self):
        master_uri = current_app.config.get("MASTER_DATABASE_URI", "mysql+pymysql://root:root@localhost:3306/parlour_master?charset=utf8mb4")
        if "master" not in self._engine_cache:
            logger.info("Connecting to MySQL Master DB...")
            engine = create_engine(
                master_uri,
                pool_pre_ping=True,
                pool_recycle=1800,
                pool_size=10,
                max_overflow=20
            )
            self._engine_cache["master"] = engine
            try:
                master_metadata.create_all(bind=engine)
            except Exception as e:
                logger.warning(f"Notice auto-creating master tables: {e}")
        return self._engine_cache["master"]

    def get_tenant_engine(self, db_uri):
        if not db_uri:
            return self.get_master_engine()
        
        if db_uri not in self._engine_cache:
            logger.info(f"Initializing MySQL connection pool for tenant: {db_uri}")
            engine = create_engine(
                db_uri,
                pool_pre_ping=True,
                pool_recycle=1800,
                pool_size=5,
                max_overflow=10
            )
            self._engine_cache[db_uri] = engine
            try:
                tenant_metadata.create_all(bind=engine)
            except Exception as e:
                logger.warning(f"Notice auto-creating tenant tables for {db_uri}: {e}")
        return self._engine_cache[db_uri]

    def get_engine(self, app=None, bind=None):
        if getattr(g, "use_master_db", False) or bind == "master":
            return self.get_master_engine()
        
        tenant_uri = getattr(g, "tenant_db_uri", None)
        if tenant_uri:
            return self.get_tenant_engine(tenant_uri)
        
        return self.get_master_engine()

    def create_all_master(self):
        """Helper to create only master DB tables."""
        master_engine = self.get_master_engine()
        master_metadata.create_all(bind=master_engine)

    def create_all_tenant(self, tenant_db_uri):
        """Helper to create only tenant DB tables."""
        engine = self.get_tenant_engine(tenant_db_uri)
        tenant_metadata.create_all(bind=engine)

db = MySQLMultiTenantSQLAlchemy()
migrate = Migrate()
