import React, { useEffect, useMemo, useRef } from "react";
import { Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import "./BusMarker.css";

const easeInOut = (t) => t * t * (3 - 2 * t);

const createBusIcon = (routeColor, bearing) =>
  L.divIcon({
    className: "custom-bus-icon",
    html: `<div class="bus-marker-shell" style="--route-color:${routeColor};">
             <div class="bus-marker-arrow" style="transform: rotate(${bearing}deg)"></div>
           </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

const BusMarker = ({ vehicle }) => {
  const markerRef = useRef(null);
  const currentPosRef = useRef({ lat: vehicle.lat, lon: vehicle.lon });
  const animationFrameRef = useRef(null);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const from = { ...currentPosRef.current };
    const to = { lat: vehicle.lat, lon: vehicle.lon };

    if (animationFrameRef.current)
      cancelAnimationFrame(animationFrameRef.current);

    const start = performance.now();
    const duration = 5500;

    const step = (now) => {
      const raw = Math.min(1, (now - start) / duration);
      const t = easeInOut(raw);
      const lat = from.lat + (to.lat - from.lat) * t;
      const lon = from.lon + (to.lon - from.lon) * t;

      marker.setLatLng([lat, lon]);
      currentPosRef.current = { lat, lon };

      if (raw < 1) {
        animationFrameRef.current = requestAnimationFrame(step);
      }
    };

    animationFrameRef.current = requestAnimationFrame(step);
  }, [vehicle.lat, vehicle.lon]);

  const icon = useMemo(
    () => createBusIcon(vehicle.route_color || "#e310d2", vehicle.bearing || 0),
    [vehicle.route_color, vehicle.bearing],
  );

  return (
    <Marker ref={markerRef} position={[vehicle.lat, vehicle.lon]} icon={icon}>
      <Tooltip direction="top" offset={[0, -14]} opacity={1}>
        <div className="bus-tooltip">
          <div className="bus-tooltip-title">
            {vehicle.route_badge} • Bus {vehicle.bus_number}
          </div>
        </div>
      </Tooltip>
    </Marker>
  );
};

export default BusMarker;
