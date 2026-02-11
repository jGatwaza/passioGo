import pandas as pd
import os
from datetime import datetime

STATIC_GTFS_DIR = "../static gtfs"

def load_static_data():
    """
    Loads static GTFS data and returns:
    1. schedule_df: DataFrame with scheduled arrival times
    2. trip_route_map: Dictionary mapping trip_id -> {route_short_name, route_long_name, route_color, route_text_color}
    """
    print("Loading Static GTFS data...")
    
    stop_times_path = os.path.join(STATIC_GTFS_DIR, "stop_times.txt")
    stop_times_df = pd.read_csv(stop_times_path, dtype={'trip_id': str, 'stop_id': str})
    
    cols = ['trip_id', 'stop_id', 'arrival_time']
    if 'stop_sequence' in stop_times_df.columns:
        cols.append('stop_sequence')
        
    schedule_df = stop_times_df[cols].copy()
    
    routes_path = os.path.join(STATIC_GTFS_DIR, "routes.txt")
    routes_df = pd.read_csv(routes_path, dtype={'route_id': str, 'route_color': str, 'route_text_color': str})
    
    trips_path = os.path.join(STATIC_GTFS_DIR, "trips.txt")
    trips_df = pd.read_csv(trips_path, dtype={'trip_id': str, 'route_id': str})
    
    trips_with_routes = pd.merge(trips_df, routes_df, on='route_id', how='left')
    
    trip_route_map = {}
    for _, row in trips_with_routes.iterrows():
        trip_route_map[str(row['trip_id'])] = {
            "route_id": str(row['route_id']),
            "short_name": row['route_short_name'] if pd.notna(row['route_short_name']) else "",
            "long_name": row['route_long_name'] if pd.notna(row['route_long_name']) else "",
            "color": f"#{row['route_color']}" if pd.notna(row['route_color']) else "#000000",
            "text_color": f"#{row['route_text_color']}" if pd.notna(row['route_text_color']) else "#FFFFFF"
        }
        
    print(f"Loaded {len(schedule_df)} stop times and {len(trip_route_map)} trips.")
    return schedule_df, trip_route_map

def get_best_scheduled_time(trip_id, stop_id, eta_dt, schedule_df):
    """
    Finds the scheduled arrival time closest to the estimated arrival time (eta_dt).
    This ignores stop_sequence if provided, as it can be unreliable.
    """
    mask = (schedule_df['trip_id'] == str(trip_id)) & (schedule_df['stop_id'] == str(stop_id))
    matches = schedule_df[mask].copy()
    
    if matches.empty:
        return None
        
    # convert arrival_time strings to datetime objects for comparison
    # ETA is a datetime. matching arrival_time ("HH:MM:SS") needs care (overnight etc).
    
    def parse_to_dt(time_str):
        try:
            h, m, s = map(int, time_str.split(':'))
            # handle > 24 hours (e.g. 25:30)
            day_offset = 0
            if h >= 24:
                h -= 24
                day_offset = 1
                
            # use eta_dt's date as baseline
            base_date = eta_dt.date()
            return datetime(base_date.year, base_date.month, base_date.day, h, m, s)
        except:
            return None

    best_match_time = None
    min_diff = float('inf')
    
    for _, row in matches.iterrows():
        sched_time_str = row['arrival_time']
        sched_dt = parse_to_dt(sched_time_str)
        
        if sched_dt:
            # calculate absolute difference in seconds
            diff = abs((eta_dt - sched_dt).total_seconds())
            if diff < min_diff:
                min_diff = diff
                best_match_time = sched_time_str
                
    return best_match_time

if __name__ == "__main__":
    # Test loading
    df, route_map = load_static_data()
    print(df.head())
    print(f"Sample Route Map: {list(route_map.items())[:2]}")
