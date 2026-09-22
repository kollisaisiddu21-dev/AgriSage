import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getCurrentPosition, fetchWeather, fetchSoilData } from '../lib/external';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { MapPin, Loader2, Leaf, AlertCircle } from 'lucide-react';

const RecommendPage = () => {
  const { user, location, setLocation, weather, setWeather, soil, setSoil, updateMLResults } = useAppStore();
  
  const [loadingData, setLoadingData] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Manual overrides for P and K
  const [manualP, setManualP] = useState<number>(soil?.P || 42);
  const [manualK, setManualK] = useState<number>(soil?.K || 43);
  const [manualN, setManualN] = useState<number>(soil?.N || 90);

  const handleFetchData = async () => {
    try {
      setLoadingData(true);
      setError(null);
      const pos = await getCurrentPosition();
      setLocation(pos);
      
      const [wData, sData] = await Promise.all([
        fetchWeather(pos.lat, pos.lon),
        fetchSoilData(pos.lat, pos.lon)
      ]);
      
      setWeather(wData);
      setSoil(sData);
      setManualN(sData.N);
      setManualP(sData.P);
      setManualK(sData.K);
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
        rainfall: weather.rainfall
      };

      const res = await api.predictCrop(payload);
      
      if (res.status === 'success') {
        const crop = res.recommended_crop;
        setResult(crop);
        
        // Update ML context for the Chat AI
        updateMLResults({
          recommended_crop: crop,
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
              result: `Recommended Crop: ${crop}`
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
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-primary-900 flex items-center gap-2">
          <Leaf className="text-primary-600" /> Crop Advisor
        </h1>
        <p className="text-earth-800 mt-2">Get AI-powered crop recommendations based on your soil and local weather.</p>
      </header>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl flex gap-2 items-center">
          <AlertCircle size={20} /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Data Fetching Section */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-earth-100 space-y-4">
          <h2 className="text-xl font-semibold text-primary-800 mb-4">Location & Data</h2>
          
          <button 
            onClick={handleFetchData}
            disabled={loadingData}
            className="w-full bg-primary-100 hover:bg-primary-200 text-primary-800 font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loadingData ? <Loader2 className="animate-spin" size={20} /> : <MapPin size={20} />}
            {location ? 'Update Location Data' : 'Use My Location'}
          </button>

          {weather && soil && (
            <div className="mt-4 bg-earth-50 p-4 rounded-xl border border-earth-100 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-earth-800">Temperature:</span>
                <span className="font-semibold text-primary-900">{weather.temperature}°C</span>
              </div>
              <div className="flex justify-between">
                <span className="text-earth-800">Rainfall:</span>
                <span className="font-semibold text-primary-900">{weather.rainfall} mm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-earth-800">Soil pH:</span>
                <span className="font-semibold text-primary-900">{soil.ph.toFixed(1)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Soil Tweaking Section */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-earth-100 space-y-4">
          <h2 className="text-xl font-semibold text-primary-800 mb-4">Soil Adjustments</h2>
          <p className="text-sm text-earth-800 mb-4">
            If you have a recent soil test, adjust the values below.
          </p>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-sm font-medium text-earth-900">Nitrogen (N)</label>
                <span className="text-sm text-primary-700 font-semibold">{manualN}</span>
              </div>
              <input 
                type="range" min="0" max="140" 
                value={manualN} onChange={(e) => setManualN(Number(e.target.value))}
                className="w-full accent-primary-600"
              />
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-sm font-medium text-earth-900">Phosphorus (P)</label>
                <span className="text-sm text-primary-700 font-semibold">{manualP}</span>
              </div>
              <input 
                type="range" min="5" max="145" 
                value={manualP} onChange={(e) => setManualP(Number(e.target.value))}
                className="w-full accent-primary-600"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <label className="text-sm font-medium text-earth-900">Potassium (K)</label>
                <span className="text-sm text-primary-700 font-semibold">{manualK}</span>
              </div>
              <input 
                type="range" min="5" max="205" 
                value={manualK} onChange={(e) => setManualK(Number(e.target.value))}
                className="w-full accent-primary-600"
              />
            </div>
          </div>
        </div>
      </div>

      <button 
        onClick={handlePredict}
        disabled={predicting || !weather || !soil}
        className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-earth-100 disabled:text-earth-400 text-white font-bold py-4 px-4 rounded-xl transition-colors flex justify-center text-lg shadow-md"
      >
        {predicting ? <Loader2 className="animate-spin" size={24} /> : 'Predict Best Crop'}
      </button>

      {result && (
        <div className="mt-8 bg-accent-100 border border-accent-300 p-8 rounded-2xl text-center transform animate-in fade-in slide-in-from-bottom-4">
          <h3 className="text-xl text-accent-600 font-medium mb-2">Recommended Crop</h3>
          <div className="text-5xl font-bold text-primary-900 capitalize">{result}</div>
        </div>
      )}
    </div>
  );
};

export default RecommendPage;
