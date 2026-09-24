import { useState } from 'react';
import { useAppStore } from '../store/useAppStore.ts';
import { getCurrentPosition, fetchWeather, fetchSoilData } from '../lib/external.ts';
import { api } from '../lib/api.ts';
import { supabase } from '../lib/supabase.ts';
import { MapPin, Loader2, Leaf, AlertCircle, RefreshCcw } from 'lucide-react';
import styles from '../styles/RecommendPage.module.css';
import { LocationPickerModal } from '../components/LocationPickerModal.tsx';

interface CropRecommendation {
  crop: string;
  category: string;
  percentage: number;
  reason?: string;
}

const RecommendPage = () => {
  const { user, isDemoMode, location, setLocation, weather, setWeather, soil, setSoil, updateMLResults, testStates, setTestState } = useAppStore();
  
  const pageState = testStates['recommend'] || {};

  const loadingData = pageState.loadingData || false;
  const predicting = pageState.predicting || false;
  const result = pageState.result || null;
  const error = pageState.error || null;

  const manualP = pageState.manualP ?? (soil?.P || 42);
  const manualK = pageState.manualK ?? (soil?.K || 43);
  const manualN = pageState.manualN ?? (soil?.N || 90);
  
  const setLoadingData = (val: boolean) => setTestState('recommend', { loadingData: val });
  const setPredicting = (val: boolean) => setTestState('recommend', { predicting: val });
  const setResult = (val: CropRecommendation[] | null) => setTestState('recommend', { result: val });
  const setError = (val: string | null) => setTestState('recommend', { error: val });
  
  const setManualP = (val: number) => setTestState('recommend', { manualP: val });
  const setManualK = (val: number) => setTestState('recommend', { manualK: val });
  const setManualN = (val: number) => setTestState('recommend', { manualN: val });

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  const handleFetchData = async (forceLatLng?: { lat: number, lon: number }) => {
    try {
      setLoadingData(true);
      setError(null);
      let pos = forceLatLng || location;
      if (!pos) {
        pos = await getCurrentPosition();
      }
      setLocation(pos);
      
      const [wData, sData] = await Promise.all([
        fetchWeather(pos.lat, pos.lon),
        api.getQueftsSupply({ lat: pos.lat, lon: pos.lon }).catch((e) => {
          console.warn("Could not fetch QUEFTS supply from ML backend", e);
          return null;
        })
      ]);
      
      setWeather(wData);
      
      if (sData && sData.estimated_supply) {
        const est = sData.estimated_supply;
        const ph = sData.observations?.aggregated?.phh2o ? sData.observations.aggregated.phh2o / 10 : 6.5;
        
        const newSoil = { 
          N: est.nitrogen != null ? est.nitrogen : 0, 
          P: est.phosphorus != null ? est.phosphorus : 0, 
          K: est.potassium != null ? est.potassium : 0, 
          ph 
        };
        
        setSoil(newSoil);
        setManualN(est.nitrogen != null ? Math.round(est.nitrogen) : 0);
        setManualP(est.phosphorus != null ? Math.round(est.phosphorus) : 0);
        setManualK(est.potassium != null ? Math.round(est.potassium) : 0);
      } else {
        // Fallback to old behavior if backend is unreachable
        const fallbackSoil = await fetchSoilData(pos.lat, pos.lon);
        setSoil(fallbackSoil);
        setManualN(fallbackSoil.N);
        setManualP(fallbackSoil.P);
        setManualK(fallbackSoil.K);
      }
    } catch (err: any) {
      setError("Could not fetch location or external data.");
    } finally {
      setLoadingData(false);
    }
  };

  const handlePredict = async () => {
    if (!weather || !soil) {
      setError("Please fetch location data first.");
      return;
    }

    try {
      setPredicting(true);
      setError(null);
      
      const payload = {
        N: manualN,
        P: manualP,
        K: manualK,
        temperature: weather.seasonal.temperature,
        humidity: weather.current.humidity,
        ph: soil.ph,
        rainfall: weather.seasonal.rainfall,
        location: location ? { lat: location.lat, lon: location.lon } : null
      };

      const res = await api.predictCrop(payload);
      
      if (res.status === 'success' || res.status === 'partial_success') {
        const crops = res.recommended_crops;
        setResult(crops);
        
        // Update ML context for the Chat AI with the top crop
        const topCrop = crops[0]?.crop || 'Unknown';
        updateMLResults({
          recommended_crop: topCrop,
          all_recommended: crops.map((c: any) => c.crop),
          soil_n: manualN,
          soil_p: manualP,
          soil_k: manualK,
          rainfall: weather.seasonal.rainfall
        });

        // Try to save to history
        const topCropsJoined = crops.slice(0, 3).map((c: any) => c.crop).join(', ');
        
        // Always save to session storage for rich local history
        const testData = {
          id: Date.now().toString(),
          test_type: 'crop_recommendation',
          result_data: { ...res, inputs: payload },
          created_at: new Date().toISOString()
        };
        const existing = JSON.parse(sessionStorage.getItem('session_ml_tests') || '[]');
        sessionStorage.setItem('session_ml_tests', JSON.stringify([...existing, testData]));

        if (user && !isDemoMode) {
          try {
            await supabase.from('history').insert({
              user_id: user.id,
              type: 'Crop Recommendation',
              result: `Recommended: ${topCropsJoined}`,
              full_data: { ...res, inputs: payload }
            });
          } catch (e) {
            console.log("Could not save to history table");
          }
        }
      } else {
        setError("Prediction failed. Please try again.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while connecting to the ML backend.");
    } finally {
      setPredicting(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          <Leaf className={styles.titleIcon} /> Crop Advisor
        </h1>
        <p className={styles.subtitle}>Get AI-powered crop recommendations based on your soil and local weather.</p>
      </header>

      {error && (
        <div className={styles.errorBox}>
          <AlertCircle size={20} /> {error}
        </div>
      )}

      <div className={styles.gridContainer}>
        {/* Data Fetching Section */}
        <div className={styles.cardSection}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={styles.sectionTitle} style={{ marginBottom: 0 }}>Location & Data</h2>
            <button 
              onClick={() => setIsLocationModalOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold text-primary-600 bg-primary-50 rounded-full hover:bg-primary-100 transition-colors"
            >
              <RefreshCcw size={14} />
              Set Map Location
            </button>
          </div>
          
          <button 
            onClick={() => handleFetchData()}
            disabled={loadingData}
            className={styles.locationBtn}
          >
            {loadingData ? <Loader2 className="animate-spin" size={20} /> : <MapPin size={20} />}
            {location ? 'Update Location Data' : 'Use My Location'}
          </button>

          {loadingData && (
            <div className="w-full relative overflow-hidden rounded-3xl bg-white/40 border border-white/60 p-8 backdrop-blur-xl shadow-inner my-4">
              <div className="flex flex-col items-center justify-center gap-6 relative z-10">
                <div className="relative flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-tr from-primary-50 to-white shadow-[0_0_40px_rgba(34,197,94,0.15)] border border-white">
                   <div className="absolute inset-0 rounded-full border-t-4 border-primary-500 animate-spin opacity-80 duration-1000"></div>
                   <div className="absolute inset-2 rounded-full border-r-4 border-accent-400 animate-[spin_1.5s_reverse_infinite] opacity-60"></div>
                   <div className="absolute inset-4 rounded-full border-b-4 border-earth-400 animate-[spin_2s_infinite] opacity-40"></div>
                   <Leaf className="text-primary-600 animate-pulse" size={28} />
                </div>
                
                <div className="flex flex-col items-center gap-2 mt-4 text-center">
                  <h3 className="text-xl font-black text-primary-900 tracking-wide animate-pulse">Connecting to Data Providers</h3>
                  <p className="text-xs font-bold text-primary-700/60 tracking-widest uppercase text-center max-w-xs">Fetching Weather, Soil, & Satellite Data...</p>
                </div>
              </div>
            </div>
          )}

          {!loadingData && weather && soil && (
            <div className={styles.dataBox}>
              <div className={styles.dataRow}>
                <span className={styles.dataLabel}>Current Temp / Hum:</span>
                <span className={styles.dataValue}>{weather.current.temperature}°C / {weather.current.humidity}%</span>
              </div>
              <div className={styles.dataRow}>
                <span className={styles.dataLabel}>Seasonal Temp:</span>
                <span className={styles.dataValue}>{weather.seasonal.temperature}°C</span>
              </div>
              <div className={styles.dataRow}>
                <span className={styles.dataLabel}>Seasonal Rain:</span>
                <span className={styles.dataValue}>{weather.seasonal.rainfall} mm</span>
              </div>
              <div className={styles.dataRow}>
                <span className={styles.dataLabel}>7-Day Rain Forecast:</span>
                <span className={styles.dataValue}>
                  {weather.forecast.daily_precipitation?.reduce((a: number, b: number) => a + b, 0).toFixed(1) || 0} mm
                </span>
              </div>
              <div className={styles.dataRow}>
                <span className={styles.dataLabel}>Soil pH:</span>
                <span className={styles.dataValue}>{soil.ph.toFixed(1)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Nutrient Supply Section */}
        {weather && soil && !loadingData && (
          <div className={styles.cardSection}>
            <h2 className={styles.sectionTitle}>Estimated plant-available nutrient supply</h2>
            <p className={styles.soilSubtitle}>
              If you don't know your N, P, and K values, we estimate them using the QUEFTS model and your GPS location.
            </p>

            <div className={styles.sliderGroup}>
              <div>
                <div className={styles.sliderHeader}>
                  <label className={styles.sliderLabel}>Nitrogen (N)</label>
                  <span className={styles.sliderValue}>{manualN}</span>
                </div>
                <input 
                  type="range" min="0" max="140" 
                  value={manualN} onChange={(e) => setManualN(Number(e.target.value))}
                  className={styles.sliderInput}
                />
              </div>
              
              <div>
                <div className={styles.sliderHeader}>
                  <label className={styles.sliderLabel}>Phosphorus (P)</label>
                  <span className={styles.sliderValue}>{manualP}</span>
                </div>
                <input 
                  type="range" min="5" max="145" 
                  value={manualP} onChange={(e) => setManualP(Number(e.target.value))}
                  className={styles.sliderInput}
                />
              </div>

              <div>
                <div className={styles.sliderHeader}>
                  <label className={styles.sliderLabel}>Potassium (K)</label>
                  <span className={styles.sliderValue}>{manualK}</span>
                </div>
                <input 
                  type="range" min="5" max="205" 
                  value={manualK} onChange={(e) => setManualK(Number(e.target.value))}
                  className={styles.sliderInput}
                />
              </div>
            </div>

            <p className={styles.soilSubtitle} style={{ marginTop: '1rem' }}>
              If you have a recent soil test then change its value using slider.
            </p>
          </div>
        )}
      </div>

      <button 
        onClick={handlePredict}
        disabled={predicting || !weather || !soil}
        className={styles.predictBtn}
      >
        {predicting ? <Loader2 className="animate-spin" size={24} /> : 'Predict Best Crop'}
      </button>

      {predicting && (
        <div className={styles.loaderOverlay}>
          <Leaf className={styles.loaderIcon} />
          <h2 className={styles.loaderText}>AI Agronomist is analyzing your soil data...</h2>
          <div className={styles.skeletonGrid}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className={styles.shimmerCard} />
            ))}
          </div>
        </div>
      )}

      {result && !predicting && (
        <div className={styles.resultsContainer}>
          {['Grains', 'Fruits', 'Vegetables', 'Flowers/Cash Crops'].map((categoryName) => {
            const catCrops = result
              .filter(r => r.category === categoryName || (r.category && r.category.includes(categoryName.split('/')[0])))
              .sort((a, b) => b.percentage - a.percentage); // Sort descending by success rate
              
            if (catCrops.length === 0) return null;

            return (
              <div key={categoryName} className={styles.categorySection}>
                <h2 className={styles.categoryTitle}>{categoryName}</h2>
                <div className={styles.resultsGrid}>
                  {catCrops.map((item, idx) => (
                    <div key={idx} className={styles.cropCard}>
                      <div className={styles.cropImageWrapper}>
                        <img 
                          src={`https://tse1.mm.bing.net/th?q=${encodeURIComponent(item.crop + ' crop farm field')}&w=400&h=300&c=7&rs=1&p=0`}
                          alt={item.crop}
                          className={styles.cropImage}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1599839619722-39751411ea63?q=80&w=400&h=300&auto=format&fit=crop';
                          }}
                        />
                      </div>
                      <div className={styles.cropInfo}>
                        <h3 className={styles.cropTitle}>{item.crop}</h3>
                        {item.reason && <p className={styles.cropReason}>{item.reason}</p>}
                        <div className={styles.progressContainer}>
                          <div className={styles.progressHeader}>
                            <span>Success Rate</span>
                            <span className={styles.progressValue}>{item.percentage}%</span>
                          </div>
                          <div className={styles.progressBarBg}>
                            <div 
                              className={styles.progressBarFill}
                              style={{ width: `${item.percentage}%`, backgroundColor: item.percentage > 80 ? '#22c55e' : item.percentage > 60 ? '#eab308' : '#ef4444' }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      <LocationPickerModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        defaultLocation={location}
        onSelectLocation={(lat, lon) => handleFetchData({ lat, lon })}
      />
    </div>
  );
};

export default RecommendPage;
