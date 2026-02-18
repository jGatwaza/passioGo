import React from "react";
import { MapContainer, TileLayer, Polyline, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import StopMarker from "./StopMarker";

const CENTER_POSITION = [42.374, -71.1195];

const MapClickHandler = ({ onMapClick }) => {
  useMapEvents({
    click: () => {
      onMapClick();
    },
  });
  return null;
};

const MapComponent = ({
  stops = [],
  shapes = [],
  onStopClick,
  onMapClick,
  selectedStop,
}) => {
  return (
    <MapContainer
      center={CENTER_POSITION}
      zoom={15}
      style={{ height: "100%", width: "100%" }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {shapes.map((shape) => (
        <Polyline
          key={shape.shape_id}
          positions={shape.points}
          pathOptions={{
            color: shape.color,
            weight: 3.5,
            opacity: 0.85,
          }}
        />
      ))}

      {stops.map((stop) => (
        <StopMarker
          key={stop.stop_id}
          position={[stop.lat, stop.lon]}
          name={stop.name}
          onClick={() => onStopClick(stop)}
          isSelected={selectedStop && selectedStop.stop_id === stop.stop_id}
        />
      ))}

      <MapClickHandler onMapClick={onMapClick} />
    </MapContainer>
  );
};

export default MapComponent;
