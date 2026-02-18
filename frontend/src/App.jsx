import React, { useState, useEffect, useMemo } from "react";
import MapComponent from "./components/MapComponent";
import BusSheet from "./components/BusSheet";
import RouteMenu from "./components/RouteMenu";
import "./App.css";

function App() {
  const [selectedStop, setSelectedStop] = useState(null);
  const [stops, setStops] = useState([]);
  const [shapes, setShapes] = useState([]);
  const [hiddenRoutes, setHiddenRoutes] = useState(new Set());

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

  // Only pass shapes whose route is not hidden
  const visibleShapes = useMemo(
    () =>
      shapes.filter((s) => !hiddenRoutes.has(s.route_name || "Unknown Route")),
    [shapes, hiddenRoutes],
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
        hiddenRoutes={hiddenRoutes}
        onToggle={handleToggleRoute}
      />
      {selectedStop && (
        <BusSheet stop={selectedStop} onClose={handleCloseSheet} />
      )}
    </div>
  );
}

export default App;
