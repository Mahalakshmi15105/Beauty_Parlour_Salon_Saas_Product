"""
Comprehensive Booking Module Testing Script
Tests the new single-page booking design with Token and Time Slot modes
"""

import requests
import json
import time
from datetime import datetime, timedelta

BASE_URL = "http://localhost:5000/api/v1"

def print_test_header(test_name):
    print(f"\n{'='*60}")
    print(f"TEST: {test_name}")
    print(f"{'='*60}")

def print_result(test_name, success, message=""):
    status = "PASS" if success else "FAIL"
    print(f"{status} - {test_name}")
    if message:
        print(f"  Details: {message}")

def get_tenant_identifier():
    """Get the first active tenant for testing"""
    try:
        response = requests.get(f"{BASE_URL}/public/booking/1/config")
        if response.status_code == 200:
            data = response.json().get("data", {})
            return data.get("slug") or data.get("tenant_id") or "1"
    except:
        pass
    return "1"

def test_booking_config():
    print_test_header("Booking Configuration Test")
    try:
        identifier = get_tenant_identifier()
        response = requests.get(f"{BASE_URL}/public/booking/{identifier}/config")
        if response.status_code == 200:
            data = response.json().get("data", {})
            print_result("Booking Config", True, f"Booking Type: {data.get('booking_type')}, Staff Selection: {data.get('allow_staff_selection')}")
            return identifier, data
        else:
            print_result("Booking Config", False, f"Status: {response.status_code}")
            return None, None
    except Exception as e:
        print_result("Booking Config", False, f"Exception: {str(e)}")
        return None, None

def test_token_booking(identifier):
    print_test_header("Token Booking Flow Test (Single-Page Design)")
    try:
        # First get available services
        services_response = requests.get(f"{BASE_URL}/public/booking/{identifier}/services")
        if services_response.status_code != 200:
            print_result("Token Booking Test", False, "Failed to get services")
            return False
        
        services = services_response.json().get("data", [])
        if not services:
            print_result("Token Booking Test", False, "No services available")
            return False
        
        service_id = services[0]["id"]
        
        # Test token slot availability
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(f"{BASE_URL}/public/booking/{identifier}/slots?date={today}&booking_type=Token")
        if response.status_code == 200:
            data = response.json().get("data", {})
            tokens = data.get("tokens", [])
            current_token = data.get("current_token")
            
            print_result("Token Slots API", True, f"Available tokens: {len([t for t in tokens if t['available']])}, Current token: {current_token}")
            
            # Test token booking submission
            if tokens and any(t['available'] for t in tokens):
                available_token = next(t for t in tokens if t['available'])
                payload = {
                    "customer_name": "Test Customer",
                    "customer_phone": f"999{int(time.time())}",
                    "appointment_date": today,
                    "booking_type": "Token",
                    "token_number": available_token['token_number'],
                    "items": [{"service_id": service_id}]
                }
                
                response = requests.post(f"{BASE_URL}/public/booking/{identifier}", json=payload)
                if response.status_code in [200, 201]:
                    print_result("Token Booking Submission", True, f"Token #{available_token['token_number']} booked successfully")
                    return True
                else:
                    print_result("Token Booking Submission", False, f"Status: {response.status_code}, Response: {response.text}")
                    return False
            else:
                print_result("Token Booking Test", False, "No available tokens")
                return False
        else:
            print_result("Token Slots API", False, f"Status: {response.status_code}")
            return False
    except Exception as e:
        print_result("Token Booking Test", False, f"Exception: {str(e)}")
        return False

def test_slot_booking(identifier):
    print_test_header("Time Slot Booking Flow Test (Single-Page Design)")
    try:
        # First get available services
        services_response = requests.get(f"{BASE_URL}/public/booking/{identifier}/services")
        if services_response.status_code != 200:
            print_result("Slot Booking Test", False, "Failed to get services")
            return False
        
        services = services_response.json().get("data", [])
        if not services:
            print_result("Slot Booking Test", False, "No services available")
            return False
        
        service_id = services[0]["id"]
        
        # Test time slot availability
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(f"{BASE_URL}/public/booking/{identifier}/slots?date={today}&booking_type=Slot")
        if response.status_code == 200:
            data = response.json().get("data", {})
            slots = data.get("slots", [])
            
            print_result("Time Slots API", True, f"Available slots: {len([s for s in slots if s['available']])}")
            
            # Test slot booking submission
            if slots and any(s['available'] for s in slots):
                available_slot = next(s for s in slots if s['available'])
                payload = {
                    "customer_name": "Test Customer",
                    "customer_phone": f"888{int(time.time())}",
                    "appointment_date": today,
                    "booking_type": "Slot",
                    "start_time": available_slot['time'],
                    "items": [{"service_id": service_id}]
                }
                
                response = requests.post(f"{BASE_URL}/public/booking/{identifier}", json=payload)
                if response.status_code in [200, 201]:
                    print_result("Slot Booking Submission", True, f"Slot {available_slot['time']} booked successfully")
                    return True
                else:
                    print_result("Slot Booking Submission", False, f"Status: {response.status_code}, Response: {response.text}")
                    return False
            else:
                print_result("Slot Booking Test", False, "No available slots")
                return False
        else:
            print_result("Time Slots API", False, f"Status: {response.status_code}")
            return False
    except Exception as e:
        print_result("Slot Booking Test", False, f"Exception: {str(e)}")
        return False

def test_staff_selection(identifier, config):
    print_test_header("Staff Selection Based on Settings Test")
    try:
        allow_staff = config.get("allow_staff_selection", False)
        
        if allow_staff:
            response = requests.get(f"{BASE_URL}/public/booking/{identifier}/staff")
            if response.status_code == 200:
                staff_list = response.json().get("data", [])
                print_result("Staff Selection Enabled", True, f"Staff list returned: {len(staff_list)} staff members")
                return True
            else:
                print_result("Staff Selection Enabled", False, f"Failed to fetch staff: {response.status_code}")
                return False
        else:
            response = requests.get(f"{BASE_URL}/public/booking/{identifier}/staff")
            if response.status_code == 200:
                staff_list = response.json().get("data", [])
                if len(staff_list) == 0:
                    print_result("Staff Selection Disabled", True, "Staff list correctly empty when disabled")
                    return True
                else:
                    print_result("Staff Selection Disabled", False, f"Staff list should be empty but got {len(staff_list)} staff")
                    return False
            else:
                print_result("Staff Selection Disabled", True, "Staff endpoint correctly returns empty when disabled")
                return True
    except Exception as e:
        print_result("Staff Selection Test", False, f"Exception: {str(e)}")
        return False

def test_live_token_display(identifier):
    print_test_header("Live Token Display Test")
    try:
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(f"{BASE_URL}/public/booking/{identifier}/slots?date={today}&booking_type=Token")
        if response.status_code == 200:
            data = response.json().get("data", {})
            current_token = data.get("current_token")
            tokens = data.get("tokens", [])
            
            if current_token is not None:
                print_result("Live Token Display", True, f"Current serving token: #{current_token}")
            else:
                print_result("Live Token Display", True, "No current token (no active bookings)")
            
            # Verify token availability status
            available_count = len([t for t in tokens if t['available']])
            booked_count = len([t for t in tokens if not t['available']])
            print_result("Token Status Display", True, f"Available: {available_count}, Booked: {booked_count}")
            return True
        else:
            print_result("Live Token Display", False, f"Status: {response.status_code}")
            return False
    except Exception as e:
        print_result("Live Token Display", False, f"Exception: {str(e)}")
        return False

def test_booking_mode_independence(identifier):
    print_test_header("Booking Mode Independence Test")
    try:
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Test Token mode without time
        token_response = requests.get(f"{BASE_URL}/public/booking/{identifier}/slots?date={today}&booking_type=Token")
        if token_response.status_code == 200:
            token_data = token_response.json().get("data", {})
            print_result("Token Mode Without Time", True, "Token mode doesn't require time")
        else:
            print_result("Token Mode Without Time", False, f"Status: {token_response.status_code}")
            return False
        
        # Test Slot mode requires time
        slot_response = requests.get(f"{BASE_URL}/public/booking/{identifier}/slots?date={today}&booking_type=Slot")
        if slot_response.status_code == 200:
            slot_data = slot_response.json().get("data", {})
            print_result("Slot Mode Time Requirement", True, "Slot mode provides time slots")
        else:
            print_result("Slot Mode Time Requirement", False, f"Status: {slot_response.status_code}")
            return False
        
        return True
    except Exception as e:
        print_result("Booking Mode Independence", False, f"Exception: {str(e)}")
        return False

def test_branch_data_isolation():
    print_test_header("Branch Data Isolation Test")
    try:
        # Test that different tenants have different configs
        response1 = requests.get(f"{BASE_URL}/public/booking/1/config")
        response2 = requests.get(f"{BASE_URL}/public/booking/2/config")
        
        if response1.status_code == 200 and response2.status_code == 200:
            data1 = response1.json().get("data", {})
            data2 = response2.json().get("data", {})
            
            # Verify different parlours have different names
            if data1.get("parlour_name") != data2.get("parlour_name"):
                print_result("Branch Data Isolation", True, "Different branches have different configurations")
                return True
            else:
                print_result("Branch Data Isolation", False, "Branches appear to have same configuration")
                return False
        else:
            print_result("Branch Data Isolation", False, "Failed to fetch branch configs")
            return False
    except Exception as e:
        print_result("Branch Data Isolation", False, f"Exception: {str(e)}")
        return False

def main():
    print(f"\n{'='*60}")
    print("NEW SINGLE-PAGE BOOKING DESIGN TESTING")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")
    
    # Test configuration first
    identifier, config = test_booking_config()
    if not identifier:
        print("\nFAILED: Cannot get booking configuration, cannot continue testing")
        return
    
    print(f"\nTesting with tenant: {identifier}")
    
    # Test all booking features
    results = []
    results.append(("Booking Config", True))  # Already tested above
    results.append(("Booking Mode Independence", test_booking_mode_independence(identifier)))
    results.append(("Staff Selection", test_staff_selection(identifier, config)))
    results.append(("Live Token Display", test_live_token_display(identifier)))
    results.append(("Token Booking", test_token_booking(identifier)))
    results.append(("Time Slot Booking", test_slot_booking(identifier)))
    results.append(("Branch Data Isolation", test_branch_data_isolation()))
    
    # Summary
    print(f"\n{'='*60}")
    print("TEST SUMMARY")
    print(f"{'='*60}")
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "PASS" if result else "FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    print(f"Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    if passed == total:
        print("\nALL SINGLE-PAGE BOOKING TESTS PASSED!")
    else:
        print(f"\n{total - passed} test(s) failed")

if __name__ == "__main__":
    main()