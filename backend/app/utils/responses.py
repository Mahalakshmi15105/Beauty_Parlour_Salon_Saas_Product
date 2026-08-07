from flask import jsonify
from datetime import datetime, timezone

def success_response(data=None, message=None, status_code=200):
    response = {
        "success": True
    }
    if data is not None:
        response["data"] = data
    if message is not None:
        response["message"] = message
    return jsonify(response), status_code

def error_response(error_code, message, status_code=400, errors=None, details=None):
    response = {
        "success": False,
        "error_code": error_code,
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    if errors is not None:
        response["errors"] = errors
    if details is not None:
        response["details"] = details
    return jsonify(response), status_code
