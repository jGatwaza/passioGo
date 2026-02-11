import requests
import time
from datetime import datetime, timedelta
import pandas as pd

# Provided Realtime URL
REALTIME_URL = "https://passio3.com/harvard/passioTransit/gtfs/realtime/tripUpdates.json"

def fetch_realtime_updates():
    """
    Fetches the latest GTFS Realtime JSON feed.
    Returns: Parsed JSON content or None on failure.
    """
    try:
        response = requests.get(REALTIME_URL)
        if response.status_code == 200:
            return response.json()
        print(f"Failed to fetch realtime data: {response.status_code}")
        return None
    except Exception as e:
        print(f"Error fetching realtime data: {e}")
        return None

def parse_time(time_str):
    """
    Parses GTFS time string "HH:MM:SS" into a datetime object for today.
    Handles times > 24:00:00 (e.g. 25:30:00 is 1:30 AM tomorrow).
    """
    if not time_str:
        return None
    
    parts = time_str.split(':')
    hours = int(parts[0])
    minutes = int(parts[1])
    seconds = int(parts[2])
    
    now = datetime.now()
    # Base calculation
    day_offset = 0
    if hours >= 24:
        hours -= 24
        day_offset = 1
        
    dt = now.replace(hour=hours, minute=minutes, second=seconds, microsecond=0) + timedelta(days=day_offset)
    return dt

def determine_status_color(delta_seconds):
    """
    Determines status and color based on lateness in seconds.
    - Green (On Time): -60s <= delta <= 120s
    - Blue (Early): delta < -60s
    - Orange (Late): 120s < delta <= 300s
    - Red (Very Late): delta > 300s
    """
    if delta_seconds < -60:
        return "Early", "Blue"
    elif -60 <= delta_seconds <= 120:
        return "On Time", "Green"
    elif 120 < delta_seconds <= 300:
        return "Late", "Orange"
    else: # delta > 300
        return "Very Late", "Red"

def process_trip_update(entity_update, scheduled_time_str):
    """
    Processes a single trip update against the scheduled time.
    Returns: dict with status details
    """
    if not scheduled_time_str:
        return None
    
    # Extract prediction time (Unix timestamp)
    # Finding relevant stop time update. Assuming we are looking at the *closest* stop match
    # For MVP, let's just use the first stop_time_update available or specific one if needed.
    # In full implementation, we'd loop through to find the specific stop_id we care about.
    
    stop_updates = entity_update.get('trip_update', {}).get('stop_time_update', [])
    if not stop_updates:
        return None

    # Let's say we are looking for a specific stop_id pass-through logic
    # For demo, taking the first valid arrival time
    predicted_unix = None
    stop_id = None
    
    for update in stop_updates:
        arrival = update.get('arrival')
        if arrival and 'time' in arrival:
            predicted_unix = arrival['time']
            stop_id = update.get('stop_id')
            break
    
    if not predicted_unix:
        return None

    eta_dt = datetime.fromtimestamp(predicted_unix)
    scheduled_dt = parse_time(scheduled_time_str)
    
    if not scheduled_dt:
        return None

    # Calculate delta
    delta = (eta_dt - scheduled_dt).total_seconds()
    
    status, color = determine_status_color(delta)
    
    # Extract vehicle label (Bus Number)
    vehicle_label = entity_update.get('trip_update', {}).get('vehicle', {}).get('label')
    if not vehicle_label:
        vehicle_label = "Unknown"

    return {
        "trip_id": entity_update.get('trip_update', {}).get('trip', {}).get('trip_id'),
        "stop_id": stop_id,
        "vehicle_label": vehicle_label,
        "scheduled": scheduled_time_str,
        "eta": eta_dt.strftime("%H:%M:%S"),
        "delta_sec": delta,
        "status": status,
        "color": color
    }

if __name__ == "__main__":
    updates = fetch_realtime_updates()
    if updates and 'entity' in updates:
        print(f"Fetched {len(updates['entity'])} entities.")
        # Test logic with dummy scheduled time
        dummy_sched = "22:30:00" # arbitrary
        result = process_trip_update(updates['entity'][0], dummy_sched)
        print("Sample processing:", result)
