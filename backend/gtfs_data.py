import pandas as pd
import os
from datetime import datetime

# Paths to GTFS files
STATIC_GTFS_DIR = "../static gtfs"

def load_static_data():
    """
    Loads static GTFS data and returns:
    1. schedule_df: DataFrame with scheduled arrival times
    2. trip_route_map: Dictionary mapping trip_id -> {route_short_name, route_long_name, route_color, route_text_color}
    """
    print("Loading Static GTFS data...")
    
    # Load stop_times.txt
    stop_times_path = os.path.join(STATIC_GTFS_DIR, "stop_times.txt")
    stop_times_df = pd.read_csv(stop_times_path, dtype={'trip_id': str, 'stop_id': str})
    
    # Filter for relevant columns
    # We need trip_id, stop_id, arrival_time (and possibly stop_sequence)
    # Check if stop_sequence exists in checking columns, if not, loading without it
    # But usually it does. Safely assume it does for standard GTFS.
    cols = ['trip_id', 'stop_id', 'arrival_time']
    if 'stop_sequence' in stop_times_df.columns:
        cols.append('stop_sequence')
        
    schedule_df = stop_times_df[cols].copy()
    
    # Load routes.txt
    routes_path = os.path.join(STATIC_GTFS_DIR, "routes.txt")
    routes_df = pd.read_csv(routes_path, dtype={'route_id': str, 'route_color': str, 'route_text_color': str})
    
    # Load trips.txt
    trips_path = os.path.join(STATIC_GTFS_DIR, "trips.txt")
    trips_df = pd.read_csv(trips_path, dtype={'trip_id': str, 'route_id': str})
    
    # Create Trip -> Route Map
    # Join trips with routes
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

def get_scheduled_time(trip_id, stop_id, schedule_df, stop_sequence=None):
    """
    Look up the scheduled arrival time for a given trip, stop, and optional sequence.
    Returns: string "HH:MM:SS" or None
    """
    # Base mask
    mask = (schedule_df['trip_id'] == str(trip_id)) & (schedule_df['stop_id'] == str(stop_id))
    
    if stop_sequence is not None and 'stop_sequence' in schedule_df.columns:
        # Try to match exact sequence
        seq_mask = mask & (schedule_df['stop_sequence'].astype(str) == str(stop_sequence))
        match = schedule_df[seq_mask]
        if not match.empty:
            return match.iloc[0]['arrival_time']
    
    # Fallback or if stop_sequence not provided/found
    match = schedule_df[mask]
    
    if not match.empty:
        # If multiple matches (loop) and no sequence matched, return first
        return match.iloc[0]['arrival_time']
    return None

if __name__ == "__main__":
    # Test loading
    df, route_map = load_static_data()
    print(df.head())
    print(f"Sample Route Map: {list(route_map.items())[:2]}")
