import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore.ts';
import { getCurrentPosition, fetchWeather } from '../lib/external.ts';
import { supabase } from '../lib/supabase.ts';
import { Cloud, Droplets, ThermometerSun, MapPin, Loader2, History } from 'lucide-react';
import styles from '../styles/DashboardPage.module.css';

const DashboardPage = () => {
  const { user, isDemoMode, setLocation, weather, setWeather, updateMLResults } = useAppStore();
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    // Attempt to get location and weather automatically on load
    const loadWeather = async () => {
      try {
        setLoadingWeather(true);
        const pos = await getCurrentPosition();
        setLocation(pos);
        const wData = await fetchWeather(pos.lat, pos.lon);
        setWeather(wData);
        updateMLResults({ rainfall: wData.rainfall }); // Store for ML Context
      } catch (err: any) {
        setWeatherError("Could not fetch location or weather. Please enable location services.");
      } finally {
        setLoadingWeather(false);
      }
    };

    if (!weather) {
      loadWeather();
    }

    // Load history
    const loadHistory = async () => {
      let sessionHistory: any[] = [];
      try {
        const sessionTests = JSON.parse(sessionStorage.getItem('session_ml_tests') || '[]');
        sessionHistory = sessionTests.map((t: any) => ({
          type: t.test_type === 'crop_recommendation' ? 'Crop Recommendation' : 
                t.test_type === 'disease_detection' ? 'Disease Diagnosis' : 'NDVI Analysis',
          result: t.test_type === 'crop_recommendation' ? `Recommended: ${t.result_data.recommended_crops?.[0]?.crop || 'Unknown'}` :
                  t.test_type === 'disease_detection' ? `Detected: ${t.result_data.disease}` :
                  `NDVI Score: ${t.result_data.ndvi_score}`,
          created_at: t.created_at
        })).reverse();
      } catch(e) {}

      if (user) {
        try {
          const { data, error } = await supabase
            .from('history')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5);

          if (!error && data) {
            setHistory([...sessionHistory, ...data].slice(0, 10));
          } else {
            setHistory(sessionHistory);
          }
        } catch (err) {
          console.warn("History table might not exist yet.");
          setHistory(sessionHistory);
        }
      } else {
        setHistory(sessionHistory);
      }
    };

    loadHistory();
  }, [user, weather, setLocation, setWeather, updateMLResults]);

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
        <div className={styles.sectionTitle}>
          <MapPin /> Local Conditions
        </div>

        {loadingWeather ? (
          <div className={styles.loaderContainer}>
            <Loader2 className={styles.spinner} size={32} />
          </div>
        ) : weatherError ? (
          <div className={styles.errorBox}>{weatherError}</div>
        ) : weather ? (
          <div className={styles.weatherGrid}>
            <div className={styles.weatherCard}>
              <ThermometerSun size={40} className={styles.weatherIconTemp} />
              <div className={styles.title}>{weather.temperature}°C</div>
              <div className={styles.weatherLabel}>Temperature</div>
            </div>

            <div className={styles.weatherCard}>
              <Droplets size={40} className={styles.weatherIconHum} />
              <div className={styles.title}>{weather.humidity}%</div>
              <div className={styles.weatherLabel}>Humidity</div>
            </div>

            <div className={styles.weatherCard}>
              <Cloud size={40} className={styles.weatherIconRain} />
              <div className={styles.title}>{weather.rainfall} mm</div>
              <div className={styles.weatherLabel}>Rainfall</div>
            </div>
          </div>
        ) : null}
      </section>

      {/* Recent History Widget */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>
          <History /> Recent Activity
        </div>

        {history.length > 0 ? (
          <div className={styles.historyList}>
            {history.map((item, i) => (
              <div key={i} className={styles.historyItem}>
                <div>
                  <div className={styles.historyItemType}>{item.type}</div>
                  <div className={styles.historyItemResult}>{item.result}</div>
                </div>
                <div className={styles.historyItemDate}>
                  {new Date(item.created_at).toLocaleDateString()}
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
    </div>
  );
};

export default DashboardPage;
