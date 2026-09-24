import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore.ts';
import { api } from '../lib/api.ts';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Map as MapIcon, Loader2, AlertCircle } from 'lucide-react';
import styles from '../styles/FieldPage.module.css';

// Fix Leaflet's default icon issue with bundlers
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

const customIcon = new L.Icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const LocationMarker = ({ position, setPosition }: any) => {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position === null ? null : (
    <Marker position={position} icon={customIcon}></Marker>
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
    <div className={styles.pageContainer}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          <MapIcon className={styles.titleIcon} /> Field Monitor
        </h1>
        <p className={styles.subtitle}>Drop a pin on your field to analyze satellite NDVI and vegetation health.</p>
      </header>

      {error && (
        <div className={styles.errorBox}>
          <AlertCircle size={20} /> {error}
        </div>
      )}

      <div className={styles.mainSection}>
        {/* Map Section */}
        <div className={styles.mapContainer}>
          <MapContainer 
            center={position || [15.3647, 75.1240]} 
            zoom={13} 
            scrollWheelZoom={true}
            className={styles.mapElement}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {/* Optional: We could overlay NDVI tiles here if Earth Engine provided a tile URL, but currently it returns a point score */}
            <LocationMarker position={position} setPosition={setPosition} />
          </MapContainer>
          
          <div className={styles.analyzeBtnWrapper}>
            <button 
              onClick={handleAnalyze}
              disabled={analyzing || !position}
              className={styles.analyzeBtn}
            >
              {analyzing ? <Loader2 className="animate-spin" size={20} /> : 'Analyze Selected Area'}
            </button>
          </div>
        </div>

        {/* Results Section */}
        {result && (
          <div className={styles.resultContainer}>
            <h2 className={styles.resultTitle}>Analysis Results</h2>
            
            <div className={styles.resultBody}>
              <div>
                <div className={styles.resultLabel}>Coordinates</div>
                <div className={styles.coordsValue}>
                  {result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}
                </div>
              </div>

              <div>
                <div className={styles.resultLabel}>NDVI Score</div>
                <div className={styles.ndviWrapper}>
                  <div className={`${styles.ndviValue} ${result.ndvi_score > 0.4 ? styles.ndviValueGood : styles.ndviValueBad}` }>
                    {result.ndvi_score}
                  </div>
                  <div className={styles.resultLabel}>(-1 to +1)</div>
                </div>
              </div>

              <div className={styles.statusWrapper}>
                <div className={styles.statusLabel}>Vegetation Status:</div>
                <div className={styles.statusValue}>
                  {result.vegetation_status}
                </div>
              </div>

              {result.llm_analysis && (
                <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--primary)' }}>AI Agronomist Insight:</div>
                  <div style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    {result.llm_analysis}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FieldPage;
