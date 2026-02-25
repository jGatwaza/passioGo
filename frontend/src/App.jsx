import React, { useState, useEffect, useMemo, useCallback } from "react";
import MapComponent from "./components/MapComponent";
import BusSheet from "./components/BusSheet";
import RouteMenu from "./components/RouteMenu";
import "./App.css";

const BUS_TIP_DURATION_MS = 6000;

function App() {
  const [selectedStop, setSelectedStop] = useState(null);
  const [stops, setStops] = useState([]);
  const [shapes, setShapes] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [showRecenter, setShowRecenter] = useState(false);
  const [recenterRequestToken, setRecenterRequestToken] = useState(0);
  const [hiddenRoutes, setHiddenRoutes] = useState(new Set());
  const [activeOnly, setActiveOnly] = useState(false);
  const [activeRouteNames, setActiveRouteNames] = useState(new Set());
  const [showBusTip, setShowBusTip] = useState(false);
  const [hasSeenBusTip, setHasSeenBusTip] = useState(false);

  useEffect(() => {
    fetch("http://localhost:8000/api/stops")
      .then((res) => res.json())
      .then((data) => setStops(data.stops || []))
      .catch((err) => console.error("Failed to load stops:", err));

    fetch("http://localhost:8000/api/shapes")
      .then((res) => res.json())
      .then((data) => setShapes(data.shapes || []))
      .catch((err) => console.error("Failed to load shapes:", err));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchVehicles = () => {
      fetch("http://localhost:8000/api/vehicles")
        .then((res) => res.json())
        .then((data) => {
          if (!cancelled) {
            setVehicles(data.vehicles || []);
          }
        })
        .catch((err) => {
          console.error("Failed to load vehicles:", err);
        });
    };

    fetchVehicles();
    const id = setInterval(fetchVehicles, 6000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Periodically fetch active route names when activeOnly is on
  useEffect(() => {
    if (!activeOnly) return;
    const fetchActive = () => {
      fetch("http://localhost:8000/api/active-routes")
        .then((res) => res.json())
        .then((data) => setActiveRouteNames(new Set(data.active_routes || [])))
        .catch((err) => console.error("Failed to fetch active routes:", err));
    };
    fetchActive();
    const id = setInterval(fetchActive, 15000);
    return () => clearInterval(id);
  }, [activeOnly]);

  // Derive unique routes (by name) from shapes for the menu list
  const uniqueRoutes = useMemo(() => {
    const seen = new Map();
    for (const shape of shapes) {
      const name = shape.route_name || "Unknown Route";
      if (!seen.has(name)) {
        seen.set(name, { name, color: shape.color });
      }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [shapes]);

  const handleToggleRoute = (routeName) => {
    setHiddenRoutes((prev) => {
      const next = new Set(prev);
      if (next.has(routeName)) next.delete(routeName);
      else next.add(routeName);
      return next;
    });
  };

  const handleToggleActiveOnly = useCallback(() => {
    setActiveOnly((prev) => !prev);
  }, []);

  // Compute effective hidden routes (respects activeOnly override)
  const effectiveHidden = useMemo(() => {
    if (!activeOnly) return hiddenRoutes;
    // Hide every route that is NOT in the active set
    const hidden = new Set();
    for (const route of uniqueRoutes) {
      if (!activeRouteNames.has(route.name)) {
        hidden.add(route.name);
      }
    }
    return hidden;
  }, [activeOnly, hiddenRoutes, uniqueRoutes, activeRouteNames]);

  // Only pass shapes whose route is not hidden
  const visibleShapes = useMemo(
    () =>
      shapes.filter(
        (s) => !effectiveHidden.has(s.route_name || "Unknown Route"),
      ),
    [shapes, effectiveHidden],
  );

  const visibleVehicles = useMemo(
    () =>
      vehicles.filter(
        (v) => !effectiveHidden.has(v.route_name || "Unknown Route"),
      ),
    [vehicles, effectiveHidden],
  );

  const handleStopClick = (stop) => {
    setSelectedStop(stop);
  };

  const handleCloseSheet = () => {
    setSelectedStop(null);
  };

  const handleOutOfBoundsChange = useCallback((isOutOfBounds) => {
    setShowRecenter(isOutOfBounds);
  }, []);

  const handleRecenter = useCallback(() => {
    setRecenterRequestToken((prev) => prev + 1);
    setShowRecenter(false);
  }, []);

  useEffect(() => {
    if (!showBusTip) return;
    const timerId = setTimeout(() => setShowBusTip(false), BUS_TIP_DURATION_MS);
    return () => clearTimeout(timerId);
  }, [showBusTip]);

  const handleBusClick = useCallback(() => {
    if (hasSeenBusTip) return;
    setHasSeenBusTip(true);
    setShowBusTip(true);
  }, [hasSeenBusTip]);

  return (
    <div className="app-container">
      <MapComponent
        stops={stops}
        shapes={visibleShapes}
        vehicles={visibleVehicles}
        onStopClick={handleStopClick}
        onBusClick={handleBusClick}
        onMapClick={handleCloseSheet}
        onOutOfBoundsChange={handleOutOfBoundsChange}
        recenterRequestToken={recenterRequestToken}
        selectedStop={selectedStop}
      />
      {showBusTip && (
        <div className="bus-tip-banner" role="status" aria-live="polite">
          <span className="bus-tip-text">
            Tip: Click any stop to see ETA details for buses on that route.
          </span>
          <button
            type="button"
            className="bus-tip-close"
            onClick={() => setShowBusTip(false)}
            aria-label="Close tip"
          >
            ✕
          </button>
        </div>
      )}
      {showRecenter && (
        <button
          className={`recenter-btn${selectedStop ? " recenter-btn--above-sheet" : ""}`}
          onClick={handleRecenter}
          aria-label="Recenter map"
          title="Recenter map"
        >
          ⌖
        </button>
      )}
      <RouteMenu
        routes={uniqueRoutes}
        hiddenRoutes={effectiveHidden}
        onToggle={handleToggleRoute}
        activeOnly={activeOnly}
        onToggleActiveOnly={handleToggleActiveOnly}
      />
      {selectedStop && (
        <BusSheet
          stop={selectedStop}
          onClose={handleCloseSheet}
          visibleRoutes={uniqueRoutes.filter(
            (r) => !effectiveHidden.has(r.name),
          )}
        />
      )}
    </div>
  );
}

export default App;
