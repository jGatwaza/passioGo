import React from "react";
import { Marker, useMap, Tooltip } from "react-leaflet";
import L from "leaflet";
import "./StopMarker.css";

const createStopIcon = () => {
  return L.divIcon({
    className: "custom-stop-icon",
    html: `<div class="stop-marker-inner">
             <div class="stop-marker-center"></div>
           </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

const StopMarker = ({ position, name, onClick, isSelected }) => {
  const map = useMap();

  const handleClick = () => {
    map.flyTo(position, 17, { duration: 0.8 });
    onClick();
  };

  return (
    <Marker
      position={position}
      icon={createStopIcon()}
      eventHandlers={{ click: handleClick }}
    >
      {isSelected && (
        <Tooltip
          direction="top"
          offset={[0, -10]}
          opacity={1}
          permanent
          className="custom-stop-tooltip"
        >
          <div className="tooltip-content">
            <span className="stop-name">{name}</span>
          </div>
        </Tooltip>
      )}
    </Marker>
  );
};

export default StopMarker;
