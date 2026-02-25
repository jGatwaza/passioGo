import React, { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import StopMarker from "./StopMarker";
import BusMarker from "./BusMarker";

const CENTER_POSITION = [42.374, -71.1195];
const DEFAULT_ZOOM = 15;

const MapClickHandler = ({ onMapClick }) => {
  useMapEvents({
    click: () => {
      onMapClick();
    },
  });
  return null;
};

const MapViewportWatcher = ({ campusBounds, onOutOfBoundsChange }) => {
  const map = useMapEvents({
    moveend: () => {
      if (!campusBounds) {
        onOutOfBoundsChange(false);
        return;
      }
      const outOfBounds = !map.getBounds().intersects(campusBounds);
      onOutOfBoundsChange(outOfBounds);
    },
    zoomend: () => {
      if (!campusBounds) {
        onOutOfBoundsChange(false);
        return;
      }
      const outOfBounds = !map.getBounds().intersects(campusBounds);
      onOutOfBoundsChange(outOfBounds);
    },
  });

  useEffect(() => {
    if (!campusBounds) {
      onOutOfBoundsChange(false);
      return;
    }
    onOutOfBoundsChange(!map.getBounds().intersects(campusBounds));
  }, [campusBounds, map, onOutOfBoundsChange]);

  return null;
};

const RecenterHandler = ({ recenterRequestToken }) => {
  const map = useMap();

  useEffect(() => {
    if (!recenterRequestToken) return;
    map.flyTo(CENTER_POSITION, DEFAULT_ZOOM, { duration: 0.8 });
  }, [map, recenterRequestToken]);

  return null;
};

const MapComponent = ({
  stops = [],
  shapes = [],
  vehicles = [],
  onStopClick,
  onBusClick,
  onMapClick,
  onOutOfBoundsChange,
  recenterRequestToken = 0,
  selectedStop,
}) => {
  const campusBounds = useMemo(() => {
    const points = [];

    for (const shape of shapes) {
      if (!shape.points) continue;
      for (const point of shape.points) {
        if (Array.isArray(point) && point.length === 2) {
          points.push([point[0], point[1]]);
        }
      }
    }

    if (points.length === 0) {
      for (const stop of stops) {
        if (typeof stop.lat === "number" && typeof stop.lon === "number") {
          points.push([stop.lat, stop.lon]);
        }
      }
    }

    if (points.length === 0) return null;
    return L.latLngBounds(points).pad(0.2);
  }, [shapes, stops]);

  return (
    <MapContainer
      center={CENTER_POSITION}
      zoom={DEFAULT_ZOOM}
      style={{ height: "100%", width: "100%" }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="muted-map-tiles"
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
          buildingName={stop.building_name}
          stopDetail={stop.stop_detail}
          description={stop.description}
          stopCode={stop.stop_code}
          onClick={() => onStopClick(stop)}
          isSelected={selectedStop && selectedStop.stop_id === stop.stop_id}
        />
      ))}

      {vehicles.map((vehicle) => (
        <BusMarker
          key={`${vehicle.vehicle_id || vehicle.trip_id}-${vehicle.route_id || "route"}`}
          vehicle={vehicle}
          onClick={onBusClick}
        />
      ))}

      <MapClickHandler onMapClick={onMapClick} />
      <MapViewportWatcher
        campusBounds={campusBounds}
        onOutOfBoundsChange={onOutOfBoundsChange}
      />
      <RecenterHandler recenterRequestToken={recenterRequestToken} />
    </MapContainer>
  );
};

export default MapComponent;
