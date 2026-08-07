import json
import logging
from datetime import datetime, time, date, timedelta
from app.database import db
from app.models.appointment import Appointment, AppointmentItem
from app.models.customer import Customer
from app.models.catalog import Service
from app.models.employee import Employee
from app.models.user import TenantSetting
from app.models.global_models import Tenant

logger = logging.getLogger(__name__)

def _clean_str(val, default=""):
    if val is None:
        return default
    return str(val).strip()

class BookingService:

    @staticmethod
    def get_tenant_settings(tenant_id):
        """Fetch or create TenantSetting for tenant_id."""
        settings = TenantSetting.query.filter_by(tenant_id=tenant_id).first()
        if not settings:
            settings = TenantSetting(tenant_id=tenant_id)
            db.session.add(settings)
            db.session.commit()
        return settings

    @staticmethod
    def is_working_day(settings, target_date):
        """Check if target_date falls on an enabled working day for the parlour."""
        day_name = target_date.strftime("%A").strip().lower()
        working_days = []
        if settings.working_days:
            try:
                raw_days = json.loads(settings.working_days)
                if isinstance(raw_days, list):
                    working_days = [_clean_str(d).lower() for d in raw_days]
            except Exception:
                working_days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        
        if working_days and day_name not in working_days:
            return False, f"The parlour is closed on {target_date.strftime('%A')}s."
        return True, ""

    @staticmethod
    def get_available_slots(tenant_id, date_str, employee_id=None, booking_type_override=None):
        """
        Generate available tokens or time slots for a given tenant and date.
        """
        date_str = _clean_str(date_str)
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return False, "Invalid date format. Use YYYY-MM-DD.", 400

        settings = BookingService.get_tenant_settings(tenant_id)
        booking_type = booking_type_override or settings.booking_type or "Token"

        # 1. Check if parlour is open on that day
        is_open, open_msg = BookingService.is_working_day(settings, target_date)
        if not is_open:
            return True, {
                "booking_type": booking_type,
                "is_open": False,
                "message": open_msg,
                "slots": [],
                "tokens": []
            }, 200

        # Fetch existing non-cancelled bookings for this date and tenant
        existing_bookings = Appointment.query.filter(
            Appointment.tenant_id == tenant_id,
            Appointment.appointment_date == target_date,
            Appointment.status != "Cancelled",
            Appointment.is_deleted == False if hasattr(Appointment, "is_deleted") else True
        ).all()

        max_daily = settings.max_daily_bookings or 50

        if booking_type == "Token":
            # Generate Tokens
            booked_token_numbers = set(b.token_number for b in existing_bookings if b.token_number)
            tokens = []
            for i in range(1, max_daily + 1):
                is_available = i not in booked_token_numbers
                tokens.append({
                    "token_number": i,
                    "available": is_available
                })
            
            return True, {
                "booking_type": "Token",
                "is_open": True,
                "max_daily_bookings": max_daily,
                "tokens": tokens
            }, 200

        else:
            # Slot Booking Mode
            interval = settings.booking_interval_minutes or 30
            open_time = datetime.strptime(settings.opening_time or "09:00", "%H:%M").time()
            close_time = datetime.strptime(settings.closing_time or "20:00", "%H:%M").time()
            
            break_start = None
            break_end = None
            if settings.break_start_time and settings.break_end_time:
                try:
                    break_start = datetime.strptime(settings.break_start_time, "%H:%M").time()
                    break_end = datetime.strptime(settings.break_end_time, "%H:%M").time()
                except ValueError:
                    pass

            max_concurrent = settings.max_concurrent_slots or 2

            # Check existing staff conflicts if employee_id specified
            employee_busy_times = set()
            if employee_id:
                busy_items = AppointmentItem.query.join(Appointment).filter(
                    AppointmentItem.tenant_id == tenant_id,
                    AppointmentItem.employee_id == employee_id,
                    Appointment.appointment_date == target_date,
                    Appointment.status.in_(["Booked", "Waiting", "In Service"])
                ).all()
                for bi in busy_items:
                    if bi.appointment and bi.appointment.start_time:
                        employee_busy_times.add(bi.appointment.start_time.strftime("%H:%M"))

            slots = []
            curr_dt = datetime.combine(target_date, open_time)
            end_dt = datetime.combine(target_date, close_time)
            now = datetime.now()

            while curr_dt < end_dt:
                slot_time = curr_dt.time()
                slot_time_str = slot_time.strftime("%H:%M")
                slot_time_12h = slot_time.strftime("%I:%M %p")

                available = True
                reason = None

                # Check if slot is in the past (if target_date is today)
                if target_date == now.date() and slot_time < now.time():
                    available = False
                    reason = "Past time slot"

                # Check break time
                elif break_start and break_end and (break_start <= slot_time < break_end):
                    available = False
                    reason = "Break time"

                # Check employee conflict if employee selected
                elif employee_id and slot_time_str in employee_busy_times:
                    available = False
                    reason = "Staff unavailable"

                # Check max concurrent bookings count at this start_time
                else:
                    concurrent_count = sum(1 for b in existing_bookings if b.start_time == slot_time)
                    if concurrent_count >= max_concurrent:
                        available = False
                        reason = "Slot fully booked"

                slots.append({
                    "time": slot_time_str,
                    "time_12h": slot_time_12h,
                    "available": available,
                    "reason": reason
                })

                curr_dt += timedelta(minutes=interval)

            return True, {
                "booking_type": "Slot",
                "is_open": True,
                "max_concurrent_slots": max_concurrent,
                "interval_minutes": interval,
                "slots": slots
            }, 200

    @staticmethod
    def validate_and_create_appointment(tenant_id, payload, booking_source="Walk-in", default_channel="Website"):
        """
        Core service to validate rules and persist appointment into database.
        Used by both Admin Manual Booking and Customer Public Website Booking.
        """
        try:
            tenant = Tenant.query.filter_by(id=tenant_id, is_deleted=False).first()
            if not tenant or tenant.status != "active":
                return False, {"error_code": "INVALID_TENANT", "message": "The associated beauty parlour account is inactive or not found."}, 400

            # Required fields validation using safe _clean_str
            customer_name = _clean_str(payload.get("customer_name"))
            customer_phone = _clean_str(payload.get("customer_phone"))
            customer_email = _clean_str(payload.get("customer_email"))
            appointment_date_str = _clean_str(payload.get("appointment_date"))
            start_time_str = _clean_str(payload.get("start_time"))
            booking_type_req = _clean_str(payload.get("booking_type"))
            appointment_type = _clean_str(payload.get("appointment_type"), "Regular") or "Regular"
            notes = _clean_str(payload.get("notes"))
            gender = _clean_str(payload.get("gender"))
            booking_source_final = _clean_str(payload.get("booking_source"), booking_source) or booking_source
            booking_channel_final = _clean_str(payload.get("booking_channel"), default_channel) or default_channel
            items_payload = payload.get("items", [])


            if not customer_name:
                return False, {"error_code": "VALIDATION_FAILED", "message": "Customer Name is required."}, 400
            if not customer_phone:
                return False, {"error_code": "VALIDATION_FAILED", "message": "Customer Phone Number is required."}, 400
            if not appointment_date_str:
                return False, {"error_code": "VALIDATION_FAILED", "message": "Appointment Date is required."}, 400
            if not items_payload or not isinstance(items_payload, list) or len(items_payload) == 0:
                return False, {"error_code": "VALIDATION_FAILED", "message": "At least one Service must be selected for the appointment."}, 400

            # Parse Date
            try:
                appointment_date = datetime.strptime(appointment_date_str, "%Y-%m-%d").date()
            except ValueError:
                return False, {"error_code": "VALIDATION_FAILED", "message": "Invalid Appointment Date format. Use YYYY-MM-DD."}, 400

            settings = BookingService.get_tenant_settings(tenant_id)
            if not settings.booking_enabled:
                return False, {"error_code": "BOOKING_DISABLED", "message": "Online booking is currently disabled for this parlour."}, 400

            active_booking_type = booking_type_req or settings.booking_type or "Token"

            # Parse Time if Slot mode or provided
            start_time_dt = None
            if start_time_str:
                try:
                    start_time_dt = datetime.strptime(start_time_str, "%H:%M").time()
                except ValueError:
                    return False, {"error_code": "VALIDATION_FAILED", "message": "Invalid Appointment Time format. Use HH:MM."}, 400
            elif active_booking_type == "Slot":
                return False, {"error_code": "VALIDATION_FAILED", "message": "Appointment Time is required for Time Slot booking mode."}, 400

            # 1. Working Days Validation
            is_open, open_err = BookingService.is_working_day(settings, appointment_date)
            if not is_open:
                return False, {"error_code": "VALIDATION_FAILED", "message": open_err}, 400

            # 2. Operating Hours & Break Time Validation (if time provided)
            if start_time_dt:
                open_time = datetime.strptime(settings.opening_time or "09:00", "%H:%M").time()
                close_time = datetime.strptime(settings.closing_time or "20:00", "%H:%M").time()
                if start_time_dt < open_time or start_time_dt >= close_time:
                    return False, {"error_code": "VALIDATION_FAILED", "message": f"Appointment time must be between opening time ({settings.opening_time}) and closing time ({settings.closing_time})."}, 400

                if settings.break_start_time and settings.break_end_time:
                    try:
                        break_start = datetime.strptime(settings.break_start_time, "%H:%M").time()
                        break_end = datetime.strptime(settings.break_end_time, "%H:%M").time()
                        if break_start <= start_time_dt < break_end:
                            return False, {"error_code": "VALIDATION_FAILED", "message": f"The parlour is on break between {settings.break_start_time} and {settings.break_end_time}."}, 400
                    except ValueError:
                        pass

            # 3. Duplicate Booking Validation (same customer phone, date, and start time)
            dup_query = Appointment.query.filter(
                Appointment.tenant_id == tenant_id,
                Appointment.customer_phone == customer_phone,
                Appointment.appointment_date == appointment_date,
                Appointment.status != "Cancelled"
            )
            if start_time_dt:
                dup_query = dup_query.filter(Appointment.start_time == start_time_dt)

            existing_duplicate = dup_query.first()
            if existing_duplicate:
                time_info = f" at {start_time_str}" if start_time_str else ""
                return False, {"error_code": "DUPLICATE_BOOKING", "message": f"A booking for {customer_phone} already exists on {appointment_date_str}{time_info}."}, 400

            # 4. Maximum Daily Booking Limit Check
            daily_count = Appointment.query.filter(
                Appointment.tenant_id == tenant_id,
                Appointment.appointment_date == appointment_date,
                Appointment.status != "Cancelled"
            ).count()

            max_daily = settings.max_daily_bookings or 50
            if daily_count >= max_daily:
                return False, {"error_code": "LIMIT_EXCEEDED", "message": f"Maximum daily booking limit ({max_daily}) reached for {appointment_date_str}."}, 400

            # Calculate Total Duration & Total Amount across services
            total_amount = 0.00
            total_duration = 0
            validated_items = []

            for item in items_payload:
                service_id = item.get("service_id")
                employee_id = item.get("employee_id")

                service = Service.query.filter_by(id=service_id, tenant_id=tenant_id, is_deleted=False).first()
                if not service:
                    return False, {"error_code": "VALIDATION_FAILED", "message": f"Selected service (ID: {service_id}) not found."}, 400

                # Employee conflict validation if employee assigned
                if employee_id:
                    employee = Employee.query.filter_by(id=employee_id, tenant_id=tenant_id, is_deleted=False).first()
                    if not employee:
                        return False, {"error_code": "VALIDATION_FAILED", "message": f"Selected staff (ID: {employee_id}) not found."}, 400
                    
                    if start_time_dt:
                        conflict = AppointmentItem.query.join(Appointment).filter(
                            AppointmentItem.tenant_id == tenant_id,
                            AppointmentItem.employee_id == employee_id,
                            Appointment.appointment_date == appointment_date,
                            Appointment.start_time == start_time_dt,
                            Appointment.status.in_(["Booked", "Waiting", "In Service"])
                        ).first()
                        if conflict:
                            return False, {"error_code": "EMPLOYEE_BUSY", "message": f"Staff member {employee.first_name} is already assigned to another appointment at {start_time_str}."}, 400

                item_price = float(service.price or 0.00)
                item_duration = int(service.duration_minutes or 30)

                total_amount += item_price
                total_duration += item_duration

                validated_items.append({
                    "service_id": service.id,
                    "employee_id": employee_id if employee_id else None,
                    "price": item_price,
                    "duration_minutes": item_duration
                })

            # Calculate Token Number if Token mode
            token_number = None
            if active_booking_type == "Token":
                token_number = payload.get("token_number")
                if not token_number:
                    # Auto assign next token number for date
                    existing_tokens = [
                        b.token_number for b in Appointment.query.filter(
                            Appointment.tenant_id == tenant_id,
                            Appointment.appointment_date == appointment_date,
                            Appointment.status != "Cancelled"
                        ).all() if b.token_number
                    ]
                    token_number = (max(existing_tokens) + 1) if existing_tokens else 1

            # Generate Appointment Number: APT-YYYYMMDD-XXX
            today_code = appointment_date.strftime("%Y%m%d")
            seq_count = Appointment.query.filter(
                Appointment.tenant_id == tenant_id,
                Appointment.appointment_date == appointment_date
            ).count() + 1
            appointment_number = f"APT-{today_code}-{seq_count:03d}"

            # Link customer if exists, or create customer record
            customer = Customer.query.filter_by(tenant_id=tenant_id, phone=customer_phone, is_deleted=False).first()
            if not customer:
                name_parts = customer_name.split(" ", 1)
                first_name = name_parts[0]
                last_name = name_parts[1] if len(name_parts) > 1 else ""
                
                customer = Customer(
                    tenant_id=tenant_id,
                    first_name=first_name,
                    last_name=last_name,
                    phone=customer_phone,
                    email=customer_email or None,
                    gender=gender or None
                )
                db.session.add(customer)
                db.session.flush()

            # Calculate end_time if start_time is present
            end_time_dt = None
            if start_time_dt:
                end_datetime = datetime.combine(appointment_date, start_time_dt) + timedelta(minutes=total_duration)
                end_time_dt = end_datetime.time()

            # Create Appointment Record
            appointment = Appointment(
                tenant_id=tenant_id,
                appointment_number=appointment_number,
                customer_id=customer.id if customer else None,
                customer_name=customer_name,
                customer_phone=customer_phone,
                customer_email=customer_email or None,
                appointment_date=appointment_date,
                start_time=start_time_dt,
                end_time=end_time_dt,
                token_number=token_number,
                total_amount=total_amount,
                estimated_duration_minutes=total_duration,
                booking_source=booking_source_final,
                booking_channel=booking_channel_final,
                appointment_type=appointment_type,
                status="Booked",
                notes=notes
            )
            db.session.add(appointment)
            db.session.flush()

            # Create Line Items
            for v_item in validated_items:
                app_item = AppointmentItem(
                    tenant_id=tenant_id,
                    appointment_id=appointment.id,
                    service_id=v_item["service_id"],
                    employee_id=v_item["employee_id"],
                    price=v_item["price"],
                    duration_minutes=v_item["duration_minutes"],
                    status="Booked"
                )
                db.session.add(app_item)

            db.session.commit()
            return True, appointment.to_dict(), 201

        except Exception as e:
            db.session.rollback()
            logger.exception("Failed to create appointment via BookingService")
            return False, {"error_code": "SERVER_ERROR", "message": f"Failed to book appointment: {str(e)}"}, 500
