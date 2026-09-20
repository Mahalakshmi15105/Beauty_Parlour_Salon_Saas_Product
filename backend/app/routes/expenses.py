from flask import Blueprint, request, g, jsonify
from datetime import datetime, date
from app.database import db
from app.models.expense import Expense
from app.utils.responses import success_response, error_response
from app.utils.auth import require_role, get_branch_query

expenses_bp = Blueprint("expenses", __name__, url_prefix="/api/v1/expenses")

@expenses_bp.route("", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin", "Receptionist"])
def get_expenses():
    branch_id = request.args.get("branch_id", type=int)
    date_str = request.args.get("date")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    query = get_branch_query(Expense).filter_by(is_deleted=False)

    if branch_id:
        query = query.filter(Expense.branch_id == branch_id)

    if date_str:
        try:
            d_val = datetime.strptime(date_str, "%Y-%m-%d").date()
            query = query.filter(Expense.date == d_val)
        except ValueError:
            pass

    if start_date:
        try:
            s_val = datetime.strptime(start_date, "%Y-%m-%d").date()
            query = query.filter(Expense.date >= s_val)
        except ValueError:
            pass

    if end_date:
        try:
            e_val = datetime.strptime(end_date, "%Y-%m-%d").date()
            query = query.filter(Expense.date <= e_val)
        except ValueError:
            pass

    expenses = query.order_by(Expense.date.desc(), Expense.id.desc()).all()

    data = [
        {
            "id": exp.id,
            "branch_id": exp.branch_id,
            "amount": float(exp.amount or 0.0),
            "note": exp.note or "",
            "date": exp.date.isoformat() if exp.date else "",
            "created_by": exp.created_by or "",
            "created_at": exp.created_at.isoformat() if exp.created_at else ""
        }
        for exp in expenses
    ]

    total_amount = sum(item["amount"] for item in data)

    return success_response({
        "items": data,
        "total_amount": total_amount
    })


@expenses_bp.route("", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin", "Receptionist"])
def create_expense():
    data = request.get_json() or {}
    amount = data.get("amount")
    note = data.get("note", "").strip()
    date_str = data.get("date")
    branch_id = data.get("branch_id") or getattr(g, "branch_id", None)

    try:
        amt_val = float(amount)
        if amt_val <= 0:
            return error_response("INVALID_AMOUNT", "Amount must be greater than 0.", 400)
    except (ValueError, TypeError):
        return error_response("INVALID_AMOUNT", "Amount must be a valid positive number.", 400)

    if not branch_id:
        branch_id = getattr(g, "branch_id", 1) or 1

    exp_date = date.today()
    if date_str:
        try:
            exp_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return error_response("INVALID_DATE", "Date must be YYYY-MM-DD.", 400)

    user_name = getattr(g, "email", "Staff")

    expense = Expense(
        tenant_id=g.parlour_id,
        branch_id=branch_id,
        amount=amt_val,
        note=note,
        date=exp_date,
        created_by=user_name
    )

    db.session.add(expense)
    db.session.commit()

    return success_response({
        "id": expense.id,
        "branch_id": expense.branch_id,
        "amount": float(expense.amount),
        "note": expense.note,
        "date": expense.date.isoformat()
    }, 201)


@expenses_bp.route("/<int:expense_id>", methods=["DELETE"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def delete_expense(expense_id):
    expense = get_branch_query(Expense).filter_by(id=expense_id, is_deleted=False).first()
    if not expense:
        return error_response("NOT_FOUND", "Expense record not found.", 404)

    expense.soft_delete()
    db.session.commit()
    return success_response({"message": "Expense record deleted successfully."})
