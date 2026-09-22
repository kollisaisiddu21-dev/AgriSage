import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getCurrentPosition, fetchWeather } from '../lib/external';
import { supabase } from '../lib/supabase';
import { Cloud, Droplets, ThermometerSun, MapPin, Loader2, History } from 'lucide-react';

const DashboardPage = () => {
  const { user, isDemoMode, location, setLocation, weather, setWeather, updateMLResults } = useAppStore();
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
      if (user) {
        try {
          const { data, error } = await supabase
            .from('history')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5);
          
          if (!error && data) {
            setHistory(data);
          }
        } catch (err) {
          console.warn("History table might not exist yet.");
        }
      }
    };
    
    loadHistory();
  }, [user, weather, setLocation, setWeather, updateMLResults]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <header className="flex flex-col gap-2 mb-8">
        <h1 className="text-3xl font-bold text-primary-900">
          Welcome back, {isDemoMode ? 'Demo Farmer' : user?.email?.split('@')[0] || 'Farmer'}
        </h1>
        <p className="text-earth-800">Here is your farm's overview for today.</p>
      </header>

      {/* Weather Widget */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border border-earth-100">
        <div className="flex items-center gap-2 mb-4 text-primary-800 font-semibold text-lg">
          <MapPin /> Local Conditions
        </div>
        
        {loadingWeather ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="animate-spin text-primary-500" size={32} />
          </div>
        ) : weatherError ? (
          <div className="text-red-500 bg-red-50 p-4 rounded-xl">{weatherError}</div>
        ) : weather ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-earth-50 p-6 rounded-xl flex flex-col items-center justify-center gap-2 border border-earth-100">
              <ThermometerSun size={40} className="text-accent-500" />
              <div className="text-3xl font-bold text-primary-900">{weather.temperature}°C</div>
              <div className="text-earth-800 font-medium">Temperature</div>
            </div>
            
            <div className="bg-earth-50 p-6 rounded-xl flex flex-col items-center justify-center gap-2 border border-earth-100">
              <Droplets size={40} className="text-blue-500" />
              <div className="text-3xl font-bold text-primary-900">{weather.humidity}%</div>
              <div className="text-earth-800 font-medium">Humidity</div>
            </div>
            
            <div className="bg-earth-50 p-6 rounded-xl flex flex-col items-center justify-center gap-2 border border-earth-100">
              <Cloud size={40} className="text-gray-500" />
              <div className="text-3xl font-bold text-primary-900">{weather.rainfall} mm</div>
              <div className="text-earth-800 font-medium">Rainfall</div>
            </div>
          </div>
        ) : null}
      </section>

      {/* Recent History Widget */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border border-earth-100">
        <div className="flex items-center gap-2 mb-4 text-primary-800 font-semibold text-lg">
          <History /> Recent Activity
        </div>
        
        {history.length > 0 ? (
          <div className="space-y-3">
            {history.map((item, i) => (
              <div key={i} className="p-4 border border-earth-100 rounded-xl flex justify-between items-center hover:bg-earth-50 transition-colors">
                <div>
                  <div className="font-semibold text-primary-900">{item.type}</div>
                  <div className="text-sm text-earth-800">{item.result}</div>
                </div>
                <div className="text-xs text-earth-800">
                  {new Date(item.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-8 bg-earth-50 rounded-xl border border-earth-100 text-earth-800">
            No recent activity found. Try predicting a crop or scanning a leaf!
          </div>
        )}
      </section>
    </div>
  );
};

export default DashboardPage;
