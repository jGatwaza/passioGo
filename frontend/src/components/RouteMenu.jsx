import React, { useState, useRef, useEffect } from "react";
import tripIcon from "../assets/trip.png";
import "./RouteMenu.css";

const RouteMenu = ({ routes = [], hiddenRoutes, onToggle }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Close when clicking anywhere outside the menu wrapper
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div className="route-menu-wrapper" ref={wrapperRef}>
      {/* Floating trigger button */}
      <button
        className="route-menu-fab"
        onClick={() => setOpen((o) => !o)}
        aria-label="Toggle routes menu"
      >
        <img src={tripIcon} alt="Routes" className="route-menu-fab-icon" />
      </button>

      {/* Slide-down panel */}
      {open && (
        <div className="route-menu-panel">
          <div className="route-menu-header">Routes</div>
          <div className="route-menu-list">
            {routes.map((route) => {
              const visible = !hiddenRoutes.has(route.name);
              return (
                <div key={route.name} className="route-menu-item">
                  <div className="route-menu-item-left">
                    <span
                      className="route-color-swatch"
                      style={{ backgroundColor: route.color }}
                    />
                    <span className="route-label">
                      {route.name || "Unknown Route"}
                    </span>
                  </div>
                  <button
                    className={`route-toggle ${visible ? "on" : "off"}`}
                    onClick={() => onToggle(route.name)}
                    aria-label={`${visible ? "Hide" : "Show"} ${route.name}`}
                  >
                    <span className="route-toggle-thumb" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteMenu;
