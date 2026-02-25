import pandas as pd
import os
import re
from datetime import datetime, timedelta

STATIC_GTFS_DIR = "../static gtfs"

def load_static_data():
    """
    Loads static GTFS data and returns:
      schedule_df      – full stop_times DataFrame (all services)
      trip_route_map   – trip_id -> route display info
      stops_list       – list of stop dicts
      calendar_df      – calendar.txt DataFrame
      calendar_dates_df– calendar_dates.txt DataFrame
      trip_service_map – {trip_id: service_id}
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
    trips_df = pd.read_csv(trips_path, dtype={'trip_id': str, 'route_id': str, 'service_id': str})

    # Enrich schedule with route_id so lookups can be filtered per route
    schedule_df = schedule_df.merge(
        trips_df[['trip_id', 'route_id']], on='trip_id', how='left'
    )

    trips_with_routes = pd.merge(trips_df, routes_df, on='route_id', how='left')

    trip_route_map = {}
    trip_service_map = {}
    for _, row in trips_with_routes.iterrows():
        tid = str(row['trip_id'])
        trip_route_map[tid] = {
            "route_id": str(row['route_id']),
            "short_name": row['route_short_name'] if pd.notna(row['route_short_name']) else "",
            "long_name": row['route_long_name'] if pd.notna(row['route_long_name']) else "",
            "color": f"#{row['route_color']}" if pd.notna(row['route_color']) else "#000000",
            "text_color": f"#{row['route_text_color']}" if pd.notna(row['route_text_color']) else "#FFFFFF"
        }
        trip_service_map[tid] = str(row['service_id']) if pd.notna(row['service_id']) else ""

    # calendar
    calendar_df = pd.read_csv(
        os.path.join(STATIC_GTFS_DIR, "calendar.txt"),
        dtype={c: str for c in ['service_id', 'start_date', 'end_date']}
    )
    calendar_dates_df = pd.read_csv(
        os.path.join(STATIC_GTFS_DIR, "calendar_dates.txt"),
        dtype={'service_id': str, 'date': str}
    )

    # stops
    stops_df = pd.read_csv(os.path.join(STATIC_GTFS_DIR, "stops.txt"), dtype={'stop_id': str})
    stops_list = []

    def parse_stop_name_details(stop_name):
        raw_name = str(stop_name).strip() if pd.notna(stop_name) else "Unknown Stop"
        match = re.match(r"^(.*?)\s*\((.*?)\)\s*$", raw_name)
        if not match:
            return raw_name, None

        base_name = match.group(1).strip() or raw_name
        detail = match.group(2).strip() or None
        return base_name, detail

    for _, row in stops_df.iterrows():
        if pd.notna(row['stop_lat']) and pd.notna(row['stop_lon']):
            raw_name = str(row['stop_name']) if pd.notna(row['stop_name']) else "Unknown Stop"
            building_name, stop_detail = parse_stop_name_details(raw_name)

            stop_desc = None
            if 'stop_desc' in stops_df.columns and pd.notna(row['stop_desc']):
                desc = str(row['stop_desc']).strip()
                stop_desc = desc if desc else None

            stop_code = None
            if 'stop_code' in stops_df.columns and pd.notna(row['stop_code']):
                code = str(row['stop_code']).strip()
                stop_code = code if code else None

            parent_station = None
            if 'parent_station' in stops_df.columns and pd.notna(row['parent_station']):
                parent = str(row['parent_station']).strip()
                parent_station = parent if parent else None

            stops_list.append({
                "stop_id": str(row['stop_id']),
                "name": raw_name,
                "building_name": building_name,
                "stop_detail": stop_detail,
                "description": stop_desc,
                "stop_code": stop_code,
                "parent_station": parent_station,
                "lat": float(row['stop_lat']),
                "lon": float(row['stop_lon']),
            })

    print(f"Loaded {len(schedule_df)} stop times, {len(trip_route_map)} trips, {len(stops_list)} stops.")
    return schedule_df, trip_route_map, stops_list, calendar_df, calendar_dates_df, trip_service_map


def load_shapes():
    """
    Builds route polylines from shapes.txt, coloured by their route.

    Returns a list of dicts:
      { shape_id, route_name, color, points: [[lat, lon], ...] }

    Strategy:
      shapes.txt  → points grouped by shape_id
      trips.txt   → unique shape_id → route_id mapping
      routes.txt  → route_id → color / name
    Multiple trips often share the same shape_id, so we deduplicate and
    emit one polyline per unique shape_id.
    """
    shapes_path = os.path.join(STATIC_GTFS_DIR, "shapes.txt")
    shapes_df = pd.read_csv(shapes_path, dtype={'shape_id': str})

    routes_path = os.path.join(STATIC_GTFS_DIR, "routes.txt")
    routes_df = pd.read_csv(routes_path, dtype={'route_id': str, 'route_color': str})

    trips_path = os.path.join(STATIC_GTFS_DIR, "trips.txt")
    trips_df = pd.read_csv(trips_path, dtype={'trip_id': str, 'route_id': str, 'shape_id': str})

    # One representative route per shape_id (first encountered)
    shape_route = (
        trips_df[['shape_id', 'route_id']]
        .dropna(subset=['shape_id'])
        .drop_duplicates(subset=['shape_id'])
        .merge(routes_df[['route_id', 'route_short_name', 'route_long_name', 'route_color']], on='route_id', how='left')
    )

    shape_color_map = {}
    shape_name_map = {}
    for _, row in shape_route.iterrows():
        sid = str(row['shape_id'])
        color = f"#{row['route_color']}" if pd.notna(row['route_color']) and str(row['route_color']).strip() else "#888888"
        name = row['route_long_name'] if pd.notna(row['route_long_name']) and str(row['route_long_name']).strip() \
               else (row['route_short_name'] if pd.notna(row['route_short_name']) else "")
        shape_color_map[sid] = color
        shape_name_map[sid] = str(name)

    # Sort each shape's points by sequence, then build coordinate lists
    shapes_df = shapes_df.sort_values(['shape_id', 'shape_pt_sequence'])
    shapes_list = []
    for shape_id, group in shapes_df.groupby('shape_id', sort=False):
        sid = str(shape_id)
        points = [[float(r['shape_pt_lat']), float(r['shape_pt_lon'])] for _, r in group.iterrows()]
        shapes_list.append({
            "shape_id": sid,
            "route_name": shape_name_map.get(sid, ""),
            "color": shape_color_map.get(sid, "#888888"),
            "points": points,
        })

    # Rebuild known problematic routes from canonical shapes.txt geometry.
    # We pick the most common base shape_id for each route (e.g., 48169 over
    # 48169.77/48169.108 variants), then draw a single clean polyline.
    target_route_ids = {"790", "793", "2235"}  # Quad Express, Quad Yard Express, Quad SEC Direct
    for route_id in target_route_ids:
        route_trips = trips_df[
            (trips_df['route_id'].astype(str) == route_id)
            & (trips_df['shape_id'].notna())
        ].copy()

        if route_trips.empty:
            continue

        route_trips['shape_id'] = route_trips['shape_id'].astype(str)
        route_trips['shape_base'] = route_trips['shape_id'].str.split('.').str[0]

        base_counts = route_trips['shape_base'].value_counts()
        canonical_base = str(base_counts.index[0])

        canonical_sid = canonical_base
        if canonical_sid not in set(shapes_df['shape_id'].astype(str)):
            canonical_sid = str(route_trips['shape_id'].value_counts().index[0])

        canonical_group = shapes_df[shapes_df['shape_id'].astype(str) == canonical_sid]
        if canonical_group.empty:
            continue

        canonical_group = canonical_group.sort_values('shape_pt_sequence')
        canonical_points = [
            [float(r['shape_pt_lat']), float(r['shape_pt_lon'])]
            for _, r in canonical_group.iterrows()
        ]

        route_row = routes_df[routes_df['route_id'].astype(str) == route_id]
        if route_row.empty:
            continue

        route_row = route_row.iloc[0]
        route_name = (
            str(route_row['route_long_name']).strip()
            if pd.notna(route_row['route_long_name']) and str(route_row['route_long_name']).strip()
            else str(route_row['route_short_name']).strip()
        )
        route_color = (
            f"#{route_row['route_color']}"
            if pd.notna(route_row['route_color']) and str(route_row['route_color']).strip()
            else "#888888"
        )

        shapes_list = [s for s in shapes_list if (s.get('route_name') or "") != route_name]
        shapes_list.append({
            "shape_id": f"{canonical_sid}-canonical-{route_id}",
            "route_name": route_name,
            "color": route_color,
            "points": canonical_points,
        })

        print(
            f"[INFO] Redrew route {route_name} using canonical shape_id {canonical_sid}.",
            flush=True,
        )

    print(f"Loaded {len(shapes_list)} route shapes.")
    return shapes_list


# ─────────────────────────────────────────────────────────────────────────────
# Service-date helpers
# ─────────────────────────────────────────────────────────────────────────────

def get_active_service_ids(calendar_df, calendar_dates_df, date=None):
    """
    Returns the set of service_ids that are active on `date` (defaults to today).

    Rules (standard GTFS):
      1. A service runs if calendar.txt has its DOW bit set AND today falls within
         [start_date, end_date].
      2. calendar_dates.txt exception_type=1 adds a service for that date.
      3. calendar_dates.txt exception_type=2 removes a service for that date.
    """
    if date is None:
        date = datetime.now().date()

    today_str = date.strftime("%Y%m%d")
    today_int = int(today_str)
    dow = date.strftime("%A").lower()      # 'monday' … 'sunday'

    active = set()

    # Step 1: calendar.txt
    for _, row in calendar_df.iterrows():
        try:
            if int(row[dow]) == 1 and int(row['start_date']) <= today_int <= int(row['end_date']):
                active.add(str(row['service_id']))
        except (ValueError, KeyError):
            pass

    # Step 2: calendar_dates.txt overrides
    today_rows = calendar_dates_df[calendar_dates_df['date'] == today_str]
    for _, row in today_rows.iterrows():
        sid = str(row['service_id'])
        exc = int(row['exception_type'])
        if exc == 1:
            active.add(sid)
        elif exc == 2:
            active.discard(sid)

    return active


def filter_schedule_for_date(schedule_df, trip_service_map, active_service_ids):
    """
    Returns a copy of schedule_df containing only rows whose trip_id belongs to
    a service that is active today.  This eliminates expired or future service
    periods and prevents the algorithm from latching onto stale scheduled times.
    """
    active_trips = {tid for tid, sid in trip_service_map.items() if sid in active_service_ids}
    return schedule_df[schedule_df['trip_id'].isin(active_trips)].copy()


# ─────────────────────────────────────────────────────────────────────────────
# Schedule lookup helpers (operate on schedule_today — already date-filtered)
# ─────────────────────────────────────────────────────────────────────────────

def _parse_gtfs_time(time_str, base_date):
    """
    Converts a GTFS arrival_time string (HH:MM:SS, HH may be >= 24 for
    post-midnight service) to a datetime on `base_date`.
    Returns None if parsing fails.
    """
    try:
        h, m, s = map(int, time_str.split(':'))
        extra_days = h // 24
        h = h % 24
        return datetime(base_date.year, base_date.month, base_date.day, h, m, s) + timedelta(days=extra_days)
    except Exception:
        return None


def fmt_time(time_str):
    """Format a GTFS HH:MM:SS string to 12-hour display, e.g. '9:05 AM'."""
    try:
        h, m, s = map(int, time_str.split(':'))
        h = h % 24
        dummy = datetime.now().replace(hour=h, minute=m, second=s, microsecond=0)
        return dummy.strftime("%I:%M %p").lstrip("0")
    except Exception:
        return time_str


def get_stop_schedule_context(stop_id, route_id, eta_dt, schedule_today, full_schedule=None):
    """
     Schedule lookup anchored on *now* for a specific stop + route.

     Behavior:
        1. Build today's unique timetable slots for (stop_id, route_id).
        2. Define "current" as the first slot >= now (or the last slot if all are past).
        3. Return context around that current slot: past/current/next.
        4. Compute delta against the current slot, but guard against stale history:
            - if current slot is too far in the past, force delta=0
            - if eta is unrealistically far from current slot, force delta=0

     Returns: (scheduled_raw_str, context_dict, delta_sec)
    """
    now  = datetime.now()
    base = now.date()
    stale_past_cutoff_sec = 30 * 60
    max_deviation_anchor_sec = 60 * 60

    def _build_times(df):
        rows = df[(df['stop_id'] == str(stop_id)) & (df['route_id'] == str(route_id))]
        seen = {}
        for ts in rows['arrival_time']:
            if ts not in seen:
                dt = _parse_gtfs_time(ts, base)
                if dt is not None:
                    seen[ts] = dt
        return sorted(seen.items(), key=lambda x: x[1])  # [(raw_str, dt), ...]

    times = _build_times(schedule_today)

    if not times:
        return None, {"past": None, "current": None, "next": None}, 0

    # Anchor: first scheduled time >= NOW (source of truth for "current").
    current_idx = next(
        (i for i, (_, dt) in enumerate(times) if dt >= now),
        len(times) - 1
    )

    scheduled_raw, scheduled_dt = times[current_idx]
    delta_sec = (eta_dt - scheduled_dt).total_seconds()

    # Do not base deviation on schedules that are way back in the past.
    if (now - scheduled_dt).total_seconds() > stale_past_cutoff_sec:
        delta_sec = 0

    # Sanity cap: sparse/irregular matches should not produce wild colors.
    # Return special sentinel so the caller can flag "off schedule".
    if abs(delta_sec) > max_deviation_anchor_sec:
        delta_sec = float('inf')

    past_str    = fmt_time(times[current_idx - 1][0]) if current_idx > 0 else None
    current_str = fmt_time(scheduled_raw)
    next_str    = fmt_time(times[current_idx + 1][0]) if current_idx < len(times) - 1 else None

    return scheduled_raw, {"past": past_str, "current": current_str, "next": next_str}, delta_sec


if __name__ == "__main__":
    from datetime import datetime as _dt
    df, route_map, stops, cal, cal_dates, tsvc = load_static_data()
    active = get_active_service_ids(cal, cal_dates)
    today_df = filter_schedule_for_date(df, tsvc, active)
    print(f"Active service_ids: {active}")
    print(f"Rows in today's schedule: {len(today_df)}")
    eta_test = _dt.now().replace(second=0, microsecond=0)
    raw, ctx, delta = get_stop_schedule_context("5049", eta_test, today_df, df)
    print(f"Test stop 5049 at {eta_test.strftime('%H:%M')}: scheduled={raw}, delta={delta:.0f}s")
    print(f"Context: {ctx}")
