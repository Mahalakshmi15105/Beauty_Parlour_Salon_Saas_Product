import os
import requests
from dotenv import load_dotenv

# Load environment variables from backend/.env
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(env_path)

ACCESS_TOKEN = os.getenv("WHATSAPP_PERMANENT_ACCESS_TOKEN", "")
PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
RECIPIENT_PHONE = "919655321915" # Default test phone

def send_test_whatsapp_template(recipient: str = RECIPIENT_PHONE, template_name: str = "hello_world"):
    """Sends a Meta approved template message (Guaranteed delivery outside 24h window)."""
    url = f"https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": recipient,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": "en_US"}
        }
    }

    print(f"\n[SENDING] Sending Template ('{template_name}') to WhatsApp: {recipient}...")
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=15)
        data = response.json()
        print(f"Status Code: {response.status_code}")
        print(f"Meta Response: {data}")
        
        if response.status_code in [200, 201] and "messages" in data:
            meta_id = data["messages"][0]["id"]
            print(f"\n[SUCCESS] WhatsApp Message Delivered.")
            print(f"Meta Message ID: {meta_id}")
            return True, meta_id
        else:
            err = data.get("error", {}).get("message", "Unknown Error")
            print(f"\n[FAILED] Meta Error: {err}")
            return False, err
    except Exception as e:
        print(f"\n[FAILED] Network Exception: {str(e)}")
        return False, str(e)

def send_test_whatsapp_text(recipient: str = RECIPIENT_PHONE, message_body: str = "Hello from Salon Software!"):
    """Sends a custom text message (Requires active 24h window or customer reply)."""
    url = f"https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": recipient,
        "type": "text",
        "text": {"preview_url": False, "body": message_body}
    }

    print(f"\n[SENDING] Sending Custom Text ('{message_body}') to WhatsApp: {recipient}...")
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=15)
        data = response.json()
        print(f"Status Code: {response.status_code}")
        print(f"Meta Response: {data}")
        
        if response.status_code in [200, 201] and "messages" in data:
            meta_id = data["messages"][0]["id"]
            print(f"\n[SUCCESS] WhatsApp Custom Text Message Delivered.")
            print(f"Meta Message ID: {meta_id}")
            return True, meta_id
        else:
            err = data.get("error", {}).get("message", "Unknown Error")
            print(f"\n[FAILED] Meta Error: {err}")
            return False, err
    except Exception as e:
        print(f"\n[FAILED] Network Exception: {str(e)}")
        return False, str(e)

if __name__ == "__main__":
    print("=" * 60)
    print("      SMARTGONEXT SALON WHATSAPP CLOUD API TESTER      ")
    print("=" * 60)
    print(f"Phone Number ID: {PHONE_NUMBER_ID}")
    print(f"Token Length: {len(ACCESS_TOKEN)} chars")
    
    # 1. Send template message
    success, result = send_test_whatsapp_template(RECIPIENT_PHONE, "hello_world")
    
    # 2. Send custom text message
    send_test_whatsapp_text(RECIPIENT_PHONE, "Salon Appointment Confirmation Test")

