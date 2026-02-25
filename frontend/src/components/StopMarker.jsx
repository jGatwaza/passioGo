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
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

const StopMarker = ({
  position,
  name,
  buildingName,
  stopDetail,
  description,
  stopCode,
  onClick,
  isSelected,
}) => {
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
      <Tooltip
        direction="top"
        offset={[0, -10]}
        opacity={1}
        permanent={isSelected}
        className="custom-stop-tooltip"
      >
        <div className="tooltip-content">
          <span className="stop-name">{buildingName || name}</span>
          {stopDetail && <span className="stop-detail">{stopDetail}</span>}
          {!stopDetail && description && (
            <span className="stop-description">{description}</span>
          )}
          {stopCode && <span className="stop-code">Stop #{stopCode}</span>}
        </div>
      </Tooltip>
    </Marker>
  );
};

export default StopMarker;
