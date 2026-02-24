import React, { useState, useRef, useEffect } from "react";
import tripIcon from "../assets/trip.png";
import "./RouteMenu.css";

const RouteMenu = ({
  routes = [],
  hiddenRoutes,
  onToggle,
  activeOnly = false,
  onToggleActiveOnly,
}) => {
  const [open, setOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const toastTimer = useRef(null);
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

  // Clean up toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const handleCheckboxChange = () => {
    const willBeActive = !activeOnly;
    if (willBeActive) {
      setShowToast(true);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setShowToast(false), 5000);
    } else {
      setShowToast(false);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    }
    if (onToggleActiveOnly) onToggleActiveOnly();
  };

  return (
    <div className="route-menu-wrapper" ref={wrapperRef}>
      {/* Toast alert */}
      {showToast && (
        <div className="active-only-toast">
          <div className="active-only-toast-content">
            <span className="active-only-toast-text">
              Only routes with active buses are being shown
            </span>
            <button
              className="active-only-toast-close"
              onClick={() => setShowToast(false)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

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

          {/* Active-only checkbox */}
          <label className="active-only-row">
            <input
              type="checkbox"
              className="active-only-checkbox"
              checked={activeOnly}
              onChange={handleCheckboxChange}
            />
            <span className="active-only-label">Active routes only</span>
          </label>

          <div
            className={`route-menu-list${activeOnly ? " route-menu-list--disabled" : ""}`}
          >
            {routes.map((route) => {
              const visible = !hiddenRoutes.has(route.name);
              return (
                <div
                  key={route.name}
                  className={`route-menu-item${activeOnly ? " route-menu-item--disabled" : ""}`}
                >
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
                    disabled={activeOnly}
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
