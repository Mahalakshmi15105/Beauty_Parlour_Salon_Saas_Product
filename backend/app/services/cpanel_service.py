import os
import logging
import requests
import urllib3

# Suppress insecure HTTPS warnings when connecting to local cPanel over HTTPS (port 2083)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger(__name__)

class CPanelService:
    def __init__(self):
        self.enabled = os.getenv("CPANEL_ENABLED", "true").lower() in ("true", "1", "yes")
        self.host = os.getenv("CPANEL_HOST", "127.0.0.1")
        self.port = int(os.getenv("CPANEL_PORT", 2083))
        self.username = os.getenv("CPANEL_USERNAME", "smartgo1")
        self.token = os.getenv("CPANEL_API_TOKEN", "OR8KQ13H2UONFQXJPIM5ON33M1VLNANL")
        self.base_url = f"https://{self.host}:{self.port}/execute"

    def is_configured(self) -> bool:
        return bool(self.enabled and self.username and self.token)

    def create_database(self, db_name: str, db_user: str = None) -> bool:
        """
        Creates a MySQL database using cPanel UAPI and assigns user privileges.
        
        cPanel automatically prefixes database names and user names with the cPanel username
        (e.g., username 'smartgo1' + database name 'tenant_barber_1' => 'smartgo1_tenant_barber_1').
        """
        if not self.is_configured():
            logger.info("[cPanel API] cPanel integration disabled or token unconfigured.")
            return False

        prefix = f"{self.username}_"
        # If db_name starts with 'smartgo1_', strip prefix for the cPanel API 'name' parameter
        short_name = db_name[len(prefix):] if db_name.startswith(prefix) else db_name
        full_db_name = db_name if db_name.startswith(prefix) else f"{prefix}{db_name}"

        headers = {
            "Authorization": f"cpanel {self.username}:{self.token}"
        }

        success = True

        # 1. Create MySQL Database via cPanel UAPI
        create_url = f"{self.base_url}/Mysql/create_database"
        try:
            logger.info(f"[cPanel API] Requesting creation of database '{full_db_name}'...")
            response = requests.post(
                create_url,
                headers=headers,
                data={"name": full_db_name},
                verify=False,
                timeout=20
            )
            res_json = response.json()
            if res_json.get("status") == 1:
                logger.info(f"[cPanel API] Successfully created database '{full_db_name}' via cPanel UAPI.")
            else:
                # Fallback: try short_name if full_db_name was rejected
                response_short = requests.post(
                    create_url,
                    headers=headers,
                    data={"name": short_name},
                    verify=False,
                    timeout=20
                )
                res_short_json = response_short.json()
                if res_short_json.get("status") == 1:
                    logger.info(f"[cPanel API] Successfully created database '{full_db_name}' using short name.")
                else:
                    errors = res_json.get("errors", []) or res_short_json.get("errors", [])
                    logger.warning(f"[cPanel API] create_database status {res_json.get('status')}: {errors}")
        except Exception as e:
            logger.error(f"[cPanel API] Failed to invoke create_database: {e}")
            success = False

        # 2. Grant User Privileges on Database via cPanel UAPI
        target_user = db_user or self.username
        if target_user == "root":
            target_user = "smartgo1_salon_user"
        full_user_name = target_user if target_user.startswith(prefix) else f"{prefix}{target_user}"

        priv_url = f"{self.base_url}/Mysql/set_privileges_on_database"
        try:
            logger.info(f"[cPanel API] Setting ALL PRIVILEGES on '{full_db_name}' for user '{full_user_name}'...")
            res_priv = requests.post(
                priv_url,
                headers=headers,
                data={
                    "user": full_user_name,
                    "database": full_db_name,
                    "privileges": "ALL PRIVILEGES"
                },
                verify=False,
                timeout=20
            )
            priv_json = res_priv.json()
            if priv_json.get("status") == 1:
                logger.info(f"[cPanel API] Successfully set privileges for '{full_user_name}' on '{full_db_name}'.")
            else:
                errors = priv_json.get("errors", [])
                logger.warning(f"[cPanel API] set_privileges_on_database status {priv_json.get('status')}: {errors}")
        except Exception as e:
            logger.error(f"[cPanel API] Failed to set privileges: {e}")
            success = False

        return success

cpanel_service = CPanelService()
