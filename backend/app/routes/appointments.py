from flask import Blueprint, request, jsonify, g
from app.database import db
from app.models.appointment import Appointment, AppointmentItem
from app.models.customer import Customer
from app.models.catalog import Service
from app.models.user import TenantSetting, User
from app.models.employee import Employee
from app.utils.auth import require_role, get_tenant_query, get_branch_query
from app.utils.responses import success_response, error_response
from datetime import datetime, time
import json

appointments_bp = Blueprint("appointments", __name__, url_prefix="/api/v1/appointments")

@appointments_bp.route("", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin", "Receptionist", "Employee"])
def get_appointments():
    """
    Fetch appointments for current tenant with optional filtering.
    Filters: date, status, booking_source, employee_id, phone, search
    """
    try:
        from sqlalchemy.orm import joinedload
        query = get_branch_query(Appointment).options(joinedload(Appointment.items))
        
        date_str = request.args.get("date")
        if date_str:
            try:
                target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
                query = query.filter(Appointment.appointment_date == target_date)
            except ValueError:
                pass
                
        status = request.args.get("status")
        if status:
            query = query.filter(Appointment.status == status)
            
        booking_source = request.args.get("booking_source")
        if booking_source:
            query = query.filter(Appointment.booking_source == booking_source)
            
        phone = request.args.get("phone")
        if phone:
            query = query.filter(Appointment.customer_phone.like(f"%{phone}%"))

        employee_id = request.args.get("employee_id")
        if employee_id:
            query = query.join(AppointmentItem).filter(AppointmentItem.employee_id == employee_id)
            
        search = request.args.get("search")
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                (Appointment.customer_name.like(search_term)) |
                (Appointment.customer_phone.like(search_term)) |
                (Appointment.appointment_number.like(search_term))
            )
            
        appointments = query.order_by(Appointment.appointment_date.desc(), Appointment.id.desc()).limit(200).all()
        return success_response(data=[app.to_dict() for app in appointments])
    except Exception as e:
        import logging
        logging.exception("Failed to fetch appointments")
        return error_response("SERVER_ERROR", f"Failed to fetch appointments: {str(e)}", 500)


@appointments_bp.route("/customer-lookup", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin", "Receptionist", "Employee"])
def customer_lookup():
    """
    Search customer by phone number and return details, memberships, and visit count.
    """
    try:
        phone = request.args.get("phone", "").strip()
        if not phone:
            return error_response("VALIDATION_FAILED", "Phone number is required", 400)

        customer = get_tenant_query(Customer).filter(Customer.phone == phone).first()
        if not customer:
            return success_response(data={"found": False})

        # Calculate previous visits count (from Invoices + Completed Appointments)
        visit_count = len(customer.invoices or [])
        
        # Check active memberships
        active_memberships = []
        for m in (customer.memberships or []):
            if m.status == "Active":
                active_memberships.append({
                    "id": m.id,
                    "plan_name": m.plan.name if m.plan else "Membership Plan",
                    "expires_at": m.end_date.strftime("%Y-%m-%d") if m.end_date else ""
                })

        data = {
            "found": True,
            "id": customer.id,
            "first_name": customer.first_name,
            "last_name": customer.last_name or "",
            "full_name": f"{customer.first_name} {customer.last_name or ''}".strip(),
            "phone": customer.phone,
            "email": customer.email or "",
            "gender": customer.gender or "",
            "visit_count": visit_count,
            "active_memberships": active_memberships
        }
        return success_response(data=data)
    except Exception as e:
        import logging
        logging.exception("Customer lookup failed")
        return error_response("SERVER_ERROR", f"Customer lookup failed: {str(e)}", 500)


@appointments_bp.route("", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin", "Receptionist", "Employee"])
def create_manual_appointment():
    """
    Create a manual appointment (Phone Call, WhatsApp, Walk-in, Instagram, Facebook).
    Validates working hours, working days, break times, duplicate bookings, and daily limits.
    Enforces branch multi-tenant isolation.
    """
    try:
        payload = request.get_json() or {}
        booking_source = payload.get("booking_source", "Walk-in").strip() or "Walk-in"
        booking_channel = payload.get("booking_channel", "Walk-in").strip() or "Walk-in"

        target_branch_id = None
        if hasattr(g, "branch_id") and g.branch_id:
            target_branch_id = g.branch_id
        elif payload.get("branch_id"):
            try:
                target_branch_id = int(payload["branch_id"])
            except (ValueError, TypeError):
                pass

        from app.services.booking_service import BookingService
        ok, res, status_code = BookingService.validate_and_create_appointment(
            tenant_id=g.parlour_id,
            payload=payload,
            booking_source=booking_source,
            default_channel=booking_channel,
            target_branch_id=target_branch_id
        )

        if not ok:
            return error_response(res.get("error_code", "VALIDATION_FAILED"), res.get("message", "Failed to create appointment."), status_code)

        return success_response(data=res, message=f"Appointment {res.get('appointment_number')} booked successfully.")
    except Exception as e:
        import logging
        logging.exception("Failed to create appointment")
        return error_response("SERVER_ERROR", f"Failed to create appointment: {str(e)}", 500)


@appointments_bp.route("/<int:appointment_id>/status", methods=["PUT"])
@require_role(["ParlourAdmin", "Receptionist", "Employee"])
def update_appointment_status(appointment_id):
    """
    Update appointment lifecycle status (Booked -> Waiting -> In Service -> Completed / Cancelled / No Show).
    """
    try:
        payload = request.get_json() or {}
        new_status = payload.get("status", "").strip()
        allowed_statuses = ["Booked", "Waiting", "In Service", "Completed", "Cancelled", "No Show"]

        if not new_status or new_status not in allowed_statuses:
            return error_response("VALIDATION_FAILED", f"Invalid status. Allowed: {', '.join(allowed_statuses)}", 400)

        appointment = get_branch_query(Appointment).filter(Appointment.id == appointment_id).first()
        if not appointment:
            return error_response("NOT_FOUND", "Appointment not found.", 404)

        appointment.status = new_status
        for item in appointment.items:
            item.status = new_status

        db.session.commit()
        return success_response(data=appointment.to_dict(), message=f"Status updated to '{new_status}'.")
    except Exception as e:
        db.session.rollback()
        return error_response("SERVER_ERROR", f"Failed to update appointment status: {str(e)}", 500)


@appointments_bp.route("/settings", methods=["GET"])
@require_role(["ParlourAdmin", "Receptionist"])
def get_booking_settings():
    """
    Fetch current tenant's booking & appointment configuration.
    """
    try:
        settings = get_tenant_query(TenantSetting).first()
        if not settings:
            settings = TenantSetting(tenant_id=g.parlour_id)
            db.session.add(settings)
            db.session.commit()
            
        working_days = []
        if settings.working_days:
            try:
                working_days = json.loads(settings.working_days)
            except Exception:
                working_days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]

        data = {
            "booking_enabled": bool(getattr(settings, "booking_enabled", True)),
            "booking_type": str(getattr(settings, "booking_type", "Token")),
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
        return error_response("SERVER_ERROR", f"Failed to fetch booking settings: {str(e)}", 500)


@appointments_bp.route("/settings", methods=["PUT"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def update_booking_settings():
    """
    Update tenant's booking & appointment configuration.
    """
    try:
        payload = request.get_json() or {}
        settings = get_tenant_query(TenantSetting).first()
        if not settings:
            settings = TenantSetting(tenant_id=g.parlour_id)
            db.session.add(settings)

        if "booking_enabled" in payload:
            settings.booking_enabled = bool(payload["booking_enabled"])
        if "booking_type" in payload:
            settings.booking_type = str(payload["booking_type"])
        if "allow_staff_selection" in payload:
            settings.allow_staff_selection = bool(payload["allow_staff_selection"])
        if "working_days" in payload:
            settings.working_days = json.dumps(payload["working_days"]) if isinstance(payload["working_days"], list) else str(payload["working_days"])
        if "opening_time" in payload:
            settings.opening_time = str(payload["opening_time"])
        if "closing_time" in payload:
            settings.closing_time = str(payload["closing_time"])
        if "break_start_time" in payload:
            settings.break_start_time = str(payload["break_start_time"])
        if "break_end_time" in payload:
            settings.break_end_time = str(payload["break_end_time"])
        if "booking_interval_minutes" in payload:
            settings.booking_interval_minutes = int(payload["booking_interval_minutes"])
        if "max_daily_bookings" in payload:
            settings.max_daily_bookings = int(payload["max_daily_bookings"])
        if "max_concurrent_slots" in payload:
            settings.max_concurrent_slots = int(payload["max_concurrent_slots"])

        db.session.commit()

        working_days = []
        if settings.working_days:
            try:
                working_days = json.loads(settings.working_days)
            except Exception:
                working_days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]

        updated_data = {
            "booking_enabled": bool(getattr(settings, "booking_enabled", True)),
            "booking_type": str(getattr(settings, "booking_type", "Token")),
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

        return success_response(data=updated_data, message="Booking settings updated successfully")
    except Exception as e:
        db.session.rollback()
        return error_response("SERVER_ERROR", f"Failed to update booking settings: {str(e)}", 500)
