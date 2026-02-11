from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from gtfs_data import load_static_data, get_scheduled_time
from realtime import fetch_realtime_updates, parse_time, determine_status_color
from datetime import datetime, timedelta
import threading
import time

app = FastAPI()

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state for static data
static_schedule = None
trip_route_map = None

@app.on_event("startup")
def startup_event():
    global static_schedule, trip_route_map
    static_schedule, trip_route_map = load_static_data()

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

@app.get("/api/stop/{stop_id}")
def get_stop_status(stop_id: str):
    """
    Returns upcoming buses for a specific stop with status colors.
    """
    global static_schedule, trip_route_map
    if static_schedule is None:
        raise HTTPException(status_code=503, detail="Static data not loaded")

    # Fetch Realtime Updates
    realtime_data = fetch_realtime_updates()
    if not realtime_data or 'entity' not in realtime_data:
        raise HTTPException(status_code=502, detail="Failed to fetch realtime data")

    buses = []
    
    # Process entities
    for entity in realtime_data['entity']:
        trip_update = entity.get('trip_update')
        if not trip_update:
            continue
            
        trip_id = trip_update.get('trip', {}).get('trip_id')
        stop_time_updates = trip_update.get('stop_time_update', [])
        
        # Find update for this stop
        target_update = None
        for update in stop_time_updates:
            if update.get('stop_id') == stop_id:
                target_update = update
                break
        
        if not target_update:
            continue
            
        # Get Realtime Arrival
        arrival = target_update.get('arrival')
        if not arrival or 'time' not in arrival:
            continue
            
        predicted_unix = arrival['time']
        stop_sequence = target_update.get('stop_sequence') # Extract sequence
        eta_dt = datetime.fromtimestamp(predicted_unix)
        
        # Get Scheduled Time
        scheduled_time_str = get_scheduled_time(trip_id, stop_id, static_schedule, stop_sequence)
        
        status = "Scheduled"
        color = "Gray" # Default ETA color
        delta = 0
        
        # Determine Status (Lateness)
        if scheduled_time_str:
            scheduled_dt = parse_time(scheduled_time_str)
            if scheduled_dt:
                delta = (eta_dt - scheduled_dt).total_seconds()
                status, color = determine_status_color(delta)
        else:
            # Trip exists in realtime but not in static at this time
            status = "Added" 
            color = "#3498db" # Default Blue for added/live trips without schedule

        # Get Route Info
        route_info = trip_route_map.get(trip_id, {})
        route_name = route_info.get("long_name") or route_info.get("short_name") or "Unknown Route"
        route_badge = route_info.get("short_name") or "Bus"
        route_color = route_info.get("color") or "#e310d2"
        
        # Get Vehicle Label
        vehicle_label = entity.get('trip_update', {}).get('vehicle', {}).get('label', 'Unknown')
        
        # Calculate ETA in minutes from now
        now = datetime.now()
        minutes_away = int((eta_dt - now).total_seconds() / 60)
        
        # Display even if negative? Usually hide if too far past.
        # Let's show everything > -2 mins for now to be safe.
        if minutes_away < -2:
            continue # Bus has passed

        # Format Scheduled Time
        formatted_schedule = None
        if scheduled_time_str:
            try:
                # Handle HH:MM:SS even if HH > 23 (GTFS valid)
                h, m, s = map(int, scheduled_time_str.split(':'))
                if h >= 24: h -= 24
                # Create dummy dt for formatting
                dummy_dt = datetime.now().replace(hour=h, minute=m, second=s)
                formatted_schedule = dummy_dt.strftime("%I:%M %p").lstrip("0") # e.g. "9:00 PM"
            except:
                formatted_schedule = scheduled_time_str

        buses.append({
            "trip_id": trip_id,
            "route_badge": route_badge,
            "route_name": route_name,
            "bus_number": vehicle_label,
            "scheduled_time": formatted_schedule, 
            "eta_min": minutes_away if minutes_away >= 0 else 0,
            "status": status,
            "color": color, # This calculates ETA text color (Green/Red/etc)
            "route_color": route_color, # This is the BRANDING color for the line
            "delta_sec": delta
        })
    
    # Sort by ETA
    buses.sort(key=lambda x: x['eta_min'])
    
    return {
        "stop_id": stop_id,
        "buses": buses
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
