import json
import logging
import re
from flask import Blueprint, request
from app.models.global_models import Tenant
from app.models.catalog import Service
from app.models.employee import Employee
from app.models.customer import Customer
from app.models.user import TenantSetting
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
    if isinstance(identifier, int):
        return Tenant.query.filter_by(id=identifier, is_deleted=False).first()

    raw = str(identifier).strip()
    if not raw:
        return None

    # 1. Direct Integer check
    if raw.isdigit():
        return Tenant.query.filter_by(id=int(raw), is_deleted=False).first()

    # 2. Extract trailing -ID if present (e.g. "zeros-lan-3")
    match = re.search(r"-(\d+)$", raw)
    if match:
        tid = int(match.group(1))
        t = Tenant.query.filter_by(id=tid, is_deleted=False).first()
        if t:
            return t

    # 3. Match by tenant slug / name
    all_tenants = Tenant.query.filter_by(is_deleted=False).all()
    for t in all_tenants:
        if t.slug == raw or t.name.lower() == raw.lower():
            return t

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

        data = {
            "tenant_id": tenant.id,
            "parlour_name": tenant.name,
            "slug": tenant.slug,
            "booking_url": f"/book/{tenant.slug}-{tenant.id}",
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
        }
        return success_response(data=data)
    except Exception as e:
        logger.exception("Failed to fetch public booking config")
        return error_response("SERVER_ERROR", f"Failed to load parlour config: {str(e)}", 500)


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

        ok, result, status_code = BookingService.get_available_slots(
            tenant_id=tenant.id,
            date_str=date_str,
            employee_id=employee_id,
            booking_type_override=booking_type_override
        )

        if not ok:
            return error_response("VALIDATION_FAILED", result, status_code)

        return success_response(data=result)
    except Exception as e:
        logger.exception("Failed to fetch available slots")
        return error_response("SERVER_ERROR", f"Failed to compute availability: {str(e)}", 500)


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
    """Public customer website appointment booking endpoint."""
    try:
        tenant = resolve_tenant(tenant_identifier)
        if not tenant or tenant.status != "active":
            return error_response("INVALID_TENANT", "Parlour not found or account inactive.", 404)

        payload = request.get_json() or {}
        
        ok, res, status_code = BookingService.validate_and_create_appointment(
            tenant_id=tenant.id,
            payload=payload,
            booking_source=payload.get("booking_source", "Website"),
            default_channel="Website"
        )

        if not ok:
            return error_response(res.get("error_code", "VALIDATION_FAILED"), res.get("message", "Booking failed"), status_code)

        return success_response(data=res, message=f"Appointment {res.get('appointment_number')} booked successfully!", status_code=status_code)
    except Exception as e:
        logger.exception("Public website booking failed")
        return error_response("SERVER_ERROR", f"Booking request failed: {str(e)}", 500)

