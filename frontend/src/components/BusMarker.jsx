import React, { useEffect, useMemo, useRef, useState } from "react";
import { Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import "./BusMarker.css";

const JITTER_THRESHOLD_METERS = 8;
const TRANSITION_DURATION_MS = 7600;

const easeInOut = (t) => t * t * (3 - 2 * t);

const distanceMeters = (from, to) => {
  const latScale = 111320;
  const avgLatRad = ((from.lat + to.lat) / 2) * (Math.PI / 180);
  const lonScale = 111320 * Math.cos(avgLatRad);
  const dy = (to.lat - from.lat) * latScale;
  const dx = (to.lon - from.lon) * lonScale;
  return Math.sqrt(dx * dx + dy * dy);
};

const createBusIcon = (routeColor, bearing) =>
  L.divIcon({
    className: "custom-bus-icon",
    html: `<div class="bus-marker-shell" style="--route-color:${routeColor};">
             <div class="bus-marker-arrow" style="transform: rotate(${bearing}deg)"></div>
           </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

const BusMarker = ({ vehicle, onClick }) => {
  const markerRef = useRef(null);
  const currentPosRef = useRef({ lat: vehicle.lat, lon: vehicle.lon });
  const [initialPosition] = useState(() => [vehicle.lat, vehicle.lon]);
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
    const rawTarget = { lat: vehicle.lat, lon: vehicle.lon };

    const distance = distanceMeters(from, rawTarget);
    const to =
      distance < JITTER_THRESHOLD_METERS
        ? {
            lat: from.lat + (rawTarget.lat - from.lat) * 0.25,
            lon: from.lon + (rawTarget.lon - from.lon) * 0.25,
          }
        : rawTarget;

    if (animationFrameRef.current)
      cancelAnimationFrame(animationFrameRef.current);

    const start = performance.now();
    const duration = TRANSITION_DURATION_MS;

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
    <Marker
      ref={markerRef}
      position={initialPosition}
      icon={icon}
      eventHandlers={{
        click: () => {
          if (onClick) onClick(vehicle);
        },
      }}
    >
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
