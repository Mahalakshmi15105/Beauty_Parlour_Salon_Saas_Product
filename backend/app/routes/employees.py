from flask import Blueprint, request, g
from app.database import db
from app.models.employee import Employee
from app.utils.responses import success_response, error_response
from app.utils.auth import require_role, get_tenant_query, get_branch_query
from app.utils.query import paginate_query
import logging
from datetime import datetime

logger = logging.getLogger(__name__)
employees_bp = Blueprint("employees", __name__)

@employees_bp.route("/employees", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin", "Receptionist", "Employee"])
def get_employees():
    q = request.args.get("q", "").strip()
    status = request.args.get("status", "").strip()
    limit = request.args.get("limit", 20)
    cursor = request.args.get("cursor")
    sort = request.args.get("sort", "first_name")

    query = get_branch_query(Employee)

    if q:
        query = query.filter(
            (Employee.first_name.ilike(f"%{q}%")) |
            (Employee.last_name.ilike(f"%{q}%")) |
            (Employee.phone.ilike(f"%{q}%")) |
            (Employee.specialization.ilike(f"%{q}%"))
        )

    if status:
        query = query.filter(Employee.status == status)

    sort_field = "id"
    sort_desc = False
    if sort.startswith("-"):
        sort_field = sort[1:]
        sort_desc = True
    else:
        sort_field = sort

    employees, next_cursor = paginate_query(
        query=query,
        model=Employee,
        limit_val=limit,
        cursor=cursor,
        sort_field=sort_field,
        sort_desc=sort_desc
    )

    from app.models.user import User
    data = []
    for emp in employees:
        u_rec = User.query.filter(
            (User.email == emp.phone) | 
            (User.email == emp.username) |
            (User.email.ilike(f"%{emp.first_name}%"))
        ).filter_by(is_deleted=False).first()
        from app.models.branch import Branch
        br_name = Branch.query.get(emp.branch_id).name if emp.branch_id else "Main Branch"
        data.append({
            "id": emp.id,
            "branch_id": emp.branch_id,
            "branch_name": br_name,
            "first_name": emp.first_name or "",
            "last_name": emp.last_name or "",
            "phone": emp.phone or "",
            "email": emp.email or (u_rec.email if u_rec else "") or emp.username or emp.phone,
            "username": emp.username or (u_rec.email if u_rec else "") or emp.email or emp.phone,
            "password": getattr(emp, "password_plain", None) or emp.phone or "123456",
            "specialization": emp.specialization or "",
            "role": emp.role or "",
            "salary": float(emp.salary or 0.0),
            "target": float(getattr(emp, "target", 0.0) or 0.0),
            "level": getattr(emp, "level", "L1") or "L1",
            "commission_percentage": float(emp.commission_percentage or 0.0),
            "joining_date": emp.joining_date.isoformat() if emp.joining_date else None,
            "shift_start_time": getattr(emp, "shift_start_time", "09:00") or "09:00",
            "shift_end_time": getattr(emp, "shift_end_time", "18:00") or "18:00",
            "monthly_offs": int(getattr(emp, "monthly_offs", 4) or 4),
            "status": emp.status or "active",
            "created_at": emp.created_at.isoformat() if emp.created_at else ""
        })

    return success_response({
        "items": data,
        "next_cursor": next_cursor
    })


@employees_bp.route("/employees/<int:employee_id>", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def get_employee(employee_id):
    employee = get_branch_query(Employee).filter_by(id=employee_id).first()
    if not employee:
        return error_response(
            error_code="EMPLOYEE_NOT_FOUND",
            message="Employee not found or access denied.",
            status_code=404
        )
    from app.models.user import User
    u_rec = User.query.filter(
        (User.email == employee.phone) | 
        (User.email == employee.username) |
        (User.email.ilike(f"%{employee.first_name}%"))
    ).filter_by(is_deleted=False).first()
    return success_response({
        "id": employee.id,
        "first_name": employee.first_name or "",
        "last_name": employee.last_name or "",
        "phone": employee.phone or "",
        "email": employee.email or (u_rec.email if u_rec else "") or employee.username or employee.phone,
        "username": employee.username or (u_rec.email if u_rec else "") or employee.email or employee.phone,
        "password": getattr(employee, "password_plain", None) or employee.phone or "123456",
        "specialization": employee.specialization or "",
        "role": employee.role or "",
        "salary": float(employee.salary or 0.0),
        "target": float(getattr(employee, "target", 0.0) or 0.0),
        "level": getattr(employee, "level", "L1") or "L1",
        "commission_percentage": float(employee.commission_percentage or 0.0),
        "joining_date": employee.joining_date.isoformat() if employee.joining_date else None,
        "shift_start_time": getattr(employee, "shift_start_time", "09:00") or "09:00",
        "shift_end_time": getattr(employee, "shift_end_time", "18:00") or "18:00",
        "status": employee.status or "active",
        "created_at": employee.created_at.isoformat() if employee.created_at else ""
    })


@employees_bp.route("/employees", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def create_employee():
    data = request.get_json() or {}
    first_name = data.get("first_name", "").strip()
    phone = data.get("phone", "").strip()
    salary = data.get("salary")
    target = data.get("target")
    level = data.get("level", "L1")
    commission = data.get("commission_percentage")

    username = (data.get("username") or "").strip().lower()
    password = (data.get("password") or "").strip()

    if not first_name:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="First name is required.",
            status_code=400
        )
    if not phone:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Phone number is required.",
            status_code=400
        )
    if not username:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Login Username / Email is required for employee account.",
            status_code=400
        )
    if not password:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Login Password is required for employee account.",
            status_code=400
        )

    # Validate numbers
    try:
        salary_val = float(salary) if salary not in ("", None) else 0.0
    except (ValueError, TypeError):
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Salary must be a valid number >= 0.",
            status_code=400
        )

    try:
        target_val = float(target) if target not in ("", None) else 0.0
    except (ValueError, TypeError):
        target_val = 0.0

    try:
        comm_val = float(commission) if commission not in ("", None) else 0.0
    except (ValueError, TypeError):
        comm_val = 0.0

    if salary_val < 0 or target_val < 0:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Salary and Target must be >= 0.",
            status_code=400
        )

    if comm_val < 0 or comm_val > 100:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Commission must be between 0 and 100.",
            status_code=400
        )

    # Check phone duplicates
    dup = get_branch_query(Employee).filter_by(phone=phone).first()
    if dup:
        return error_response(
            error_code="DUPLICATE_RECORD",
            message=f"An employee with phone number {phone} already exists.",
            status_code=400
        )

    joining_date = None
    if data.get("joining_date"):
        try:
            joining_date = datetime.strptime(data["joining_date"], "%Y-%m-%d").date()
        except ValueError:
            return error_response(
                error_code="VALIDATION_FAILED",
                message="Joining date must be in YYYY-MM-DD format.",
                status_code=400
            )

    # Determine & validate branch_id
    target_branch_id = None
    if g.role == "BranchAdmin":
        target_branch_id = g.branch_id
    elif data.get("branch_id"):
        try:
            bid = int(data["branch_id"])
            from app.models.branch import Branch
            b_exists = Branch.query.filter_by(id=bid, tenant_id=g.parlour_id, is_deleted=False).first()
            if not b_exists:
                return error_response(
                    error_code="INVALID_BRANCH",
                    message="The specified branch does not belong to your parlour.",
                    status_code=400
                )
            target_branch_id = bid
        except ValueError:
            pass

    try:
        employee = Employee(
            tenant_id=g.parlour_id,
            branch_id=target_branch_id,
            first_name=first_name,
            last_name=data.get("last_name"),
            phone=phone,
            username=username,
            email=data.get("email") or username,
            specialization=data.get("specialization"),
            role=data.get("role"),
            salary=salary_val,
            target=target_val,
            level=str(level or "L1").strip(),
            commission_percentage=comm_val,
            shift_start_time=data.get("shift_start_time", "09:00") or "09:00",
            shift_end_time=data.get("shift_end_time", "18:00") or "18:00",
            monthly_offs=int(data.get("monthly_offs", 4) or 4),
            status=data.get("status", "active")
        )
        if joining_date:
            employee.joining_date = joining_date

        password = data.get("password", "").strip()
        effective_password = password if password else phone
        employee.password_plain = effective_password

        db.session.add(employee)
        db.session.commit()

        # Provision/Link User account with role 'Employee' for authentication
        if username:
            from app.models.user import User
            user_rec = User.query.filter_by(email=username, is_deleted=False).first()
            if not user_rec:
                user_rec = User(
                    tenant_id=g.parlour_id,
                    branch_id=target_branch_id,
                    email=username,
                    role="Employee",
                    status="active"
                )
                user_rec.set_password(effective_password)
            else:
                user_rec.role = "Employee"
                user_rec.branch_id = target_branch_id
                user_rec.status = "active"
                if password:
                    user_rec.set_password(password)

            db.session.add(user_rec)
            db.session.commit()

            # Register TenantLookup in Master DB for this employee login username
            try:
                with db.get_master_engine().connect() as conn:
                    from sqlalchemy import text
                    conn.execute(
                        text("INSERT INTO tenant_lookups (email, tenant_id, created_at, updated_at) VALUES (:e, :t, NOW(), NOW()) ON DUPLICATE KEY UPDATE tenant_id = :t, updated_at = NOW()"),
                        {"e": username, "t": g.parlour_id}
                    )
                    conn.commit()
            except Exception as lookup_err:
                logger.warning(f"TenantLookup notice: {lookup_err}")
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating employee: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message=f"Failed to create employee: {str(e)}",
            status_code=500
        )

    return success_response({
        "id": employee.id,
        "first_name": employee.first_name,
        "phone": employee.phone
    }, 201)


@employees_bp.route("/employees/<int:employee_id>", methods=["PUT"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def update_employee(employee_id):
    employee = get_branch_query(Employee).filter_by(id=employee_id).first()
    if not employee:
        return error_response(
            error_code="EMPLOYEE_NOT_FOUND",
            message="Employee not found or access denied.",
            status_code=404
        )

    data = request.get_json() or {}
    first_name = data.get("first_name", "").strip()
    phone = data.get("phone", "").strip()
    salary = data.get("salary")
    target = data.get("target")
    level = data.get("level", "L1")
    commission = data.get("commission_percentage")

    if not first_name or not phone:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="First name and phone number are required.",
            status_code=400
        )

    try:
        salary_val = float(salary) if salary not in ("", None) else 0.0
    except (ValueError, TypeError):
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Salary must be a valid number >= 0.",
            status_code=400
        )

    try:
        target_val = float(target) if target not in ("", None) else 0.0
    except (ValueError, TypeError):
        target_val = 0.0

    try:
        comm_val = float(commission) if commission not in ("", None) else 0.0
    except (ValueError, TypeError):
        comm_val = 0.0

    if salary_val < 0 or target_val < 0:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Salary and Target must be >= 0.",
            status_code=400
        )

    if comm_val < 0 or comm_val > 100:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Commission must be between 0 and 100.",
            status_code=400
        )

    # Check duplicates
    dup = get_branch_query(Employee).filter(Employee.phone == phone, Employee.id != employee_id).first()
    if dup:
        return error_response(
            error_code="DUPLICATE_RECORD",
            message=f"Another employee with phone number {phone} already exists.",
            status_code=400
        )

    joining_date = None
    if data.get("joining_date"):
        try:
            joining_date = datetime.strptime(data["joining_date"], "%Y-%m-%d").date()
        except ValueError:
            return error_response(
                error_code="VALIDATION_FAILED",
                message="Joining date must be in YYYY-MM-DD format.",
                status_code=400
            )

    if g.role == "ParlourAdmin" and "branch_id" in data:
        bid = data.get("branch_id")
        if bid is None:
            employee.branch_id = None
        else:
            try:
                bid = int(bid)
                from app.models.branch import Branch
                b_exists = Branch.query.filter_by(id=bid, tenant_id=g.parlour_id, is_deleted=False).first()
                if not b_exists:
                    return error_response(
                        error_code="INVALID_BRANCH",
                        message="The specified branch does not belong to your parlour.",
                        status_code=400
                    )
                employee.branch_id = bid
            except ValueError:
                pass

    old_phone = employee.phone
    old_username = employee.username or employee.email or old_phone
    username = (data.get("username") or phone).strip().lower()

    try:
        employee.first_name = first_name
        employee.last_name = data.get("last_name")
        employee.phone = phone
        employee.username = username
        employee.email = data.get("email") or username
        employee.specialization = data.get("specialization")
        employee.role = data.get("role")
        employee.salary = salary_val
        employee.target = target_val
        employee.level = str(level or "L1").strip()
        employee.commission_percentage = comm_val
        if "shift_start_time" in data:
            employee.shift_start_time = data.get("shift_start_time") or "09:00"
        if "shift_end_time" in data:
            employee.shift_end_time = data.get("shift_end_time") or "18:00"
        if "monthly_offs" in data:
            employee.monthly_offs = int(data.get("monthly_offs") or 4)
        employee.status = data.get("status", "active")
        password = data.get("password", "").strip()
        if password:
            employee.password_plain = password

        db.session.commit()

        # Update associated User account if username or password provided
        if username:
            from app.models.user import User
            user_rec = User.query.filter(
                (User.email == old_username) | 
                (User.email == old_phone) |
                (User.email == username) | 
                (User.email == phone)
            ).first()
            if not user_rec:
                user_rec = User(
                    tenant_id=g.parlour_id,
                    branch_id=employee.branch_id,
                    email=username,
                    role="Employee",
                    status="active"
                )
                user_rec.set_password(password or phone)
            else:
                user_rec.email = username
                user_rec.role = "Employee"
                user_rec.branch_id = employee.branch_id
                user_rec.status = "active"
                if password:
                    user_rec.set_password(password)

            db.session.add(user_rec)
            db.session.commit()

            # Sync TenantLookup in Master DB
            try:
                with db.get_master_engine().connect() as conn:
                    from sqlalchemy import text
                    conn.execute(
                        text("INSERT INTO tenant_lookups (email, tenant_id, created_at, updated_at) VALUES (:e, :t, NOW(), NOW()) ON DUPLICATE KEY UPDATE tenant_id = :t, updated_at = NOW()"),
                        {"e": username, "t": g.parlour_id}
                    )
                    conn.commit()
            except Exception as lookup_err:
                logger.warning(f"TenantLookup sync notice: {lookup_err}")
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating employee: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message=f"Failed to update employee: {str(e)}",
            status_code=500
        )

    return success_response({"message": "Employee updated successfully."})


@employees_bp.route("/employees/<int:employee_id>", methods=["DELETE"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def delete_employee(employee_id):
    employee = get_branch_query(Employee).filter_by(id=employee_id).first()
    if not employee:
        return error_response(
            error_code="EMPLOYEE_NOT_FOUND",
            message="Employee not found or access denied.",
            status_code=404
        )

    try:
        emp_phone = (employee.phone or "").strip().lower()
        emp_name = (employee.first_name or "").strip().lower()

        # 1. Clean up attendance records for this employee
        from app.models.attendance import Attendance
        Attendance.query.filter_by(employee_id=employee.id).delete()

        # 2. Update appointments & line items referencing this employee
        from app.models.appointment import Appointment, AppointmentItem
        from app.models.billing import InvoiceLineItem
        try:
            AppointmentItem.query.filter_by(employee_id=employee.id).update({"employee_id": None})
            Appointment.query.filter_by(employee_id=employee.id).update({"employee_id": None})
            InvoiceLineItem.query.filter_by(employee_id=employee.id).update({"employee_id": None})
        except Exception:
            pass

        # 3. Clean up associated User login account in tenant DB and Master DB TenantLookup
        from app.models.user import User
        associated_users = User.query.filter(
            (User.email == emp_phone) | 
            (User.email == emp_name) | 
            (User.email == f"{emp_name}@{emp_name}.com")
        ).all()
        for u in associated_users:
            u_email = u.email
            db.session.delete(u)
            try:
                from sqlalchemy import text
                with db.get_master_engine().begin() as m_conn:
                    m_conn.execute(text("DELETE FROM tenant_lookups WHERE email = :email"), {"email": u_email})
            except Exception:
                pass

        # 4. Permanently delete Employee record from tenant database
        db.session.delete(employee)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error permanently deleting employee: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to delete employee record.",
            status_code=500
        )

    return success_response({"message": "Employee permanently deleted from database."})
