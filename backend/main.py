from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from gtfs_data import (
    load_static_data, load_shapes,
    get_active_service_ids, filter_schedule_for_date,
    get_stop_schedule_context, fmt_time
)
from realtime import fetch_realtime_updates, determine_status_color
from datetime import datetime, timedelta
import math
import threading
import time

app = FastAPI()

# allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# global state for static data
static_schedule    = None   # full schedule (all services)
trip_route_map     = None
stops_list         = None
shapes_data        = None
calendar_df        = None
calendar_dates_df  = None
trip_service_map   = None
schedule_today     = None   # schedule filtered to today's active trips
schedule_today_date = None  # date the filter was last computed


def get_schedule_today():
    """Return a schedule DataFrame filtered to today's active trips.
    Re-filters whenever the calendar date advances (midnight rollover)."""
    global schedule_today, schedule_today_date
    today = datetime.now().date()
    if schedule_today is None or schedule_today_date != today:
        active = get_active_service_ids(calendar_df, calendar_dates_df, today)
        schedule_today      = filter_schedule_for_date(static_schedule, trip_service_map, active)
        schedule_today_date = today
        print(f"[INFO] schedule_today refreshed for {today}: {len(schedule_today)} rows, active services: {active}", flush=True)
    return schedule_today

@app.on_event("startup")
def startup_event():
    global static_schedule, trip_route_map, stops_list, shapes_data
    global calendar_df, calendar_dates_df, trip_service_map
    static_schedule, trip_route_map, stops_list, calendar_df, calendar_dates_df, trip_service_map = load_static_data()
    shapes_data = load_shapes()
    # Pre-warm today's filtered schedule
    get_schedule_today()

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

@app.get("/api/stops")
def get_all_stops():
    """
    Returns all stops from the static GTFS data with their coordinates and names.
    """
    if stops_list is None:
        raise HTTPException(status_code=503, detail="Static data not loaded")
    return {"stops": stops_list}

@app.get("/api/shapes")
def get_shapes():
    """
    Returns all route shapes with colours for rendering polylines on the map.
    """
    if shapes_data is None:
        raise HTTPException(status_code=503, detail="Static data not loaded")
    return {"shapes": shapes_data}

@app.get("/api/stop/{stop_id}")
def get_stop_status(stop_id: str):
    """
    Returns upcoming buses for a specific stop with status colors.
    """
    global static_schedule, trip_route_map
    if static_schedule is None:
        raise HTTPException(status_code=503, detail="Static data not loaded")

    # fetch realtime updates
    realtime_data = fetch_realtime_updates()
    if not realtime_data or 'entity' not in realtime_data:
        raise HTTPException(status_code=502, detail="Failed to fetch realtime data")

    buses = []
    
    # process entities
    for entity in realtime_data['entity']:
        trip_update = entity.get('trip_update')
        if not trip_update:
            continue
            
        trip_id = trip_update.get('trip', {}).get('trip_id')
        stop_time_updates = trip_update.get('stop_time_update', [])
        
        # find update for this stop
        target_update = None
        for update in stop_time_updates:
            if update.get('stop_id') == stop_id:
                target_update = update
                break
        
        if not target_update:
            continue
            
        # get realtime arrival
        arrival = target_update.get('arrival')
        if not arrival or 'time' not in arrival:
            continue
            
        predicted_unix = arrival['time']
        eta_dt = datetime.fromtimestamp(predicted_unix)

        # Schedules belong to the stop's timetable, not to individual trip_ids.
        # Match this bus to the closest scheduled slot at this stop from today's
        # active timetable — works even when the realtime trip_id belongs to an
        # expired service period that the provider hasn't rotated out yet.
        sched_today = get_schedule_today()
        route_info = trip_route_map.get(trip_id, {})
        route_id = route_info.get("route_id", "")
        scheduled_time_str, schedule_context, delta = get_stop_schedule_context(
            stop_id, route_id, eta_dt, sched_today, static_schedule
        )

        # debug logging
        print(f"[DEBUG] Trip: {trip_id}, Stop: {stop_id}, ETA: {eta_dt.strftime('%H:%M:%S')} -> Scheduled: {scheduled_time_str} delta={delta:.0f}s", flush=True)

        # determine status (lateness) from the computed delta
        if scheduled_time_str:
            status, color = determine_status_color(delta)
        else:
            status = "Scheduled"
            color = "Green"

        route_name = route_info.get("long_name") or route_info.get("short_name") or "Unknown Route"
        route_badge = route_info.get("short_name") or "Bus"
        route_color = route_info.get("color") or "#e310d2"
        
        # get vehicle label
        vehicle_label = entity.get('trip_update', {}).get('vehicle', {}).get('label', 'Unknown')
        
        # calculate ETA from now
        now = datetime.now()
        seconds_away = (eta_dt - now).total_seconds()

        # Only keep future buses so each route shows the soonest upcoming ETA.
        if seconds_away < 0:
            continue

        minutes_away = int(math.ceil(seconds_away / 60.0))

        # format scheduled time
        formatted_schedule = fmt_time(scheduled_time_str) if scheduled_time_str else None

        buses.append({
            "trip_id": trip_id,
            "route_id": route_id,
            "route_badge": route_badge,
            "route_name": route_name,
            "bus_number": vehicle_label,
            "scheduled_time": formatted_schedule,
            "schedule_context": schedule_context,
            "eta_min": max(0, minutes_away),
            "status": status,
            "color": color,
            "route_color": route_color,
            "delta_sec": delta
        })
    
    # sort by ETA, then deduplicate: one entry per route (soonest bus)
    buses.sort(key=lambda x: x['eta_min'])

    seen_routes = {}
    for b in buses:
        rid = b['route_id'] or b['route_badge']
        if rid not in seen_routes:
            seen_routes[rid] = b
        elif 'also_in_min' not in seen_routes[rid]:
            seen_routes[rid]['also_in_min'] = b['eta_min']

    deduped = sorted(seen_routes.values(), key=lambda x: x['eta_min'])

    return {
        "stop_id": stop_id,
        "buses": deduped
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
