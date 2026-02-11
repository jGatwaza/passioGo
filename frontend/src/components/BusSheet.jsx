import React, { useEffect, useState } from 'react';
import './BusSheet.css';
import tripIcon from '../assets/trip.png';

const BusSheet = ({ stop, onClose }) => {
    const [busData, setBusData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!stop || stop.name !== "Quad") return;

        const STOP_ID = "5049";

        const fetchData = () => {
            fetch(`http://localhost:8000/api/stop/${STOP_ID}`)
                .then(res => res.json())
                .then(data => {
                    if (data.buses && data.buses.length > 0) {
                        setBusData(data.buses[0]);
                    } else {
                        setBusData(null);
                    }
                    setLoading(false);
                })
                .catch(err => {
                    console.error("Failed to fetch bus data", err);
                    setLoading(false);
                });
        };

        // Initial fetch
        fetchData();

        // Poll every 10 seconds
        const intervalId = setInterval(fetchData, 10000);

        return () => clearInterval(intervalId);
    }, [stop]);

    if (!stop) return null;

    // Helper for color mapping
    const getStatusColor = (statusColor) => {
        switch (statusColor) {
            case 'Green': return '#2ecc71'; // Emerald Green
            case 'Blue': return '#3498db'; // Peter River Blue
            case 'Orange': return '#e67e22'; // Carrot Orange
            case 'Red': return '#e74c3c'; // Alizarin Red
            default: return '#e310d2'; // Default/Unknown Purple
        }
    };

    return (
        <div className="bus-sheet-overlay" onClick={onClose}>
            <div className="bus-sheet-container" onClick={(e) => e.stopPropagation()}>
                <div className="sheet-handle"></div>

                {/* Header removed as requested */}

                {loading ? (
                    <div className="bus-item" style={{ justifyContent: 'center', padding: '20px' }}>
                        Loading...
                    </div>
                ) : busData ? (
                    <div className="bus-item">
                        <div className="bus-item-left" style={{ backgroundColor: busData.route_color || '#e310d2' }}>
                            <div className="bus-icon-container">
                                <img src={tripIcon} alt="Bus" className="bus-icon-img" />
                            </div>
                            <div className="bus-info">
                                <div className="bus-header-row">
                                    <span className="route-badge" style={{ color: busData.route_color || '#e310d2' }}>
                                        {busData.route_badge}
                                    </span>
                                    <span className="bus-name">{busData.route_name}</span>
                                </div>
                                <div className="bus-route">
                                    Bus {busData.bus_number}
                                    {busData.scheduled_time && (
                                        <span className="bus-schedule"> • Scheduled: {busData.scheduled_time}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="bus-item-right" style={{ borderRight: `5px solid ${busData.route_color || '#e310d2'}` }}>
                            <div className="bus-eta" style={{ color: getStatusColor(busData.color) }}>
                                {busData.eta_min} <span className="min-label">min</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bus-item" style={{ justifyContent: 'center', padding: '20px' }}>
                        No upcoming buses found.
                    </div>
                )}
            </div>
        </div >
    );
};

export default BusSheet;
