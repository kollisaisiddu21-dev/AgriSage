import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, History } from 'lucide-react';
import { supabase } from '../lib/supabase.ts';

const HistoryDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [item, setItem] = useState<any | null>(null);

  useEffect(() => {
    // If state is passed via navigate, use it
    if (location.state?.item) {
      setItem(location.state.item);
      return;
    }

    // Otherwise, try to find it in session storage
    const sessionTests = JSON.parse(sessionStorage.getItem('session_ml_tests') || '[]');
    const foundSession = sessionTests.find((t: any) => t.created_at === id);
    
    if (foundSession) {
      const crops = foundSession.result_data?.recommended_crops;
      const topCrops = crops ? crops.slice(0, 3).map((c: any) => c.crop).join(', ') : 'Unknown';
      
      setItem({
        type: foundSession.test_type === 'crop_recommendation' ? 'Crop Recommendation' : 
              foundSession.test_type === 'disease_detection' ? 'Disease Diagnosis' : 'NDVI Analysis',
        result: foundSession.test_type === 'crop_recommendation' ? `Recommended: ${topCrops}` :
                foundSession.test_type === 'disease_detection' ? `Detected: ${foundSession.result_data.disease || foundSession.result_data.status}` :
                `NDVI Score: ${foundSession.result_data.ndvi_score}`,
        created_at: foundSession.created_at,
        full_data: foundSession.result_data
      });
      return;
    }

    // Try fetching from supabase (though it lacks full_data currently)
    const fetchFromDB = async () => {
      const { data } = await supabase.from('history').select('*').eq('created_at', id).single();
      if (data) {
        setItem(data);
      }
    };
    fetchFromDB();
  }, [id, location.state]);

  const formatAdvisory = (text: any) => {
    if (!text) return null;
    
    let processText = text;
    if (typeof processText !== 'string') {
      if (Array.isArray(processText)) processText = processText.join('\n');
      else processText = JSON.stringify(processText);
    }
    
    const parts = processText.split(/(\*\*.*?\*\*)/g);
    return parts.map((part: string, i: number) => 
      part.startsWith('**') && part.endsWith('**') ? 
        <strong key={i} className="text-primary-800 font-bold">{part.slice(2, -2)}</strong> : 
        part
    );
  };

  const renderContent = () => {
    if (!item?.full_data) {
      return (
        <div className="bg-white p-6 rounded-2xl border border-earth-200 shadow-sm">
          <p className="text-earth-800 text-lg leading-relaxed">{item?.result || 'No details available.'}</p>
        </div>
      );
    }

    const data = item.full_data;

    if (item.type === 'Crop Recommendation' && data.recommended_crops) {
      return (
        <div className="flex flex-col gap-6">
          <h3 className="font-black text-xl text-primary-900 mb-2">Recommended Crops</h3>
          {data.recommended_crops.map((c: any, i: number) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-primary-200 shadow-sm flex flex-col sm:flex-row gap-6 hover:shadow-md transition-all">
              {c.image_url && (
                <div className="w-full sm:w-32 h-32 shrink-0">
                  <img src={c.image_url} alt={c.crop} className="w-full h-full object-cover rounded-xl shadow-sm" />
                </div>
              )}
              <div className="flex-1">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-black text-primary-900 text-2xl capitalize">{c.crop}</h4>
                  <span className="bg-primary-100 text-primary-800 font-bold px-3 py-1 rounded-full text-sm">
                    {c.percentage ? `${c.percentage}%` : ''} Success
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-sm font-bold text-earth-600 uppercase tracking-widest mb-1">Why this crop?</p>
                  <p className="text-earth-800 leading-relaxed text-base">{c.reason}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }
    
    if (item.type === 'Disease Diagnosis') {
      return (
        <div className="flex flex-col gap-6">
          <div className="bg-white border border-earth-200 p-8 rounded-2xl shadow-sm">
             <h4 className={`font-black text-3xl mb-6 capitalize ${data.status === 'healthy' ? 'text-primary-700' : 'text-red-700'}`}>
                {data.status === 'healthy' ? '🌿 Plant is Healthy!' : (typeof data.disease === 'string' ? data.disease : String(data.disease || 'Unknown Disease'))}
             </h4>
             
             <div className="flex flex-col gap-6">
                {data.cause && data.cause !== 'N/A' && (
                  <div className="bg-orange-50 p-5 rounded-xl border border-orange-200">
                    <p className="text-sm font-bold text-orange-800 uppercase tracking-widest mb-2 flex items-center gap-2">⚠️ Cause</p>
                    <p className="text-orange-900 text-lg leading-relaxed">{formatAdvisory(data.cause)}</p>
                  </div>
                )}
                {data.solution && data.solution !== 'N/A' && (
                  <div className="bg-primary-50 p-5 rounded-xl border border-primary-200">
                    <p className="text-sm font-bold text-primary-800 uppercase tracking-widest mb-2 flex items-center gap-2">💊 Solution</p>
                    <p className="text-primary-900 text-lg leading-relaxed whitespace-pre-wrap">{formatAdvisory(data.solution)}</p>
                  </div>
                )}
                {data.advisory && (
                  <div className="bg-earth-50 p-5 rounded-xl border border-earth-200">
                    <p className="text-sm font-bold text-earth-800 uppercase tracking-widest mb-2 flex items-center gap-2">📋 Advisory</p>
                    <p className="text-earth-900 text-lg leading-relaxed">{formatAdvisory(data.advisory)}</p>
                  </div>
                )}
             </div>
          </div>
        </div>
      );
    }

    if (item.type === 'NDVI Analysis') {
      return (
        <div className="flex flex-col gap-6">
          <div className="bg-white border border-earth-200 p-8 rounded-2xl shadow-sm">
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
               <div className="bg-primary-50 p-6 rounded-2xl border border-primary-100">
                 <h4 className="font-black text-sm uppercase tracking-widest text-primary-800 mb-2">NDVI Score</h4>
                 <div className="text-4xl font-black text-primary-900">{data.ndvi_score}</div>
               </div>
               <div className="bg-earth-50 p-6 rounded-2xl border border-earth-200">
                 <h4 className="font-black text-sm uppercase tracking-widest text-earth-800 mb-2">Vegetation Status</h4>
                 <div className="text-2xl font-bold text-earth-900 capitalize">{data.vegetation_status || 'Unknown'}</div>
               </div>
             </div>
             
             {data.location && (
               <div className="mt-8 pt-6 border-t border-earth-100">
                 <h4 className="font-black text-sm uppercase tracking-widest text-primary-800 mb-2 flex items-center gap-2">📍 Coordinates</h4>
                 <p className="text-earth-800 text-lg font-medium">
                   Lat: {data.location.lat.toFixed(6)} <br/>
                   Lon: {data.location.lon.toFixed(6)}
                 </p>
               </div>
             )}

             {data.llm_analysis && (
               <div className="mt-6 bg-earth-50 p-6 rounded-2xl border border-earth-200">
                 <h4 className="font-black text-sm uppercase tracking-widest text-earth-800 mb-2 flex items-center gap-2">🤖 AI Agronomist Insight</h4>
                 <p className="text-earth-900 text-lg leading-relaxed">{data.llm_analysis}</p>
               </div>
             )}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white p-6 rounded-2xl border border-earth-200 shadow-sm">
        <p className="text-earth-800 text-lg leading-relaxed">{item.result}</p>
      </div>
    );
  };

  if (!item) {
    return (
      <div className="max-w-4xl mx-auto py-12 flex flex-col items-center justify-center animate-fade-in-up">
        <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-4"></div>
        <p className="text-earth-600 font-medium text-lg">Loading test details...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up pb-12">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="bg-white p-3 rounded-full hover:bg-earth-100 transition-colors shadow-sm border border-earth-200 text-earth-700"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-3xl font-black text-primary-900 flex items-center gap-3">
            <History className="text-primary-600" size={32} />
            Test Details
          </h1>
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-earth-200">
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-8 pb-6 border-b border-earth-100">
          <div>
            <span className="bg-primary-100 text-primary-800 text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full mb-3 inline-block">
              {item.type}
            </span>
            <h2 className="text-2xl font-bold text-earth-900 mt-2">{item.result.split(':')[0]}</h2>
          </div>
          <div className="text-earth-500 font-medium text-right text-sm bg-earth-50 px-4 py-2 rounded-xl">
            {new Date(item.created_at).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} <br/>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-black text-earth-800 mb-4 uppercase tracking-widest">Detailed Report</h3>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default HistoryDetailPage;
