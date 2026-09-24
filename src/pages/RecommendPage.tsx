import { useState } from 'react';
import { useAppStore } from '../store/useAppStore.ts';
import { getCurrentPosition, fetchWeather, fetchSoilData } from '../lib/external.ts';
import { api } from '../lib/api.ts';
import { supabase } from '../lib/supabase.ts';
import { MapPin, Loader2, Leaf, AlertCircle } from 'lucide-react';
import styles from '../styles/RecommendPage.module.css';

interface CropRecommendation {
  crop: string;
  percentage: number;
  image_query: string;
}

const RecommendPage = () => {
  const { user, location, setLocation, weather, setWeather, soil, setSoil, updateMLResults } = useAppStore();
  
  const [loadingData, setLoadingData] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [result, setResult] = useState<CropRecommendation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [manualP, setManualP] = useState<number>(soil?.P || 42);
  const [manualK, setManualK] = useState<number>(soil?.K || 43);
  const [manualN, setManualN] = useState<number>(soil?.N || 90);
  const [manualRainfall, setManualRainfall] = useState<number>(100);

  const handleFetchData = async () => {
    try {
      setLoadingData(true);
      setError(null);
      const pos = await getCurrentPosition();
      setLocation(pos);
      
      const [wData, sData] = await Promise.all([
        fetchWeather(pos.lat, pos.lon),
        api.getQueftsSupply({ lat: pos.lat, lon: pos.lon }).catch((e) => {
          console.warn("Could not fetch QUEFTS supply from ML backend", e);
          return null;
        })
      ]);
      
      setWeather(wData);
      
      // We now automatically fetch seasonal rainfall via NASA POWER
      setManualRainfall(wData.rainfall);
      
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
        temperature: weather.temperature,
        humidity: weather.humidity,
        ph: soil.ph,
        rainfall: manualRainfall
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
          rainfall: weather.rainfall
        });

        // Try to save to history
        if (user) {
          try {
            await supabase.from('history').insert({
              user_id: user.id,
              type: 'Crop Recommendation',
              result: `Recommended Crop: ${topCrop}`
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
          <h2 className={styles.sectionTitle}>Location & Data</h2>
          
          <button 
            onClick={handleFetchData}
            disabled={loadingData}
            className={styles.locationBtn}
          >
            {loadingData ? <Loader2 className="animate-spin" size={20} /> : <MapPin size={20} />}
            {location ? 'Update Location Data' : 'Use My Location'}
          </button>

          {weather && soil && (
            <div className={styles.dataBox}>
              <div className={styles.dataRow}>
                <span className={styles.dataLabel}>Temperature:</span>
                <span className={styles.dataValue}>{weather.temperature}°C</span>
              </div>
              <div className={styles.dataRow}>
                <span className={styles.dataLabel}>Seasonal Rainfall:</span>
                <span className={styles.dataValue}>{weather.rainfall} mm</span>
              </div>
              <div className={styles.dataRow}>
                <span className={styles.dataLabel}>Soil pH:</span>
                <span className={styles.dataValue}>{soil.ph.toFixed(1)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Nutrient Supply Section */}
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
            
            <div>
              <div className={styles.sliderHeader}>
                <label className={styles.sliderLabel}>Seasonal Rainfall (mm)</label>
                <span className={styles.sliderValue}>{manualRainfall}</span>
              </div>
              <input 
                type="range" min="10" max="350" 
                value={manualRainfall} onChange={(e) => setManualRainfall(Number(e.target.value))}
                className={styles.sliderInput}
              />
            </div>
          </div>

          <p className={styles.soilSubtitle} style={{ marginTop: '1rem' }}>
            If you have a recent soil test then change its value using slider.
          </p>
        </div>
      </div>

      <button 
        onClick={handlePredict}
        disabled={predicting || !weather || !soil}
        className={styles.predictBtn}
      >
        {predicting ? <Loader2 className="animate-spin" size={24} /> : 'Predict Best Crop'}
      </button>

      {result && (
        <div className={styles.resultsGrid}>
          {result.map((item, idx) => (
            <div key={idx} className={styles.cropCard}>
              <div className={styles.cropImageWrapper}>
                <img 
                  src={`https://image.pollinations.ai/prompt/${encodeURIComponent(item.image_query || item.crop + ' crop farm')}?width=400&height=300&nologo=true`}
                  alt={item.crop}
                  className={styles.cropImage}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1599839619722-39751411ea63?q=80&w=400&h=300&auto=format&fit=crop';
                  }}
                />
              </div>
              <div className={styles.cropInfo}>
                <h3 className={styles.cropTitle}>{item.crop}</h3>
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
      )}
    </div>
  );
};

export default RecommendPage;
