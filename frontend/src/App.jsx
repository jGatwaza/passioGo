import React, { useState } from 'react';
import MapComponent from './components/MapComponent';
import BusSheet from './components/BusSheet';
import './App.css';

function App() {
  const [selectedStop, setSelectedStop] = useState(null);

  const handleStopClick = (stop) => {
    setSelectedStop(stop);
  };

  const handleCloseSheet = () => {
    setSelectedStop(null);
  };

  return (
    <div className="app-container">
      <MapComponent
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
