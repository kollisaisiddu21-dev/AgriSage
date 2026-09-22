import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { api } from '../lib/api';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Map as MapIcon, Loader2, AlertCircle } from 'lucide-react';

// Fix Leaflet's default icon issue with bundlers
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

const LocationMarker = ({ position, setPosition }: any) => {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position === null ? null : (
    <Marker position={position}></Marker>
  );
};

const FieldPage = () => {
  const { location, updateMLResults } = useAppStore();
  const [position, setPosition] = useState<L.LatLng | null>(
    location ? new L.LatLng(location.lat, location.lon) : new L.LatLng(15.3647, 75.1240) // Default to Karnataka area
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  // When location changes from global store, update pin
  useEffect(() => {
    if (location && !position) {
      setPosition(new L.LatLng(location.lat, location.lon));
    }
  }, [location]);

  const handleAnalyze = async () => {
    if (!position) return;

    try {
      setAnalyzing(true);
      setError(null);

      const res = await api.analyzeField({
        lat: position.lat,
        lon: position.lng
      });

      if (res.status === 'success') {
        setResult(res);
        
        // Update ML Context
        updateMLResults({
          satellite_ndvi: res.ndvi_score,
          satellite_status: res.vegetation_status
        });
      } else {
        setError("Failed to analyze field. Please try again.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred connecting to the backend.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 flex flex-col h-full">
      <header className="mb-2 shrink-0">
        <h1 className="text-3xl font-bold text-primary-900 flex items-center gap-2">
          <MapIcon className="text-primary-600" /> Field Monitor
        </h1>
        <p className="text-earth-800 mt-2">Drop a pin on your field to analyze satellite NDVI and vegetation health.</p>
      </header>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl flex gap-2 items-center shrink-0">
          <AlertCircle size={20} /> {error}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-[500px]">
        {/* Map Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-earth-100 overflow-hidden flex-1 relative h-96 lg:h-auto">
          <MapContainer 
            center={position || [15.3647, 75.1240]} 
            zoom={13} 
            scrollWheelZoom={true}
            className="w-full h-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {/* Optional: We could overlay NDVI tiles here if Earth Engine provided a tile URL, but currently it returns a point score */}
            <LocationMarker position={position} setPosition={setPosition} />
          </MapContainer>
          
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-[400]">
            <button 
              onClick={handleAnalyze}
              disabled={analyzing || !position}
              className="bg-primary-600 hover:bg-primary-700 disabled:bg-earth-200 disabled:text-earth-500 text-white font-bold py-3 px-8 rounded-full shadow-xl transition-transform active:scale-95 flex items-center gap-2"
            >
              {analyzing ? <Loader2 className="animate-spin" size={20} /> : 'Analyze Selected Area'}
            </button>
          </div>
        </div>

        {/* Results Section */}
        {result && (
          <div className="w-full lg:w-80 bg-white p-6 rounded-2xl shadow-sm border border-earth-100 shrink-0 flex flex-col justify-center animate-in slide-in-from-right">
            <h2 className="text-xl font-bold text-primary-900 mb-6 border-b border-earth-100 pb-2">Analysis Results</h2>
            
            <div className="space-y-6">
              <div>
                <div className="text-sm text-earth-500 mb-1">Coordinates</div>
                <div className="font-mono text-sm bg-earth-50 p-2 rounded border border-earth-100">
                  {result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}
                </div>
              </div>

              <div>
                <div className="text-sm text-earth-500 mb-1">NDVI Score</div>
                <div className="flex items-end gap-2">
                  <div className={`text-4xl font-bold ${result.ndvi_score > 0.4 ? 'text-primary-600' : 'text-accent-500'}`}>
                    {result.ndvi_score}
                  </div>
                  <div className="text-sm text-earth-500 mb-1">(-1 to +1)</div>
                </div>
              </div>

              <div className="bg-primary-50 p-4 rounded-xl border border-primary-100">
                <div className="text-sm font-semibold text-primary-800 mb-1">Vegetation Status:</div>
                <div className="text-primary-900">
                  {result.vegetation_status}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FieldPage;
