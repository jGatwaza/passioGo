import React, { useEffect, useState, useRef, useCallback } from "react";
import "./BusSheet.css";

const ARRIVED_RETENTION_MS = 5 * 60 * 1000;

const BusSheet = ({ stop, onClose, visibleRoutes = [] }) => {
  const [busData, setBusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dragY, setDragY] = useState(0);
  const [expandedBuses, setExpandedBuses] = useState(new Set());

  const containerRef = useRef(null);
  const handleRef = useRef(null);
  const touchStartY = useRef(null);
  const isDragging = useRef(false);
  const dragYRef = useRef(0);

  // Unified drag helpers — use refs so callbacks stay stable
  const startDrag = useCallback((clientY) => {
    touchStartY.current = clientY;
    isDragging.current = true;
  }, []);

  const moveDrag = useCallback((clientY) => {
    if (!isDragging.current || touchStartY.current === null) return;
    const delta = clientY - touchStartY.current;
    if (delta > 0) {
      dragYRef.current = delta;
      setDragY(delta);
    }
  }, []);

  const endDrag = useCallback(() => {
    if (dragYRef.current > 80) onClose();
    dragYRef.current = 0;
    setDragY(0);
    touchStartY.current = null;
    isDragging.current = false;
  }, [onClose]);

  // Native touch listeners on the drag-zone (non-passive so preventDefault works)
  useEffect(() => {
    const zone = handleRef.current;
    if (!zone) return;

    const onTouchStart = (e) => {
      startDrag(e.touches[0].clientY);
    };
    const onTouchMove = (e) => {
      if (!isDragging.current) return;
      const delta = e.touches[0].clientY - touchStartY.current;
      if (delta > 0) {
        e.preventDefault(); // works because listener is {passive:false}
        dragYRef.current = delta;
        setDragY(delta);
      }
    };
    const onTouchEnd = () => endDrag();

    zone.addEventListener("touchstart", onTouchStart, { passive: true });
    zone.addEventListener("touchmove", onTouchMove, { passive: false });
    zone.addEventListener("touchend", onTouchEnd);
    return () => {
      zone.removeEventListener("touchstart", onTouchStart);
      zone.removeEventListener("touchmove", onTouchMove);
      zone.removeEventListener("touchend", onTouchEnd);
    };
  }, [startDrag, endDrag]);

  // Native mouse listeners — mousedown on drag-zone, move/up on document
  useEffect(() => {
    const zone = handleRef.current;
    if (!zone) return;

    const onMouseDown = (e) => {
      startDrag(e.clientY);
      e.preventDefault();

      const onMouseMove = (ev) => moveDrag(ev.clientY);
      const onMouseUp = () => {
        endDrag();
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };

    zone.addEventListener("mousedown", onMouseDown);
    return () => zone.removeEventListener("mousedown", onMouseDown);
  }, [startDrag, moveDrag, endDrag]);

  const toggleExpanded = useCallback((routeId) => {
    setExpandedBuses((prev) => {
      const next = new Set(prev);
      if (next.has(routeId)) next.delete(routeId);
      else next.add(routeId);
      return next;
    });
  }, []);

  const getBusRouteKey = useCallback((bus) => {
    return bus.route_id || bus.route_badge || bus.route_name || bus.trip_id;
  }, []);

  const mergeWithArrivedRetention = useCallback(
    (prevBuses, incomingBuses) => {
      const nowMs = Date.now();
      const prev = Array.isArray(prevBuses) ? prevBuses : [];
      const incoming = Array.isArray(incomingBuses) ? incomingBuses : [];

      const incomingWithMeta = incoming.map((bus) => {
        const key = getBusRouteKey(bus);
        const prevMatch = prev.find((p) => getBusRouteKey(p) === key);
        const isArriving = (bus.eta_min ?? 0) <= 0;

        return {
          ...bus,
          _stickyArrived: false,
          _arrivedAtMs: isArriving
            ? (prevMatch?._arrivedAtMs ?? nowMs)
            : undefined,
        };
      });

      const incomingByKey = new Map(
        incomingWithMeta.map((bus) => [getBusRouteKey(bus), bus]),
      );

      const retainedArrived = prev
        .filter((bus) => {
          if (!bus?._stickyArrived && (bus.eta_min ?? 0) > 0) return false;

          const key = getBusRouteKey(bus);
          const latest = incomingByKey.get(key);

          if (latest && (latest.eta_min ?? 0) > 0) {
            // New ETA has arrived for this route; retire sticky "arrived" card.
            return false;
          }

          if (latest && (latest.eta_min ?? 0) <= 0) {
            // Current payload already includes this bus as arriving.
            return false;
          }

          const arrivedAtMs = bus._arrivedAtMs ?? nowMs;
          if (nowMs - arrivedAtMs > ARRIVED_RETENTION_MS) {
            return false;
          }

          return true;
        })
        .map((bus) => ({
          ...bus,
          eta_min: 0,
          _stickyArrived: true,
        }));

      return [...incomingWithMeta, ...retainedArrived];
    },
    [getBusRouteKey],
  );

  useEffect(() => {
    if (!stop || !stop.stop_id) return;
    let cancelled = false;

    const fetchData = () => {
      fetch(`http://localhost:8000/api/stop/${stop.stop_id}`)
        .then((res) => res.json())
        .then((data) => {
          if (!cancelled) {
            setBusData((prev) =>
              mergeWithArrivedRetention(prev, data.buses || []),
            );
            setLoading(false);
          }
        })
        .catch((err) => {
          console.error("Failed to fetch bus data", err);
          if (!cancelled) setLoading(false);
        });
    };

    fetchData();
    const intervalId = setInterval(fetchData, 10000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [stop, mergeWithArrivedRetention]);

  const [offSchedPopup, setOffSchedPopup] = useState(null);
  const offSchedTimer = useRef(null);

  const showOffSchedulePopup = useCallback((bus) => {
    setOffSchedPopup(bus);
    if (offSchedTimer.current) clearTimeout(offSchedTimer.current);
    offSchedTimer.current = setTimeout(() => setOffSchedPopup(null), 6000);
  }, []);

  useEffect(() => {
    return () => {
      if (offSchedTimer.current) clearTimeout(offSchedTimer.current);
    };
  }, []);

  if (!stop) return null;

  const getStatusColor = (statusColor) => {
    switch (statusColor) {
      case "Green":
        return "#2ecc71";
      case "Blue":
        return "#3498db";
      case "Orange":
        return "#e67e22";
      case "Red":
        return "#e74c3c";
      case "Black":
        return "#1a1a1a";
      default:
        return "#e310d2";
    }
  };

  const getStatusLabel = (statusColor) => {
    switch (statusColor) {
      case "Green":
        return "On Time";
      case "Blue":
        return "Early";
      case "Orange":
        return "Late";
      case "Red":
        return "Very Late";
      case "Black":
        return "Off Schedule";
      default:
        return "Status Unknown";
    }
  };

  const renderEta = (bus, expanded) => {
    const color = getStatusColor(bus.color);
    const statusLabel = getStatusLabel(bus.color);
    const absDelta = Math.abs(bus.delta_sec);
    const deltaMin = Math.round(absDelta / 60);
    const showTag = expanded && absDelta > 60;
    const displayEta = bus.eta_min > 40 ? ">40" : bus.eta_min;

    return (
      <div className="bus-eta" style={{ color }}>
        {bus.eta_min <= 0 ? (
          <span className="eta-number eta-arrived">
            {bus._stickyArrived ? "Arrived" : "Arriving"}
          </span>
        ) : (
          <>
            <span className="eta-number">{displayEta}</span>
            <span className="min-label">
              {bus.eta_min === 1 ? "Minute" : "Minutes"}
            </span>
          </>
        )}
        {bus.color === "Black" && expanded && (
          <span className="eta-status-tag eta-off-schedule" style={{ color }}>
            Off schedule — still coming
          </span>
        )}
        {bus.color !== "Black" && showTag && (
          <span className="eta-status-tag" style={{ color }}>
            {bus.delta_sec < 0
              ? `${deltaMin} min early`
              : `LATE ${deltaMin} min`}
          </span>
        )}
      </div>
    );
  };

  const renderScheduleContext = (bus) => {
    const ctx = bus.schedule_context;
    if (!ctx) return null;
    return (
      <div className="schedule-context">
        <div className={`sched-slot past${!ctx.past ? " empty" : ""}`}>
          <span className="sched-slot-label">Previous</span>
          <span className="sched-slot-time">{ctx.past || "—"}</span>
        </div>
        <div className="sched-slot current">
          <span className="sched-slot-label">Scheduled</span>
          <span className="sched-slot-time current-time">
            {ctx.current || "—"}
          </span>
        </div>
        <div className={`sched-slot next${!ctx.next ? " empty" : ""}`}>
          <span className="sched-slot-label">Next</span>
          <span className="sched-slot-time">{ctx.next || "—"}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="bus-sheet-overlay" onClick={onClose}>
      <div
        ref={containerRef}
        className="bus-sheet-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: dragY > 0 ? "none" : "transform 0.3s ease",
        }}
      >
        <div className="sheet-drag-zone" ref={handleRef}>
          <div className="sheet-handle"></div>
          <div
            className={`stop-name-header${!(stop.stop_detail || stop.description) ? " stop-name-header--with-border" : ""}`}
          >
            {stop.building_name || stop.name}
          </div>
          {(stop.stop_detail || stop.description) && (
            <div className="stop-subheader">
              {stop.stop_detail || stop.description}
            </div>
          )}
        </div>
        {/* Column headers + legend */}
        <div className="bus-sheet-col-headers">
          <div className="col-headers-top">
            <span className="col-header-trip">Trip</span>
            <span className="col-header-eta">ETA</span>
          </div>
          <div className="bus-sheet-legend">
            <span className="legend-item">
              <span className="legend-dot" style={{ background: "#2ecc71" }} />
              On Time
            </span>
            <span className="legend-item">
              <span className="legend-dot" style={{ background: "#3498db" }} />
              Early
            </span>
            <span className="legend-item">
              <span className="legend-dot" style={{ background: "#e67e22" }} />
              Late
            </span>
            <span className="legend-item">
              <span className="legend-dot" style={{ background: "#e74c3c" }} />
              Very Late
            </span>
            <span className="legend-item">
              <span className="legend-dot" style={{ background: "#1a1a1a" }} />
              Off Schedule
            </span>
          </div>
        </div>
        {/* Off-schedule popup */}
        {offSchedPopup && (
          <div className="off-sched-popup">
            <div className="off-sched-popup-content">
              <span className="off-sched-popup-icon">⚠️</span>
              <div className="off-sched-popup-text">
                <strong>Schedule unavailable</strong>
                <span>
                  The schedule for this bus is unreliable, but Bus{" "}
                  {offSchedPopup.bus_number} is still on its way — arriving in{" "}
                  {offSchedPopup.eta_min}{" "}
                  {offSchedPopup.eta_min === 1 ? "minute" : "minutes"}.
                </span>
              </div>
              <button
                className="off-sched-popup-close"
                onClick={(e) => {
                  e.stopPropagation();
                  setOffSchedPopup(null);
                }}
              >
                ✕
              </button>
            </div>
          </div>
        )}
        <div className="bus-items-scroll">
          {loading ? (
            <div
              className="bus-item"
              style={{ justifyContent: "center", padding: "20px" }}
            >
              Loading...
            </div>
          ) : (
            (() => {
              // Build a set of route names that have active buses
              const activeRouteNames = new Set(
                (busData || []).map((b) => b.route_name),
              );

              // Build the merged list: active buses first, then inactive toggled routes
              const activeBuses = (busData || []).filter((b) =>
                visibleRoutes.some((r) => r.name === b.route_name),
              );
              const inactiveRoutes = visibleRoutes.filter(
                (r) => !activeRouteNames.has(r.name),
              );

              if (activeBuses.length === 0 && inactiveRoutes.length === 0) {
                return (
                  <div
                    className="bus-item"
                    style={{ justifyContent: "center", padding: "20px" }}
                  >
                    No upcoming buses found.
                  </div>
                );
              }

              return (
                <>
                  {activeBuses.map((bus, index) => {
                    const expandKey = bus.route_id || bus.trip_id || index;
                    const expanded = expandedBuses.has(expandKey);
                    return (
                      <div
                        key={expandKey}
                        className={`bus-item${expanded ? " bus-item--expanded" : ""}`}
                        onClick={() => {
                          toggleExpanded(expandKey);
                          if (bus.color === "Black" && !expanded) {
                            showOffSchedulePopup(bus);
                          }
                        }}
                      >
                        <div
                          className="bus-item-left"
                          style={{
                            backgroundColor: bus.route_color || "#e310d2",
                          }}
                        >
                          <div className="bus-info">
                            <div className="bus-header-row">
                              <span
                                className="route-badge"
                                style={{ color: bus.route_color || "#e310d2" }}
                              >
                                {bus.route_badge}
                              </span>
                              <span className="bus-name">{bus.route_name}</span>
                            </div>
                            <div className="bus-route">
                              Bus {bus.bus_number}
                              {!expanded && bus.scheduled_time && (
                                <span className="bus-scheduled-inline">
                                  {" "}
                                  • Scheduled: {bus.scheduled_time}
                                </span>
                              )}
                            </div>
                            {expanded && renderScheduleContext(bus)}
                          </div>
                        </div>
                        <div
                          className="bus-item-right"
                          style={{
                            borderRight: `5px solid ${bus.route_color || "#e310d2"}`,
                          }}
                        >
                          {renderEta(bus, expanded)}
                        </div>
                      </div>
                    );
                  })}

                  {inactiveRoutes.map((route) => (
                    <div
                      key={`inactive-${route.name}`}
                      className="bus-item bus-item--inactive"
                    >
                      <div
                        className="bus-item-left bus-item-left--inactive"
                        style={{ backgroundColor: route.color || "#e310d2" }}
                      >
                        <div className="bus-info">
                          <div className="bus-header-row">
                            <span className="bus-name">{route.name}</span>
                          </div>
                          <div className="bus-route bus-route--inactive">
                            No active trips
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              );
            })()
          )}{" "}
        </div>{" "}
      </div>
    </div>
  );
};

export default BusSheet;
