from flask import Blueprint, request, g, jsonify
from datetime import datetime, date
from app.database import db
from app.models.cash_denomination import CashDenomination
from app.utils.responses import success_response, error_response
from app.utils.auth import require_role, get_branch_query

cash_denominations_bp = Blueprint("cash_denominations", __name__, url_prefix="/api/v1/cash-denominations")

@cash_denominations_bp.route("", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin", "Receptionist"])
def get_cash_denomination():
    branch_id = request.args.get("branch_id", type=int) or getattr(g, "branch_id", None)
    date_str = request.args.get("date")

    target_date = date.today()
    if date_str:
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            pass

    query = get_branch_query(CashDenomination)
    if branch_id:
        query = query.filter(CashDenomination.branch_id == branch_id)

    record = query.filter(CashDenomination.date == target_date).first()

    if not record:
        return success_response({
            "branch_id": branch_id or 1,
            "date": target_date.isoformat(),
            "count_500": 0,
            "count_200": 0,
            "count_100": 0,
            "count_50": 0,
            "count_20": 0,
            "count_10": 0,
            "count_5": 0,
            "count_2": 0,
            "count_1": 0,
            "total": 0.0
        })

    return success_response({
        "id": record.id,
        "branch_id": record.branch_id,
        "date": record.date.isoformat(),
        "count_500": record.count_500,
        "count_200": record.count_200,
        "count_100": record.count_100,
        "count_50": record.count_50,
        "count_20": record.count_20,
        "count_10": record.count_10,
        "count_5": record.count_5,
        "count_2": record.count_2,
        "count_1": record.count_1,
        "total": float(record.total or 0.0)
    })


@cash_denominations_bp.route("", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin", "Receptionist"])
def save_cash_denomination():
    data = request.get_json() or {}
    branch_id = data.get("branch_id") or getattr(g, "branch_id", 1) or 1
    date_str = data.get("date")

    target_date = date.today()
    if date_str:
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return error_response("INVALID_DATE", "Date must be YYYY-MM-DD.", 400)

    c500 = int(data.get("count_500") or 0)
    c200 = int(data.get("count_200") or 0)
    c100 = int(data.get("count_100") or 0)
    c50 = int(data.get("count_50") or 0)
    c20 = int(data.get("count_20") or 0)
    c10 = int(data.get("count_10") or 0)
    c5 = int(data.get("count_5") or 0)
    c2 = int(data.get("count_2") or 0)
    c1 = int(data.get("count_1") or 0)

    total = (c500 * 500) + (c200 * 200) + (c100 * 100) + (c50 * 50) + (c20 * 20) + (c10 * 10) + (c5 * 5) + (c2 * 2) + (c1 * 1)

    record = get_branch_query(CashDenomination).filter(
        CashDenomination.branch_id == branch_id,
        CashDenomination.date == target_date
    ).first()

    if record:
        record.count_500 = c500
        record.count_200 = c200
        record.count_100 = c100
        record.count_50 = c50
        record.count_20 = c20
        record.count_10 = c10
        record.count_5 = c5
        record.count_2 = c2
        record.count_1 = c1
        record.total = total
    else:
        record = CashDenomination(
            tenant_id=g.parlour_id,
            branch_id=branch_id,
            date=target_date,
            count_500=c500,
            count_200=c200,
            count_100=c100,
            count_50=c50,
            count_20=c20,
            count_10=c10,
            count_5=c5,
            count_2=c2,
            count_1=c1,
            total=total
        )
        db.session.add(record)

    db.session.commit()

    return success_response({
        "id": record.id,
        "branch_id": record.branch_id,
        "date": record.date.isoformat(),
        "total": float(record.total)
    })
