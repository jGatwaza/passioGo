import React from 'react';
import { MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import StopMarker from './StopMarker';

// Harvard/Radcliffe Quad interactions
const CENTER_POSITION = [42.3800, -71.1250];

const MapClickHandler = ({ onMapClick }) => {
    useMapEvents({
        click: () => {
            onMapClick();
        },
    });
    return null;
};

const MapComponent = ({ onStopClick, onMapClick, selectedStop }) => {
    return (
        <MapContainer
            center={CENTER_POSITION}
            zoom={16}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <StopMarker
                position={[42.3820, -71.1255]}
                name="Quad"
                onClick={() => onStopClick({ name: "Quad" })}
                isSelected={selectedStop && selectedStop.name === "Quad"}
            />
            <MapClickHandler onMapClick={onMapClick} />
        </MapContainer>
    );
};

export default MapComponent;
