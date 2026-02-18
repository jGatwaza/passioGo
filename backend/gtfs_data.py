import pandas as pd
import os
from datetime import datetime, timedelta

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

def get_best_scheduled_time(trip_id, stop_id, schedule_df, stop_sequence=None):
    """
    Returns the scheduled arrival_time string (HH:MM:SS) for a specific bus visit
    to a stop, using the following strategy:

    1. PRIMARY — If `stop_sequence` is provided (from the realtime feed), look up
       the exact static row that matches (trip_id, stop_id, stop_sequence).  This
       uniquely identifies the visit even when a circular route visits the same
       stop more than once, and is completely stable across polls.

    2. FALLBACK — If no stop_sequence match is found (e.g. added trip, sequence
       numbering mismatch), find all static rows for (trip_id, stop_id) and return
       the scheduled time of the *earliest visit whose scheduled time is still in
       the future* relative to wall-clock now.  This prevents flipping to a past
       schedule on each refresh.

    3. END-OF-SERVICE — If all candidate times are in the past, return the latest
       one so the caller always has something to compare against.
    """
    mask = (schedule_df['trip_id'] == str(trip_id)) & (schedule_df['stop_id'] == str(stop_id))
    matches = schedule_df[mask].copy()

    if matches.empty:
        return None

    now = datetime.now()

    def parse_to_dt(time_str):
        try:
            h, m, s = map(int, time_str.split(':'))
            day_offset = 0
            if h >= 24:
                h -= 24
                day_offset = 1
            base = now.date()
            return datetime(base.year, base.month, base.day, h, m, s) + \
                   timedelta(days=day_offset)
        except:
            return None

    # --- Strategy 1: exact stop_sequence match ---
    if stop_sequence is not None and 'stop_sequence' in matches.columns:
        seq_match = matches[matches['stop_sequence'] == int(stop_sequence)]
        if not seq_match.empty:
            time_str = seq_match.iloc[0]['arrival_time']
            sched_dt = parse_to_dt(time_str)
            if sched_dt is None:
                return time_str  # can't parse but still return it

            # If this scheduled time is still upcoming (or just barely past with
            # 2-min grace), return it — the bus hasn't left this stop yet per
            # the schedule, so this is the correct reference.
            grace = timedelta(minutes=2)
            if sched_dt >= now - grace:
                return time_str

            # The scheduled time for THIS exact visit is already well in the past.
            # That means per the static schedule this bus has already served the
            # stop at this sequence number.  Fall through to look for the next
            # future visit (another sequence number at the same stop, if any).

    # --- Strategy 2: next future visit (fallback / post-departure) ---
    candidates = []
    for _, row in matches.iterrows():
        sched_dt = parse_to_dt(row['arrival_time'])
        if sched_dt:
            candidates.append((sched_dt, row['arrival_time']))

    if not candidates:
        return None

    grace = timedelta(minutes=2)
    future = [(dt, ts) for dt, ts in candidates if dt >= now - grace]

    if future:
        future.sort(key=lambda x: x[0])
        return future[0][1]

    # --- Strategy 3: end-of-service, return the latest past time ---
    candidates.sort(key=lambda x: x[0])
    return candidates[-1][1]

if __name__ == "__main__":
    # Test loading
    df, route_map = load_static_data()
    print(df.head())
    print(f"Sample Route Map: {list(route_map.items())[:2]}")
