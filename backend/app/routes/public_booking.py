import json
import logging
import re
from flask import Blueprint, request
from app.models.global_models import Tenant
from app.models.catalog import Service
from app.models.employee import Employee
from app.models.customer import Customer
from app.models.user import TenantSetting
from app.models.branch import Branch
from app.services.booking_service import BookingService
from app.utils.responses import success_response, error_response

logger = logging.getLogger(__name__)

public_booking_bp = Blueprint("public_booking", __name__, url_prefix="/api/v1/public/booking")

def resolve_tenant(identifier):
    """
    Resolve tenant by ID or SEO slug.
    Supports formats:
      - "3" (integer ID)
      - "zeros-lan-3" (slug ending with -ID)
      - "zeros-lan" (pure slug matching tenant name)
    """
    from flask import g
    g.use_master_db = True

    tenant = None
    if isinstance(identifier, int):
        tenant = Tenant.query.filter_by(id=identifier, is_deleted=False).first()
    else:
        raw = str(identifier).strip()
        if raw.isdigit():
            tenant = Tenant.query.filter_by(id=int(raw), is_deleted=False).first()
        else:
            match = re.search(r"-(\d+)$", raw)
            if match:
                tid = int(match.group(1))
                tenant = Tenant.query.filter_by(id=tid, is_deleted=False).first()
            if not tenant:
                all_tenants = Tenant.query.filter_by(is_deleted=False).all()
                for t in all_tenants:
                    if t.slug == raw or t.name.lower() == raw.lower():
                        tenant = t
                        break

    if tenant:
        g.use_master_db = False
        g.tenant_db_uri = tenant.db_connection_uri
        g.parlour_id = tenant.id

    return tenant


def resolve_branch(identifier):
    """
    Resolve branch by ID or slug/name for branch-specific booking.
    Supports formats:
      - "3" (integer ID)
      - "branch-3" or "www2-0-3" (slug ending with -ID)
      - "www2-0" or "www2.0" (branch name or slug)
    """
    if isinstance(identifier, int):
        return Branch.query.filter_by(id=identifier, is_deleted=False).first()

    raw = str(identifier).strip()
    if not raw:
        return None

    # 1. Direct Integer check
    if raw.isdigit():
        return Branch.query.filter_by(id=int(raw), is_deleted=False).first()

    # 2. Extract trailing -ID if present (e.g. "branch-3" or "www2-0-3")
    match = re.search(r"-(\d+)$", raw)
    if match:
        bid = int(match.group(1))
        b = Branch.query.filter_by(id=bid, is_deleted=False).first()
        if b:
            return b

    # 3. Match by branch name or normalized slug
    raw_norm = raw.lower().replace("-", "").replace(".", "").replace(" ", "")
    all_branches = Branch.query.filter_by(is_deleted=False).all()
    for b in all_branches:
        b_name_norm = b.name.lower().replace("-", "").replace(".", "").replace(" ", "")
        if b.name.lower() == raw.lower() or b_name_norm == raw_norm:
            return b

    return None


@public_booking_bp.route("/<tenant_identifier>/config", methods=["GET"])
def get_public_booking_config(tenant_identifier):
    """Fetch parlour details & public booking settings for customer portal."""
    try:
        tenant = resolve_tenant(tenant_identifier)
        if not tenant or tenant.status != "active":
            return error_response("INVALID_TENANT", "Parlour not found or account inactive.", 404)

        settings = BookingService.get_tenant_settings(tenant.id)
        
        working_days = []
        if settings.working_days:
            try:
                working_days = json.loads(settings.working_days)
            except Exception:
                working_days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]

        raw_logo = settings.logo_url or ""
        
        theme = {
            "theme_name": getattr(settings, "theme_name", "light"),
            "primary_color": getattr(settings, "primary_color", "#EC4899"),
            "secondary_color": getattr(settings, "secondary_color", "#F472B6"),
            "accent_color": getattr(settings, "accent_color", "#FDF2F8"),
            "shop_name_font_enabled": getattr(settings, "shop_name_font_enabled", False),
            "shop_name_font": getattr(settings, "shop_name_font", "Outfit"),
            "shop_name_font_size": getattr(settings, "shop_name_font_size", 32),
            "shop_name_font_weight": getattr(settings, "shop_name_font_weight", "700"),
            "shop_name_letter_spacing": float(getattr(settings, "shop_name_letter_spacing", 0.00)),
        }

        data = {
            "tenant_id": tenant.id,
            "parlour_name": tenant.name,
            "slug": tenant.slug,
            "booking_url": f"/book/{tenant.slug or tenant.id}",
            "logo_url": raw_logo,
            "owner_name": settings.owner_name or "",
            "phone": settings.alternate_phone or "",
            "address": settings.address or "",
            "city": settings.city or "",
            "state": settings.state or "",
            "postal_code": settings.postal_code or "",
            "currency_symbol": settings.currency_symbol or "₹",
            "booking_enabled": bool(getattr(settings, "booking_enabled", True)),
            "booking_type": getattr(settings, "booking_type", "Token"),
            "allow_staff_selection": bool(getattr(settings, "allow_staff_selection", False)),
            "working_days": working_days,
            "opening_time": getattr(settings, "opening_time", "09:00"),
            "closing_time": getattr(settings, "closing_time", "20:00"),
            "break_start_time": getattr(settings, "break_start_time", "13:00"),
            "break_end_time": getattr(settings, "break_end_time", "14:00"),
            "booking_interval_minutes": getattr(settings, "booking_interval_minutes", 30),
            "max_daily_bookings": getattr(settings, "max_daily_bookings", 50),
            "max_concurrent_slots": getattr(settings, "max_concurrent_slots", 2),
            # Theme settings - scoped to this tenant only
            "theme": theme
        }
        return success_response(data=data)
    except Exception as e:
        logger.exception("Failed to fetch public booking config")
        return error_response("SERVER_ERROR", f"Failed to load parlour config: {str(e)}", 500)


@public_booking_bp.route("/branch/<branch_identifier>/config", methods=["GET"])
def get_branch_booking_config(branch_identifier):
    """Fetch branch-specific booking configuration with isolated theme settings."""
    try:
        branch = resolve_branch(branch_identifier)
        if not branch or branch.status != "active":
            return error_response("INVALID_BRANCH", "Branch not found or inactive.", 404)

        # Get tenant settings first (base configuration)
        tenant_settings = BookingService.get_tenant_settings(branch.tenant_id)
        
        # Get branch-specific settings if they exist
        branch_settings = TenantSetting.query.filter_by(
            tenant_id=branch.tenant_id, 
            branch_id=branch.id
        ).first()

        working_days = []
        if branch_settings and branch_settings.working_days:
            try:
                working_days = json.loads(branch_settings.working_days)
            except Exception:
                working_days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
        elif tenant_settings.working_days:
            try:
                working_days = json.loads(tenant_settings.working_days)
            except Exception:
                working_days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]

        # Use branch-specific logo if available, otherwise tenant logo
        raw_logo = branch.logo_url if branch.logo_url else (tenant_settings.logo_url or "")

        # Determine theme: Branch custom theme -> Main Parlour theme -> System Default
        theme = {
            "theme_name": branch.theme_name or (branch_settings.theme_name if branch_settings and branch_settings.theme_name else getattr(tenant_settings, "theme_name", "light")),
            "primary_color": branch.primary_color or (branch_settings.primary_color if branch_settings and branch_settings.primary_color else getattr(tenant_settings, "primary_color", "#EC4899")),
            "secondary_color": branch.secondary_color or (branch_settings.secondary_color if branch_settings and branch_settings.secondary_color else getattr(tenant_settings, "secondary_color", "#F472B6")),
            "accent_color": branch.accent_color or (branch_settings.accent_color if branch_settings and branch_settings.accent_color else getattr(tenant_settings, "accent_color", "#FDF2F8")),
            "shop_name_font_enabled": getattr(branch_settings, "shop_name_font_enabled", getattr(tenant_settings, "shop_name_font_enabled", False)),
            "shop_name_font": getattr(branch_settings, "shop_name_font", getattr(tenant_settings, "shop_name_font", "Outfit")),
            "shop_name_font_size": getattr(branch_settings, "shop_name_font_size", getattr(tenant_settings, "shop_name_font_size", 32)),
            "shop_name_font_weight": getattr(branch_settings, "shop_name_font_weight", getattr(tenant_settings, "shop_name_font_weight", "700")),
            "shop_name_letter_spacing": float(getattr(branch_settings, "shop_name_letter_spacing", getattr(tenant_settings, "shop_name_letter_spacing", 0.00))),
        }

        # Build clean slug URL for branch
        branch_slug_part = re.sub(r'[^a-zA-Z0-9]', '-', branch.name.lower()).strip('-')
        data = {
            "branch_id": branch.id,
            "tenant_id": branch.tenant_id,
            "branch_name": branch.name,
            "parlour_name": branch.tenant.name,
            "booking_url": f"/book/branch/{branch_slug_part}-{branch.id}",
            "logo_url": raw_logo,
            "owner_name": (branch_settings.owner_name if branch_settings else tenant_settings.owner_name) or "",
            "phone": branch.phone or (tenant_settings.alternate_phone or ""),
            "address": branch.address or (tenant_settings.address or ""),
            "city": (branch_settings.city if branch_settings else tenant_settings.city) or "",
            "state": (branch_settings.state if branch_settings else tenant_settings.state) or "",
            "postal_code": (branch_settings.postal_code if branch_settings else tenant_settings.postal_code) or "",
            "currency_symbol": (branch_settings.currency_symbol if branch_settings else tenant_settings.currency_symbol) or "₹",
            "booking_enabled": bool(getattr(branch_settings, "booking_enabled", getattr(tenant_settings, "booking_enabled", True))),
            "booking_type": getattr(branch_settings, "booking_type", getattr(tenant_settings, "booking_type", "Token")),
            "allow_staff_selection": bool(getattr(branch_settings, "allow_staff_selection", getattr(tenant_settings, "allow_staff_selection", False))),
            "working_days": working_days,
            "opening_time": getattr(branch_settings, "opening_time", getattr(tenant_settings, "opening_time", "09:00")),
            "closing_time": getattr(branch_settings, "closing_time", getattr(tenant_settings, "closing_time", "20:00")),
            "break_start_time": getattr(branch_settings, "break_start_time", getattr(tenant_settings, "break_start_time", "13:00")),
            "break_end_time": getattr(branch_settings, "break_end_time", getattr(tenant_settings, "break_end_time", "14:00")),
            "booking_interval_minutes": getattr(branch_settings, "booking_interval_minutes", getattr(tenant_settings, "booking_interval_minutes", 30)),
            "max_daily_bookings": getattr(branch_settings, "max_daily_bookings", getattr(tenant_settings, "max_daily_bookings", 50)),
            "max_concurrent_slots": getattr(branch_settings, "max_concurrent_slots", getattr(tenant_settings, "max_concurrent_slots", 2)),
            # Branch-isolated theme settings
            "theme": theme
        }
        return success_response(data=data)
    except Exception as e:
        logger.exception("Failed to fetch branch booking config")
        return error_response("SERVER_ERROR", f"Failed to load branch config: {str(e)}", 500)


@public_booking_bp.route("/<tenant_identifier>/services", methods=["GET"])
def get_public_services(tenant_identifier):
    """Fetch active services available for public booking for a tenant."""
    try:
        tenant = resolve_tenant(tenant_identifier)
        if not tenant or tenant.status != "active":
            return error_response("INVALID_TENANT", "Parlour not found or account inactive.", 404)

        services = Service.query.filter_by(tenant_id=tenant.id, status="active", is_deleted=False).all()
        result = []
        for s in services:
            result.append({
                "id": s.id,
                "name": s.name,
                "price": float(s.price or 0.00),
                "duration_minutes": s.duration_minutes or 30,
                "category_id": s.category_id,
                "category_name": s.category.name if s.category else "General",
                "description": s.description or ""
            })
        return success_response(data=result)
    except Exception as e:
        logger.exception("Failed to fetch public services")
        return error_response("SERVER_ERROR", f"Failed to load services: {str(e)}", 500)


@public_booking_bp.route("/<tenant_identifier>/staff", methods=["GET"])
def get_public_staff(tenant_identifier):
    """Fetch active employees available for staff selection."""
    try:
        tenant = resolve_tenant(tenant_identifier)
        if not tenant or tenant.status != "active":
            return error_response("INVALID_TENANT", "Parlour not found or account inactive.", 404)

        settings = BookingService.get_tenant_settings(tenant.id)
        if not settings.allow_staff_selection:
            return success_response(data=[])

        employees = Employee.query.filter_by(tenant_id=tenant.id, status="active", is_deleted=False).all()
        result = []
        for emp in employees:
            result.append({
                "id": emp.id,
                "first_name": emp.first_name,
                "last_name": emp.last_name or "",
                "full_name": f"{emp.first_name} {emp.last_name or ''}".strip(),
                "specialization": emp.specialization or "Stylist",
                "role": emp.role or "Employee"
            })
        return success_response(data=result)
    except Exception as e:
        logger.exception("Failed to fetch public staff")
        return error_response("SERVER_ERROR", f"Failed to load staff: {str(e)}", 500)


@public_booking_bp.route("/<tenant_identifier>/slots", methods=["GET"])
def get_public_available_slots(tenant_identifier):
    """Fetch available tokens or time slots for target date."""
    try:
        tenant = resolve_tenant(tenant_identifier)
        if not tenant or tenant.status != "active":
            return error_response("INVALID_TENANT", "Parlour not found or account inactive.", 404)

        date_str = request.args.get("date", "").strip()
        if not date_str:
            return error_response("VALIDATION_FAILED", "Query parameter 'date' is required.", 400)

        employee_id = request.args.get("employee_id")
        if employee_id:
            try:
                employee_id = int(employee_id)
            except ValueError:
                employee_id = None

        booking_type_override = request.args.get("booking_type", "").strip() or None
        
        branch_id = request.args.get("branch_id")
        if branch_id:
            try:
                branch_id = int(branch_id)
            except ValueError:
                branch_id = None

        ok, result, status_code = BookingService.get_available_slots(
            tenant_id=tenant.id,
            date_str=date_str,
            employee_id=employee_id,
            booking_type_override=booking_type_override,
            branch_id=branch_id
        )

        if not ok:
            return error_response("VALIDATION_FAILED", result, status_code)

        return success_response(data=result)
    except Exception as e:
        logger.exception("Failed to fetch available slots")
        return error_response("SERVER_ERROR", f"Failed to compute availability: {str(e)}", 500)


@public_booking_bp.route("/branch/<branch_identifier>/slots", methods=["GET"])
def get_public_branch_booking_slots(branch_identifier):
    """Compute available tokens/slots for a specific branch."""
    try:
        branch = resolve_branch(branch_identifier)
        if not branch or branch.status != "active":
            return error_response("INVALID_BRANCH", "Branch not found or account inactive.", 404)

        date_str = request.args.get("date", "").strip()
        if not date_str:
            return error_response("VALIDATION_FAILED", "Query parameter 'date' is required.", 400)

        employee_id = request.args.get("employee_id")
        if employee_id:
            try:
                employee_id = int(employee_id)
            except ValueError:
                employee_id = None

        booking_type_override = request.args.get("booking_type", "").strip() or None

        ok, result, status_code = BookingService.get_available_slots(
            tenant_id=branch.tenant_id,
            date_str=date_str,
            employee_id=employee_id,
            booking_type_override=booking_type_override,
            branch_id=branch.id
        )

        if not ok:
            return error_response("VALIDATION_FAILED", result, status_code)

        return success_response(data=result)
    except Exception as e:
        logger.exception("Failed to fetch branch available slots")
        return error_response("SERVER_ERROR", f"Failed to compute branch availability: {str(e)}", 500)


@public_booking_bp.route("/<tenant_identifier>/customer-lookup", methods=["GET"])
def public_customer_lookup(tenant_identifier):
    """Auto-fill customer name and details by phone for public booking form."""
    try:
        tenant = resolve_tenant(tenant_identifier)
        if not tenant or tenant.status != "active":
            return error_response("INVALID_TENANT", "Parlour not found or account inactive.", 404)

        phone = request.args.get("phone", "").strip()
        if not phone:
            return error_response("VALIDATION_FAILED", "Phone number is required", 400)

        customer = Customer.query.filter_by(tenant_id=tenant.id, phone=phone, is_deleted=False).first()
        if not customer:
            return success_response(data={"found": False})

        return success_response(data={
            "found": True,
            "id": customer.id,
            "first_name": customer.first_name,
            "last_name": customer.last_name or "",
            "customer_name": f"{customer.first_name} {customer.last_name or ''}".strip(),
            "phone": customer.phone,
            "email": customer.email or "",
            "gender": customer.gender or ""
        })
    except Exception as e:
        logger.exception("Public customer lookup failed")
        return error_response("SERVER_ERROR", f"Lookup failed: {str(e)}", 500)


@public_booking_bp.route("/<tenant_identifier>", methods=["POST"])
def create_website_booking(tenant_identifier):
    """Public customer website appointment booking endpoint for main parlour."""
    try:
        tenant = resolve_tenant(tenant_identifier)
        if not tenant or tenant.status != "active":
            return error_response("INVALID_TENANT", "Parlour not found or account inactive.", 404)

        payload = request.get_json() or {}
        
        ok, res, status_code = BookingService.validate_and_create_appointment(
            tenant_id=tenant.id,
            payload=payload,
            booking_source=payload.get("booking_source", "Website"),
            default_channel="Website",
            target_branch_id=None
        )

        if not ok:
            return error_response(res.get("error_code", "VALIDATION_FAILED"), res.get("message", "Booking failed"), status_code)

        return success_response(data=res, message=f"Appointment {res.get('appointment_number')} booked successfully!", status_code=status_code)
    except Exception as e:
        logger.exception("Public website booking failed")
        return error_response("SERVER_ERROR", f"Booking request failed: {str(e)}", 500)


@public_booking_bp.route("/branch/<branch_identifier>", methods=["POST"])
def create_branch_website_booking(branch_identifier):
    """Public customer website appointment booking endpoint for a specific branch."""
    try:
        branch = resolve_branch(branch_identifier)
        if not branch or branch.status != "active":
            return error_response("INVALID_BRANCH", "Branch not found or account inactive.", 404)

        payload = request.get_json() or {}
        
        ok, res, status_code = BookingService.validate_and_create_appointment(
            tenant_id=branch.tenant_id,
            payload=payload,
            booking_source=payload.get("booking_source", "Website"),
            default_channel="Website",
            target_branch_id=branch.id
        )

        if not ok:
            return error_response(res.get("error_code", "VALIDATION_FAILED"), res.get("message", "Booking failed"), status_code)

        return success_response(data=res, message=f"Appointment {res.get('appointment_number')} booked successfully for {branch.name}!", status_code=status_code)
    except Exception as e:
        logger.exception("Public branch website booking failed")
        return error_response("SERVER_ERROR", f"Branch booking request failed: {str(e)}", 500)

