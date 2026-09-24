import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore.ts';
import { api } from '../lib/api.ts';
import { supabase } from '../lib/supabase.ts';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Map as MapIcon, AlertCircle, Satellite } from 'lucide-react';
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
  const { user, isDemoMode, location, updateMLResults, testStates, setTestState } = useAppStore();
  const pageState = testStates['field'] || {};

  const position = pageState.position ? new L.LatLng(pageState.position.lat, pageState.position.lng) : (location ? new L.LatLng(location.lat, location.lon) : new L.LatLng(15.3647, 75.1240));
  const analyzing = pageState.analyzing || false;
  const error = pageState.error || null;
  const result = pageState.result || null;

  const setPosition = (pos: L.LatLng | null) => setTestState('field', { position: pos });
  const setAnalyzing = (val: boolean) => setTestState('field', { analyzing: val });
  const setError = (val: string | null) => setTestState('field', { error: val });
  const setResult = (val: any) => setTestState('field', { result: val });

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

        // Always save to session storage for rich local history
        const finalData = { ...res, location: { lat: position.lat, lon: position.lng } };
        const testData = {
          id: Date.now().toString(),
          test_type: 'ndvi_analysis',
          result_data: finalData,
          created_at: new Date().toISOString()
        };
        const existing = JSON.parse(sessionStorage.getItem('session_ml_tests') || '[]');
        sessionStorage.setItem('session_ml_tests', JSON.stringify([...existing, testData]));

        // Save to history db
        if (user && !isDemoMode) {
          try {
            await supabase.from('history').insert({
              user_id: user.id,
              type: 'NDVI Analysis',
              result: `NDVI Score: ${res.ndvi_score}`,
              full_data: finalData
            });
          } catch (e) {
            console.warn("Could not save to history table");
          }
        }
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
          <Satellite className={styles.titleIcon} /> Field Monitor
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
              {analyzing ? 'Scanning Coordinates...' : 'Analyze Selected Area'}
            </button>
          </div>
        </div>

        {/* Loading Animation */}
        {analyzing && (
          <div className="w-full mt-8 bg-white/40 border border-white/60 p-8 backdrop-blur-xl shadow-[inset_0_2px_20px_rgba(255,255,255,0.5)] rounded-3xl relative overflow-hidden flex flex-col items-center justify-center min-h-[350px]">
            <div className="absolute inset-0 bg-gradient-to-b from-primary-50/10 to-primary-100/30"></div>

            {/* Satellite Scanning Animation */}
            <div className="relative w-40 h-40 mb-8">
              {/* Radar rings */}
              <div className="absolute inset-0 border-[3px] border-primary-500 rounded-full animate-ping opacity-20" style={{ animationDuration: '2s' }}></div>
              <div className="absolute inset-4 border-[3px] border-accent-400 rounded-full animate-ping opacity-30 delay-300" style={{ animationDuration: '2s' }}></div>
              <div className="absolute inset-8 border-[3px] border-earth-400 rounded-full animate-ping opacity-40 delay-700" style={{ animationDuration: '2s' }}></div>

              <div className="absolute inset-0 flex items-center justify-center">
                <MapIcon className="text-primary-600 animate-pulse drop-shadow-md" size={56} />
              </div>

              {/* Orbital Satellite */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] animate-[spin_4s_linear_infinite]">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-6 bg-white border-2 border-primary-500 rounded-md shadow-[0_0_20px_rgba(34,197,94,0.6)] flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-accent-500 rounded-full animate-pulse"></div>
                </div>
              </div>
            </div>

            <h3 className="relative z-10 text-2xl font-black text-primary-800 animate-pulse tracking-wide">Connecting to Earth Engine</h3>
            <p className="relative z-10 mt-3 text-primary-700/80 font-medium text-lg text-center max-w-md">Scanning multispectral satellite imagery for accurate vegetation and crop health indices...</p>
          </div>
        )}

        {/* Results Section */}
        {!analyzing && result && (
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
                  <div className={`${styles.ndviValue} ${result.ndvi_score > 0.4 ? styles.ndviValueGood : styles.ndviValueBad}`}>
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
