import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapPin, X, Navigation } from 'lucide-react';
import { getCurrentPosition } from '../lib/external';

// Fix for default marker icon in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation: (lat: number, lon: number) => void;
  defaultLocation: { lat: number; lon: number } | null;
}

const LocationMarker = ({ position, setPosition }: { position: L.LatLng | null, setPosition: (p: L.LatLng) => void }) => {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position === null ? null : (
    <Marker position={position}></Marker>
  );
};

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({ isOpen, onClose, onSelectLocation, defaultLocation }) => {
  const [position, setPosition] = useState<L.LatLng | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (defaultLocation) {
      setPosition(new L.LatLng(defaultLocation.lat, defaultLocation.lon));
    }
  }, [defaultLocation]);

  if (!isOpen) return null;

  const initialCenter = defaultLocation 
    ? new L.LatLng(defaultLocation.lat, defaultLocation.lon) 
    : new L.LatLng(20.5937, 78.9629); // Default to India center if nothing

  const handleUseCurrentLocation = async () => {
    setLoading(true);
    try {
      const pos = await getCurrentPosition();
      const newLatLng = new L.LatLng(pos.lat, pos.lon);
      setPosition(newLatLng);
    } catch (e) {
      alert("Failed to get current location. Please ensure location services are enabled.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-earth-50">
          <h2 className="text-xl font-bold flex items-center gap-2 text-primary-900">
            <MapPin className="text-primary-600" />
            Select Location
          </h2>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="relative h-[400px] w-full bg-gray-100">
          <MapContainer center={initialCenter} zoom={5} style={{ height: '100%', width: '100%', zIndex: 10 }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <LocationMarker position={position} setPosition={setPosition} />
          </MapContainer>
          
          <button 
            onClick={handleUseCurrentLocation}
            disabled={loading}
            className="absolute bottom-6 left-6 z-[1000] bg-white text-primary-700 px-4 py-2 rounded-full shadow-lg font-bold flex items-center gap-2 hover:bg-primary-50 transition-colors border border-gray-200"
          >
            <Navigation size={18} className={loading ? "animate-spin" : ""} />
            {loading ? "Locating..." : "Use My Current Location"}
          </button>
        </div>

        <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-earth-50">
          <div className="text-sm font-medium text-gray-600">
            {position ? (
              <>Selected: {position.lat.toFixed(4)}, {position.lng.toFixed(4)}</>
            ) : (
              <>Click on the map to select a location</>
            )}
          </div>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="px-6 py-2 rounded-full font-bold text-gray-600 hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={() => {
                if (position) {
                  onSelectLocation(position.lat, position.lng);
                  onClose();
                }
              }}
              disabled={!position}
              className="px-6 py-2 rounded-full bg-primary-600 text-white font-bold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-primary-600/30"
            >
              Confirm Location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
