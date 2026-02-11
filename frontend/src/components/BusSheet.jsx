import React from 'react';
import './BusSheet.css';
import tripIcon from '../assets/trip.png';

const BusSheet = ({ stop, onClose }) => {
    if (!stop) return null;

    return (
        <div className="bus-sheet-overlay" onClick={onClose}>
            <div className="bus-sheet-container" onClick={(e) => e.stopPropagation()}>
                <div className="sheet-handle"></div>

                {/* Header removed as requested */}

                <div className="bus-item">
                    <div className="bus-item-left">
                        <div className="bus-icon-container">
                            <img src={tripIcon} alt="Bus" className="bus-icon-img" />
                        </div>
                        <div className="bus-info">
                            <div className="bus-header-row">
                                <span className="route-badge">CC</span>
                                <span className="bus-name">Crimson Cruiser</span>
                            </div>
                            <div className="bus-route">Route service starts at 6:20 PM</div>
                        </div>
                    </div>
                    <div className="bus-item-right">
                        <div className="bus-eta">
                            10 <span className="min-label">min</span>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default BusSheet;
