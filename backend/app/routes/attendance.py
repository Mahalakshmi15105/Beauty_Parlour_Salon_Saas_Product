import io
import math
from datetime import datetime, date, timedelta
from flask import Blueprint, request, jsonify, send_file, g, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
try:
    import qrcode
except ImportError:
    qrcode = None


from app.database import db
from app.models.branch import Branch
from app.models.employee import Employee
from app.models.attendance import Attendance
from app.models.user import User

from app.utils.auth import require_role

attendance_bp = Blueprint("attendance", __name__, url_prefix="/api/v1/attendance")

def haversine(lat1, lon1, lat2, lon2):
    """Calculate the great circle distance in meters between two points on the earth."""
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return None
    try:
        R = 6371000  # Radius of Earth in meters
        dlat = math.radians(float(lat2) - float(lat1))
        dlon = math.radians(float(lon2) - float(lon1))
        a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(float(lat1))) * math.cos(math.radians(float(lat2))) * math.sin(dlon / 2) ** 2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c
    except Exception:
        return None

@attendance_bp.route("/qr/image", methods=["GET"])
@require_role(["SuperAdmin", "ParlourAdmin", "BranchAdmin", "Employee", "Receptionist"])
def get_branch_qr_image():
    """Generate and return QR code PNG image for a branch check-in."""
    claims = get_jwt()
    tenant_id = claims.get("parlour_id") or claims.get("tenant_id")
    
    arg_b = request.args.get("branch_id")
    if arg_b is not None and str(arg_b).strip() != "":
        try:
            branch_id = int(arg_b)
        except ValueError:
            branch_id = None
    else:
        branch_id = getattr(g, "branch_id", None) or claims.get("branch_id")

    if not branch_id:
        try:
            main_branch = Branch.query.filter_by(is_main_branch=True, is_deleted=False).first()
        except Exception:
            db.session.rollback()
            main_branch = None
        if not main_branch:
            main_branch = Branch.query.filter_by(is_deleted=False).first()
        if main_branch:
            branch_id = main_branch.id

    if not branch_id:
        return jsonify({"message": "Branch ID is required"}), 400

    branch = Branch.query.filter_by(id=branch_id, is_deleted=False).first()
    if not branch:
        return jsonify({"message": "Branch not found"}), 404

    # Target tenant ID
    target_tenant_id = branch.tenant_id or getattr(g, "parlour_id", None) or tenant_id or 1

    # Build check-in URL
    origin = current_app.config.get("FRONTEND_URL", "https://salon.smartgonext.com").rstrip("/")
    checkin_url = f"{origin}/attendance/checkin?branch_id={branch.id}&tenant_id={target_tenant_id}"

    # Generate QR Code image
    png_bytes = None
    try:
        import qrcode
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=4,
        )
        qr.add_data(checkin_url)
        qr.make(fit=True)

        img = qr.make_image(fill_color="#FF4D6D", back_color="white")
        buf = io.BytesIO()
        img.save(buf, "PNG")
        png_bytes = buf.getvalue()
    except Exception as qr_err:
        current_app.logger.warning(f"Local qrcode generation failed: {qr_err}. Attempting remote fallback...")
        import urllib.parse
        import requests
        try:
            encoded_url = urllib.parse.quote(checkin_url)
            qr_res = requests.get(
                f"https://api.qrserver.com/v1/create-qr-code/?size=300x300&data={encoded_url}&color=FF4D6D",
                timeout=5
            )
            if qr_res.status_code == 200:
                png_bytes = qr_res.content
        except Exception as fallback_err:
            current_app.logger.error(f"Fallback QR code generation failed: {fallback_err}")

    if png_bytes:
        from flask import Response
        return Response(
            png_bytes,
            mimetype="image/png",
            headers={
                "Content-Type": "image/png",
                "Content-Disposition": f'inline; filename="branch_{branch.id}_attendance_qr.png"',
                "Cache-Control": "public, max-age=3600"
            }
        )

    return jsonify({"message": "QR code generation failed. Please install 'qrcode' module on server."}), 500



@attendance_bp.route("/auto-scan", methods=["POST"])
@attendance_bp.route("/checkin", methods=["POST"])
@jwt_required()
def employee_auto_scan():
    """Automatic QR scan check-in / check-out handler with strict geofence radius validation."""
    claims = get_jwt()
    identity = get_jwt_identity()
    user_id = int(identity) if identity else None
    tenant_id = claims.get("parlour_id") or claims.get("tenant_id")

    data = request.get_json() or {}
    scanned_branch_id = data.get("branch_id")
    lat = data.get("latitude")
    lng = data.get("longitude")

    branch = None
    if scanned_branch_id:
        try:
            b_id_int = int(scanned_branch_id)
            branch = Branch.query.filter_by(id=b_id_int, is_deleted=False).first()
            if not branch:
                branch = Branch.query.filter_by(id=b_id_int).first()
        except (ValueError, TypeError):
            pass

    # Fallback to main branch or any active branch of tenant if scanned branch ID isn't found
    if not branch:
        branch = Branch.query.filter_by(is_main_branch=True, is_deleted=False).first()
    if not branch:
        branch = Branch.query.filter_by(is_deleted=False).first()
    if not branch:
        branch = Branch.query.first()

    # Ultimate fallback: Auto-create main branch if tenant DB has no branches yet
    if not branch:
        branch = Branch(
            tenant_id=tenant_id or 1,
            name="Main Branch",
            address="Salon Address",
            is_main_branch=True,
            is_active=True
        )
        db.session.add(branch)
        db.session.commit()

    # Find corresponding Employee record for user
    user = User.query.get(user_id) if user_id else None
    employee = None
    if user and user.email:
        u_email = (user.email or "").strip().lower()
        u_prefix = u_email.split("@")[0] if "@" in u_email else u_email
        all_emps = Employee.query.filter_by(is_deleted=False).all()
        for e in all_emps:
            e_name = f"{e.first_name or ''} {e.last_name or ''}".strip().lower()
            e_phone = (e.phone or "").strip().lower()
            e_fn = (e.first_name or "").strip().lower()
            if (e_phone and e_phone in u_email) or (u_email and u_email in e_phone) or (e_fn and e_fn == u_prefix) or (e_name and e_name in u_email):
                employee = e
                break

    if not employee:
        employee = Employee.query.filter_by(is_deleted=False, status="active").first()
    if not employee:
        employee = Employee.query.first()

    # Fallback: Auto-create Employee profile for user if no employee profile exists
    if not employee:
        emp_name = user.email.split("@")[0].title() if (user and user.email) else "Staff"
        employee = Employee(
            tenant_id=tenant_id or 1,
            branch_id=branch.id,
            first_name=emp_name,
            phone=user.email if user else "9999999999",
            role=user.role if user else "Employee",
            status="active"
        )
        db.session.add(employee)
        db.session.commit()

    # Locate today's attendance record for this employee and branch
    today_start = datetime.combine(date.today(), datetime.min.time())
    today_end = datetime.combine(date.today(), datetime.max.time())

    existing = Attendance.query.filter_by(
        employee_id=employee.id,
        branch_id=branch.id
    ).filter(Attendance.timestamp >= today_start, Attendance.timestamp <= today_end).order_by(Attendance.timestamp.desc()).first()

    # Calculate geofence distance
    distance_meters = None
    if branch.latitude is not None and branch.longitude is not None:
        if lat is None or lng is None:
            return jsonify({
                "status": "error",
                "message": "❌ Action Failed: Location access is disabled. Please enable GPS location on your phone."
            }), 400

        distance_meters = haversine(lat, lng, branch.latitude, branch.longitude)

    # 1. ALREADY CHECKED IN AND CHECKED OUT TODAY -> SHOW COMPLETED STATUS
    if existing and existing.check_out_time:
        cin_time = existing.timestamp.strftime("%I:%M %p")
        cout_time = existing.check_out_time.strftime("%I:%M %p")
        return jsonify({
            "status": "completed",
            "message": f"You already checked in today at {cin_time} and checked out at {cout_time} for {branch.name}.",
            "data": {
                "id": existing.id,
                "checkin_time": cin_time,
                "checkout_time": cout_time,
                "branch_name": branch.name,
                "status": existing.status
            }
        }), 200

    # 2. CHECKED IN, BUT NOT CHECKED OUT YET -> AUTOMATIC CHECK-OUT ATTEMPT
    if existing and not existing.check_out_time:
        if branch.latitude is not None and branch.longitude is not None:
            radius = float(branch.geofence_radius_meters or 100)
            if distance_meters is None or distance_meters > radius:
                dist_val = int(round(distance_meters)) if distance_meters is not None else 0
                return jsonify({
                    "status": "error",
                    "message": f"❌ Check-out Failed: You are {dist_val}m away from {branch.name}. You must be within {int(radius)}m to check out."
                }), 400

        now = datetime.utcnow()
        worked_mins = (now - existing.timestamp).total_seconds() / 60.0

        if worked_mins < 30:
            cin_str = existing.timestamp.strftime("%I:%M %p")
            return jsonify({
                "status": "error",
                "message": f"⚠️ Already checked in today at {cin_str}. You cannot check out within 30 minutes of check-in."
            }), 400

        existing.check_out_time = now

        # Auto P vs HP status calculation based on shift duration
        op_mins = parse_time_str(branch.opening_time or "09:00") or (9 * 60)
        cl_mins = parse_time_str(branch.closing_time or "21:00") or (21 * 60)
        expected_duration_mins = max(cl_mins - op_mins, 60)

        worked_mins = (now - existing.timestamp).total_seconds() / 60.0
        if worked_mins >= (0.5 * expected_duration_mins):
            existing.status = "P"
        else:
            existing.status = "HP"

        db.session.commit()

        status_label = "Full Day (Present)" if existing.status == "P" else "Half Day (HP)"
        cout_time = now.strftime("%I:%M %p")
        return jsonify({
            "status": "success",
            "action": "checkout",
            "message": f"✅ Checked out successfully at {branch.name} at {cout_time}. Attendance marked as {status_label}.",
            "data": {
                "id": existing.id,
                "checkout_time": cout_time,
                "branch_name": branch.name,
                "status": existing.status
            }
        }), 200

    # 3. NO ATTENDANCE TODAY YET -> AUTOMATIC CHECK-IN ATTEMPT
    if branch.latitude is not None and branch.longitude is not None:
        radius = float(branch.geofence_radius_meters or 100)
        if distance_meters is None or distance_meters > radius:
            dist_val = int(round(distance_meters)) if distance_meters is not None else 0
            return jsonify({
                "status": "error",
                "message": f"❌ Check-in Failed: You are {dist_val}m away from {branch.name}. You must be within {int(radius)}m to check in."
            }), 400

    now = datetime.utcnow()
    attendance = Attendance(
        tenant_id=tenant_id or 1,
        employee_id=employee.id,
        branch_id=branch.id,
        timestamp=now,
        checkin_method="QR",
        location_flagged=False,
        location_unavailable=False,
        latitude=lat,
        longitude=lng,
        distance_meters=round(distance_meters, 2) if distance_meters is not None else None,
        status="P"
    )

    db.session.add(attendance)
    db.session.commit()

    cin_time = now.strftime("%I:%M %p")
    return jsonify({
        "status": "success",
        "action": "checkin",
        "message": f"✅ Checked in successfully at {branch.name} at {cin_time}.",
        "data": {
            "id": attendance.id,
            "employee_name": f"{employee.first_name} {employee.last_name or ''}".strip(),
            "branch_name": branch.name,
            "timestamp": now.strftime("%Y-%m-%d %I:%M %p"),
            "checkin_time": cin_time,
            "distance_meters": attendance.distance_meters
        }
    }), 201


@attendance_bp.route("", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin", "SuperAdmin", "Receptionist", "Employee"])
def get_attendance_logs():
    """Retrieve tenant & branch-scoped attendance logs for admin reporting."""
    claims = get_jwt()
    role = claims.get("role")
    branch_id = request.args.get("branch_id", type=int)
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    target_b = getattr(g, "branch_id", None) or branch_id or (claims.get("branch_id") if role == "BranchAdmin" else None)

    # Branch RBAC scoping
    if target_b:
        query = query.filter_by(branch_id=target_b)

    if start_date:
        try:
            s_dt = datetime.strptime(start_date, "%Y-%m-%d") - timedelta(days=1)
            query = query.filter(Attendance.timestamp >= s_dt)
        except ValueError:
            pass

    if end_date:
        try:
            e_dt = datetime.strptime(end_date + " 23:59:59", "%Y-%m-%d %H:%M:%S") + timedelta(days=1)
            query = query.filter(Attendance.timestamp <= e_dt)
        except ValueError:
            pass

    try:
        records = query.order_by(Attendance.timestamp.desc()).all()
    except Exception as e:
        db.session.rollback()
        try:
            from app.database import tenant_metadata
            tenant_metadata.create_all(bind=db.session.get_bind())
            records = query.order_by(Attendance.timestamp.desc()).all()
        except Exception:
            return jsonify([]), 200

    result = []
    for att in records:
        emp = Employee.query.get(att.employee_id)
        br = Branch.query.get(att.branch_id)
        home_br = Branch.query.get(emp.branch_id) if (emp and emp.branch_id) else None

        result.append({
            "id": att.id,
            "employee_id": att.employee_id,
            "employee_name": f"{emp.first_name} {emp.last_name or ''}".strip() if emp else "Unknown Staff",
            "employee_phone": emp.phone if emp else "",
            "home_branch_name": home_br.name if home_br else (br.name if br else "Main Parlour"),
            "work_branch_id": att.branch_id,
            "work_branch_name": br.name if br else "Main Parlour",
            "timestamp": att.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "checkin_time": att.timestamp.strftime("%I:%M %p"),
            "checkout_time": att.check_out_time.strftime("%I:%M %p") if att.check_out_time else "-",
            "date": att.timestamp.strftime("%Y-%m-%d"),
            "time": att.timestamp.strftime("%I:%M %p"),
            "checkin_method": att.checkin_method,
            "location_flagged": att.location_flagged,
            "location_unavailable": att.location_unavailable,
            "latitude": float(att.latitude) if att.latitude else None,
            "longitude": float(att.longitude) if att.longitude else None,
            "distance_meters": float(att.distance_meters) if att.distance_meters else None,
            "status": getattr(att, "status", "P") or "P"
        })

    return jsonify({"status": "success", "data": result})


def parse_time_str(time_str):
    """Convert HH:MM string into minutes from midnight."""
    try:
        parts = time_str.strip().split(":")
        return int(parts[0]) * 60 + int(parts[1])
    except Exception:
        return None


@attendance_bp.route("/checkout", methods=["POST"])
@jwt_required()
def employee_checkout():
    """Record employee QR check-out with strict geofence radius validation and auto P/HP calculation."""
    claims = get_jwt()
    identity = get_jwt_identity()
    user_id = int(identity) if identity else None
    tenant_id = claims.get("parlour_id") or claims.get("tenant_id")

    data = request.get_json() or {}
    scanned_branch_id = data.get("branch_id")
    lat = data.get("latitude")
    lng = data.get("longitude")

    if not scanned_branch_id:
        return jsonify({"status": "error", "message": "Branch ID is required from QR scan"}), 400

    branch = Branch.query.filter_by(id=scanned_branch_id).first()
    if not branch:
        return jsonify({"status": "error", "message": "Invalid or inactive parlour branch QR code"}), 404

    user = User.query.get(user_id) if user_id else None
    employee = None
    if user and user.email:
        employee = Employee.query.filter(
            (Employee.phone == user.email) | (Employee.first_name + " " + (Employee.last_name or "") == user.email)
        ).first()

    if not employee:
        employee = Employee.query.first()

    if not employee:
        return jsonify({"status": "error", "message": "No active Employee profile linked to this user account"}), 400

    today_start = datetime.combine(date.today(), datetime.min.time())
    today_end = datetime.combine(date.today(), datetime.max.time())

    attendance = Attendance.query.filter_by(
        employee_id=employee.id,
        branch_id=branch.id
    ).filter(Attendance.timestamp >= today_start, Attendance.timestamp <= today_end).first()

    if not attendance:
        return jsonify({
            "status": "error",
            "message": "❌ Check-out Failed: No check-in record found for today. Please check in first."
        }), 400

    if attendance.check_out_time:
        return jsonify({
            "status": "error",
            "message": f"You have already checked out today at {attendance.check_out_time.strftime('%I:%M %p')}."
        }), 400

    # Strict Geofence Validation
    distance_meters = None
    if branch.latitude is not None and branch.longitude is not None:
        if lat is None or lng is None:
            return jsonify({
                "status": "error",
                "message": "❌ Check-out Failed: Location permissions disabled. Enable location to check out."
            }), 400

        distance_meters = haversine(lat, lng, branch.latitude, branch.longitude)
        radius = branch.geofence_radius_meters or 100

        if distance_meters is None or distance_meters > radius:
            dist_val = int(distance_meters) if distance_meters is not None else 0
            return jsonify({
                "status": "error",
                "message": f"❌ Check-out Failed: You are {dist_val}m away from {branch.name}. Must be within {radius}m to check out."
            }), 400

    # Set check_out_time
    now = datetime.utcnow()
    attendance.check_out_time = now

    # Auto-calculate P vs HP status based on shift duration
    op_mins = parse_time_str(branch.opening_time or "09:00") or (9 * 60)
    cl_mins = parse_time_str(branch.closing_time or "21:00") or (21 * 60)
    expected_duration_mins = max(cl_mins - op_mins, 60)  # at least 1 hour

    worked_seconds = (now - attendance.timestamp).total_seconds()
    worked_mins = worked_seconds / 60.0

    if worked_mins >= (0.5 * expected_duration_mins):
        attendance.status = "P"
    else:
        attendance.status = "HP"

    db.session.commit()

    status_label = "Full Day (Present)" if attendance.status == "P" else "Half Day (HP)"

    return jsonify({
        "status": "success",
        "message": f"✅ Checked out successfully at {now.strftime('%I:%M %p')}. Attendance marked as {status_label}.",
        "data": {
            "id": attendance.id,
            "check_out_time": now.strftime("%Y-%m-%d %I:%M %p"),
            "status": attendance.status
        }
    })


@attendance_bp.route("/<int:attendance_id>/status", methods=["PUT"])
@jwt_required()
def override_attendance_status(attendance_id):
    """Admin endpoint to manually override attendance status (P / HP / OFF)."""
    claims = get_jwt()
    role = claims.get("role")
    if role not in ["ParlourAdmin", "BranchAdmin", "SuperAdmin"]:
        return jsonify({"status": "error", "message": "Unauthorized"}), 403

    data = request.get_json() or {}
    new_status = data.get("status", "").upper()
    if new_status not in ["P", "HP", "OFF"]:
        return jsonify({"status": "error", "message": "Status must be P, HP, or OFF"}), 400

    attendance = Attendance.query.get(attendance_id)
    if not attendance:
        return jsonify({"status": "error", "message": "Attendance record not found"}), 404

    attendance.status = new_status
    db.session.commit()

    return jsonify({"status": "success", "message": f"Attendance status updated to {new_status}"})


@attendance_bp.route("/mark-off", methods=["POST"])
@jwt_required()
def mark_employee_off():
    """Admin endpoint to mark pre-scheduled leave (OFF) for an employee on a specific date."""
    claims = get_jwt()
    role = claims.get("role")
    if role not in ["ParlourAdmin", "BranchAdmin", "SuperAdmin"]:
        return jsonify({"status": "error", "message": "Unauthorized"}), 403

    tenant_id = claims.get("parlour_id") or claims.get("tenant_id")
    data = request.get_json() or {}
    employee_id = data.get("employee_id")
    date_str = data.get("date")

    if not employee_id or not date_str:
        return jsonify({"status": "error", "message": "employee_id and date (YYYY-MM-DD) are required"}), 400

    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"status": "error", "message": "Invalid date format. Use YYYY-MM-DD"}), 400

    employee = Employee.query.get(employee_id)
    if not employee:
        return jsonify({"status": "error", "message": "Employee not found"}), 404

    branch_id = employee.branch_id or getattr(g, "branch_id", 1)

    start_dt = datetime.combine(target_date, datetime.min.time())
    end_dt = datetime.combine(target_date, datetime.max.time())

    existing = Attendance.query.filter_by(
        employee_id=employee_id
    ).filter(Attendance.timestamp >= start_dt, Attendance.timestamp <= end_dt).first()

    if existing:
        existing.status = "OFF"
    else:
        existing = Attendance(
            tenant_id=tenant_id or 1,
            employee_id=employee_id,
            branch_id=branch_id or 1,
            timestamp=start_dt,
            checkin_method="Manual",
            status="OFF"
        )
        db.session.add(existing)

    db.session.commit()
    return jsonify({"status": "success", "message": f"Marked {employee.first_name} as OFF for {date_str}"})


@attendance_bp.route("/manual-checkin", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin", "SuperAdmin", "Receptionist", "Employee"])
def manual_attendance_checkin():
    """Manual Front-Desk Fallback check-in endpoint (for Admins / Receptionists)."""
    claims = get_jwt()
    role = claims.get("role")
    if role not in ["ParlourAdmin", "BranchAdmin", "SuperAdmin", "Receptionist", "Employee"]:
        return jsonify({"status": "error", "message": "Unauthorized"}), 403

    tenant_id = claims.get("parlour_id") or claims.get("tenant_id")
    data = request.get_json() or {}

    employee_id = data.get("employee_id")
    branch_id = data.get("branch_id")
    reason = (data.get("reason") or "Manual Front-Desk Fallback").strip()
    status_type = (data.get("status") or "P").upper()

    action_type = (data.get("action_type") or "checkin").lower()

    if not employee_id:
        return jsonify({"status": "error", "message": "Select an employee to submit manual attendance"}), 400

    try:
        employee_id = int(employee_id)
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "Invalid employee ID"}), 400

    employee = Employee.query.get(employee_id)
    if not employee:
        return jsonify({"status": "error", "message": "Selected employee not found"}), 404

    target_branch_id = getattr(g, "branch_id", None) or branch_id or employee.branch_id or 1
    branch = Branch.query.get(target_branch_id)
    branch_name = branch.name if branch else "Main Branch"

    today_start = datetime.combine(date.today(), datetime.min.time())
    today_end = datetime.combine(date.today(), datetime.max.time())

    # Check any attendance today for this employee across branch or tenant
    existing = Attendance.query.filter_by(
        employee_id=employee.id
    ).filter(Attendance.timestamp >= today_start, Attendance.timestamp <= today_end).order_by(Attendance.timestamp.desc()).first()

    now = datetime.utcnow()
    cin_time = now.strftime("%I:%M %p")

    if action_type == "checkout":
        if not existing:
            return jsonify({
                "status": "error",
                "message": f"❌ Manual Check-Out Failed: {employee.first_name} {employee.last_name or ''} has not checked in today yet."
            }), 400
        if existing.check_out_time:
            return jsonify({
                "status": "error",
                "message": f"⚠️ {employee.first_name} {employee.last_name or ''} has already checked out today at {existing.check_out_time.strftime('%I:%M %p')}."
            }), 400

        existing.check_out_time = now
        existing.status = status_type if status_type in ["P", "HP", "OFF"] else "P"
        db.session.commit()
        cout_time = now.strftime("%I:%M %p")
        return jsonify({
            "status": "success",
            "action": "checkout",
            "message": f"✅ Manual check-out recorded for {employee.first_name} {employee.last_name or ''} at {cout_time}. Audit Reason: {reason}",
            "data": {
                "id": existing.id,
                "employee_name": f"{employee.first_name} {employee.last_name or ''}".strip(),
                "checkout_time": cout_time,
                "status": existing.status
            }
        }), 200

    # Default action_type == "checkin"
    if existing:
        return jsonify({
            "status": "error",
            "message": f"Already put attendance for this employee today ({employee.first_name} {employee.last_name or ''} checked in at {existing.timestamp.strftime('%I:%M %p')})."
        }), 400

    # Create new Manual Check-in
    attendance = Attendance(
        tenant_id=tenant_id or employee.tenant_id or 1,
        employee_id=employee.id,
        branch_id=target_branch_id,
        timestamp=now,
        checkin_method="Manual",
        location_flagged=False,
        location_unavailable=True,
        status=status_type if status_type in ["P", "HP", "OFF"] else "P"
    )
    db.session.add(attendance)
    db.session.commit()

    return jsonify({
        "status": "success",
        "action": "checkin",
        "message": f"✅ Manual check-in submitted for {employee.first_name} {employee.last_name or ''} at {cin_time} ({branch_name}). Audit Reason: {reason}",
        "data": {
            "id": attendance.id,
            "employee_name": f"{employee.first_name} {employee.last_name or ''}".strip(),
            "checkin_time": cin_time,
            "status": attendance.status
        }
    }), 201


