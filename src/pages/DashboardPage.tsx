import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore.ts';
import { getCurrentPosition, fetchWeather } from '../lib/external.ts';
import { supabase } from '../lib/supabase.ts';
import { Cloud, Droplets, ThermometerSun, MapPin, History, RefreshCcw } from 'lucide-react';
import styles from '../styles/DashboardPage.module.css';
import { LocationPickerModal } from '../components/LocationPickerModal.tsx';

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user, isDemoMode, location, setLocation, weather, setWeather, updateMLResults } = useAppStore();
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  // Attempt to get location and weather automatically on load
  const loadWeather = async (forceLatLng?: { lat: number, lon: number }) => {
    try {
      setLoadingWeather(true);
      setWeatherError(null);
      let pos = forceLatLng || location;
      if (!pos) {
        pos = await getCurrentPosition();
        setLocation(pos);
      }
      const wData = await fetchWeather(pos.lat, pos.lon);
      setWeather(wData);
      updateMLResults({ rainfall: wData.rainfall }); // Store for ML Context
    } catch (err: any) {
      if (err.code === 1) {
        setWeatherError("PERMISSION_DENIED");
      } else {
        setWeatherError("Could not fetch location or weather. Please enable location services or set it manually.");
      }
    } finally {
      setLoadingWeather(false);
    }
  };

  useEffect(() => {
    if (!weather) {
      loadWeather();
    }

    // Load history
    const loadHistory = async () => {
      let sessionHistory: any[] = [];
      try {
        const sessionTests = JSON.parse(sessionStorage.getItem('session_ml_tests') || '[]');
        sessionHistory = sessionTests.map((t: any) => {
          const crops = t.result_data?.recommended_crops;
          const topCrops = crops ? crops.slice(0, 3).map((c: any) => c.crop).join(', ') : 'Unknown';
          return {
            type: t.test_type === 'crop_recommendation' ? 'Crop Recommendation' :
              t.test_type === 'disease_detection' ? 'Disease Diagnosis' : 'NDVI Analysis',
            result: t.test_type === 'crop_recommendation' ? `Recommended: ${topCrops}` :
              t.test_type === 'disease_detection' ? `Detected: ${t.result_data.disease || t.result_data.status}` :
                `NDVI Score: ${t.result_data.ndvi_score}`,
            created_at: t.created_at,
            full_data: t.result_data // Persist full data for modal
          };
        }).reverse();
      } catch (e) { }

      const deduplicateItems = (items: any[]) => {
        const unique: any[] = [];
        for (const item of items) {
          const timeKey = new Date(item.created_at).getTime();

          const isDuplicate = unique.some(u =>
            u.type === item.type &&
            Math.abs(new Date(u.created_at).getTime() - timeKey) < 60000
          );

          if (!isDuplicate) {
            unique.push(item);
          }
        }
        unique.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return unique.slice(0, 10);
      };

      if (user) {
        try {
          const { data, error } = await supabase
            .from('history')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10);

          if (!error && data) {
            setHistory(deduplicateItems([...sessionHistory, ...data]));
          } else {
            setHistory(deduplicateItems(sessionHistory));
          }
        } catch (err) {
          console.warn("History table might not exist yet.");
          setHistory(deduplicateItems(sessionHistory));
        }
      } else {
        setHistory(deduplicateItems(sessionHistory));
      }
      setLoadingHistory(false);
    };

    loadHistory();
  }, [user, weather, setLocation, setWeather, updateMLResults]);

  if (weatherError === 'PERMISSION_DENIED') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="max-w-md bg-white rounded-3xl p-8 shadow-2xl border border-red-100 text-center animate-fade-in-up">
          <div className="w-24 h-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <MapPin size={48} className="animate-pulse" />
          </div>
          <h2 className="text-2xl font-black text-earth-900 mb-4 tracking-tight">Location Access Required</h2>
          <p className="text-earth-600 mb-8 font-medium leading-relaxed">
            AgriSage requires your precise location to fetch vital meteorological data, soil conditions, and localized crop analytics. 
            <br/><br/>
            Please grant location permissions in your browser settings to proceed.
          </p>
          <button 
            onClick={() => {
              setWeatherError(null);
              loadWeather();
            }}
            className="w-full bg-primary-600 text-white font-bold text-lg py-4 rounded-xl hover:bg-primary-700 transition-all shadow-xl shadow-primary-600/20 md:hover:scale-[1.02]"
          >
            Grant Permission
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          {isDemoMode ? 'Welcome to AgriSage' : `Hello ${user?.user_metadata?.full_name || ''}, Welcome to AgriSage`}
        </h1>
        <p className={styles.subtitle}>Here is your farm's overview for today.</p>
      </header>

      {/* Weather Widget */}
      <section className={styles.section}>
        <div className="flex items-center justify-between mb-4">
          <div className={styles.sectionTitle}>
            <MapPin /> Local Conditions
          </div>
          <button
            onClick={() => setIsLocationModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold text-primary-600 bg-primary-50 rounded-full hover:bg-primary-100 transition-colors"
          >
            <RefreshCcw size={14} />
            Change Location
          </button>
        </div>

        {loadingWeather ? (
          <div className="w-full relative overflow-hidden rounded-3xl bg-white/40 border border-white/60 p-8 backdrop-blur-xl shadow-inner">
            <div className="flex flex-col items-center justify-center gap-6 relative z-10">

              {/* Radar/Spinner Element */}
              <div className="relative flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-tr from-primary-50 to-white shadow-[0_0_40px_rgba(34,197,94,0.15)] border border-white">
                <div className="absolute inset-0 rounded-full border-t-4 border-primary-500 animate-spin opacity-80 duration-1000"></div>
                <div className="absolute inset-2 rounded-full border-r-4 border-accent-400 animate-[spin_1.5s_reverse_infinite] opacity-60"></div>
                <div className="absolute inset-4 rounded-full border-b-4 border-earth-400 animate-[spin_2s_infinite] opacity-40"></div>
                <MapPin className="text-primary-600 animate-pulse" size={28} />
              </div>

              <div className="flex flex-col items-center gap-2 mt-4">
                <h3 className="text-xl font-black text-primary-900 tracking-wide animate-pulse">Acquiring Location</h3>
                <p className="text-xs font-bold text-primary-700/60 tracking-widest uppercase">Fetching Weather Data...</p>
              </div>
            </div>
          </div>
        ) : weatherError ? (
          <div className={styles.errorBox}>{weatherError}</div>
        ) : weather ? (
          <div className={styles.weatherGrid}>
            <div className={styles.weatherCard}>
              <ThermometerSun size={32} className={styles.weatherIconTemp} />
              <div className={styles.title}>{weather.current.temperature}°C</div>
              <div className={styles.weatherLabel}>Current Temp</div>
            </div>

            <div className={styles.weatherCard}>
              <Droplets size={32} className={styles.weatherIconHum} />
              <div className={styles.title}>{weather.current.humidity}%</div>
              <div className={styles.weatherLabel}>Current Hum</div>
            </div>

            <div className={styles.weatherCard}>
              <Cloud size={32} className={styles.weatherIconRain} />
              <div className={styles.title}>{weather.forecast.daily_precipitation?.reduce((a: number, b: number) => a + b, 0).toFixed(1) || 0} mm</div>
              <div className={styles.weatherLabel}>7-Day Rain</div>
            </div>

            <div className={styles.weatherCard}>
              <ThermometerSun size={32} className={styles.weatherIconTemp} style={{ opacity: 0.6 }} />
              <div className={styles.title}>{weather.seasonal.temperature}°C</div>
              <div className={styles.weatherLabel}>Seasonal Temp</div>
            </div>

            <div className={styles.weatherCard}>
              <Cloud size={32} className={styles.weatherIconRain} style={{ opacity: 0.6 }} />
              <div className={styles.title}>{weather.seasonal.rainfall} mm</div>
              <div className={styles.weatherLabel}>Seasonal Rain</div>
            </div>
          </div>
        ) : null}
      </section>

      {/* Recent History Widget */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>
          <History /> Recent Activity
        </div>

        {loadingHistory ? (
          <div className="flex flex-col gap-3 mt-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-earth-100/50 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-earth-200"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-earth-200 rounded w-1/3"></div>
                  <div className="h-3 bg-earth-200 rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : history.length > 0 ? (
          <div className={styles.historyList}>
            {history.map((item, i) => (
              <div
                key={i}
                className={`${styles.historyItem} cursor-pointer hover:bg-earth-50 transition-colors`}
                onClick={() => navigate(`/history/${item.created_at}`, { state: { item } })}
              >
                <div>
                  <div className={styles.historyItemType}>{item.type}</div>
                  <div className={styles.historyItemResult}>{item.result}</div>
                </div>
                <div className={styles.historyItemDate}>
                  {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyHistory}>
            No recent activity found. Try predicting a crop or scanning a leaf!
          </div>
        )}
      </section>

      <LocationPickerModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        defaultLocation={location}
        onSelectLocation={(lat, lon) => loadWeather({ lat, lon })}
      />
    </div>
  );
};

export default DashboardPage;
