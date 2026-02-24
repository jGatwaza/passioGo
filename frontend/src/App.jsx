import React, { useState, useEffect, useMemo, useCallback } from "react";
import MapComponent from "./components/MapComponent";
import BusSheet from "./components/BusSheet";
import RouteMenu from "./components/RouteMenu";
import "./App.css";

function App() {
  const [selectedStop, setSelectedStop] = useState(null);
  const [stops, setStops] = useState([]);
  const [shapes, setShapes] = useState([]);
  const [hiddenRoutes, setHiddenRoutes] = useState(new Set());
  const [activeOnly, setActiveOnly] = useState(false);
  const [activeRouteNames, setActiveRouteNames] = useState(new Set());

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

  const handleStopClick = (stop) => {
    setSelectedStop(stop);
  };

  const handleCloseSheet = () => {
    setSelectedStop(null);
  };

  return (
    <div className="app-container">
      <MapComponent
        stops={stops}
        shapes={visibleShapes}
        onStopClick={handleStopClick}
        onMapClick={handleCloseSheet}
        selectedStop={selectedStop}
      />
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
