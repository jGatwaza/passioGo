import React, { useState, useEffect } from "react";
import MapComponent from "./components/MapComponent";
import BusSheet from "./components/BusSheet";
import "./App.css";

function App() {
  const [selectedStop, setSelectedStop] = useState(null);
  const [stops, setStops] = useState([]);
  const [shapes, setShapes] = useState([]);

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
        shapes={shapes}
        onStopClick={handleStopClick}
        onMapClick={handleCloseSheet}
        selectedStop={selectedStop}
      />
      {selectedStop && (
        <BusSheet stop={selectedStop} onClose={handleCloseSheet} />
      )}
    </div>
  );
}

export default App;
