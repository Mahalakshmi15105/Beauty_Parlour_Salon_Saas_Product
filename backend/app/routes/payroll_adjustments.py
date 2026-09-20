from flask import Blueprint, request, g, jsonify
from datetime import datetime, date
from app.database import db
from app.models.payroll_adjustment import PayrollAdjustment
from app.models.employee import Employee
from app.utils.responses import success_response, error_response
from app.utils.auth import require_role, get_branch_query

payroll_adjustments_bp = Blueprint("payroll_adjustments", __name__, url_prefix="/api/v1/payroll-adjustments")

@payroll_adjustments_bp.route("", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin", "Receptionist"])
def get_payroll_adjustments():
    employee_id = request.args.get("employee_id", type=int)
    month = request.args.get("month", type=int)
    year = request.args.get("year", type=int)
    date_str = request.args.get("date")

    query = get_branch_query(PayrollAdjustment)

    if employee_id:
        query = query.filter(PayrollAdjustment.employee_id == employee_id)

    if date_str:
        try:
            d_val = datetime.strptime(date_str, "%Y-%m-%d").date()
            query = query.filter(PayrollAdjustment.date == d_val)
        except ValueError:
            pass

    if month and year:
        query = query.filter(
            db.extract("month", PayrollAdjustment.date) == month,
            db.extract("year", PayrollAdjustment.date) == year
        )

    records = query.order_by(PayrollAdjustment.date.desc(), PayrollAdjustment.id.desc()).all()

    data = []
    for rec in records:
        emp = Employee.query.get(rec.employee_id)
        data.append({
            "id": rec.id,
            "employee_id": rec.employee_id,
            "employee_name": f"{emp.first_name} {emp.last_name or ''}".strip() if emp else "Unknown",
            "type": rec.type,
            "amount": float(rec.amount or 0.0),
            "note": rec.note or "",
            "date": rec.date.isoformat() if rec.date else "",
            "created_at": rec.created_at.isoformat() if rec.created_at else ""
        })

    return success_response({"items": data})


@payroll_adjustments_bp.route("", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def create_payroll_adjustment():
    data = request.get_json() or {}
    employee_id = data.get("employee_id")
    adj_type = data.get("type", "Advance").capitalize()
    amount = data.get("amount")
    note = data.get("note", "").strip()
    date_str = data.get("date")

    if not employee_id:
        return error_response("INVALID_EMPLOYEE", "employee_id is required.", 400)

    if adj_type not in ["Advance", "Deduction"]:
        return error_response("INVALID_TYPE", "Type must be Advance or Deduction.", 400)

    try:
        amt_val = float(amount)
        if amt_val <= 0:
            return error_response("INVALID_AMOUNT", "Amount must be greater than 0.", 400)
    except (ValueError, TypeError):
        return error_response("INVALID_AMOUNT", "Amount must be a valid positive number.", 400)

    adj_date = date.today()
    if date_str:
        try:
            adj_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return error_response("INVALID_DATE", "Date must be YYYY-MM-DD.", 400)

    emp = Employee.query.get(employee_id)
    if not emp:
        return error_response("EMPLOYEE_NOT_FOUND", "Employee not found.", 404)

    record = PayrollAdjustment(
        tenant_id=g.parlour_id,
        employee_id=employee_id,
        type=adj_type,
        amount=amt_val,
        note=note,
        date=adj_date
    )

    db.session.add(record)
    db.session.commit()

    return success_response({
        "id": record.id,
        "employee_id": record.employee_id,
        "type": record.type,
        "amount": float(record.amount),
        "note": record.note,
        "date": record.date.isoformat()
    }, 201)


@payroll_adjustments_bp.route("/<int:adjustment_id>", methods=["DELETE"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def delete_payroll_adjustment(adjustment_id):
    record = get_branch_query(PayrollAdjustment).filter_by(id=adjustment_id).first()
    if not record:
        return error_response("NOT_FOUND", "Payroll adjustment record not found.", 404)

    db.session.delete(record)
    db.session.commit()
    return success_response({"message": "Payroll adjustment record deleted successfully."})
