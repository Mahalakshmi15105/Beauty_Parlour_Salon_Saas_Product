import logging
from flask import g, current_app
from flask_sqlalchemy import SQLAlchemy
from flask_sqlalchemy.session import Session as BaseSession
from flask_migrate import Migrate
from sqlalchemy import create_engine, inspect

logger = logging.getLogger(__name__)

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
        """
        Dynamically yield current active engine as default engine to Flask-SQLAlchemy internals.
        """
        return {None: self.get_engine(), "master": self.get_master_engine()}

    def get_master_engine(self):
        master_uri = current_app.config.get("MASTER_DATABASE_URI", "mysql+pymysql://root:root@localhost:3306/parlour_master?charset=utf8mb4")
        if "master" not in self._engine_cache:
            logger.info("Connecting to MySQL Master DB...")
            self._engine_cache["master"] = create_engine(
                master_uri,
                pool_pre_ping=True,
                pool_recycle=1800,
                pool_size=10,
                max_overflow=20
            )
        return self._engine_cache["master"]

    def get_tenant_engine(self, db_uri):
        if not db_uri:
            return self.get_master_engine()
        
        if db_uri not in self._engine_cache:
            logger.info(f"Initializing MySQL connection pool for tenant: {db_uri}")
            self._engine_cache[db_uri] = create_engine(
                db_uri,
                pool_pre_ping=True,
                pool_recycle=1800,
                pool_size=5,
                max_overflow=10
            )
        return self._engine_cache[db_uri]

    def get_engine(self, app=None, bind=None):
        """
        Dynamically return engine based on request context `g`.
        """
        if getattr(g, "use_master_db", False) or bind == "master":
            return self.get_master_engine()
        
        tenant_uri = getattr(g, "tenant_db_uri", None)
        if tenant_uri:
            return self.get_tenant_engine(tenant_uri)
        
        return self.get_master_engine()

db = MySQLMultiTenantSQLAlchemy()
migrate = Migrate()

