import { useState, useRef } from 'react';
import { useAppStore } from '../store/useAppStore.ts';
import { api } from '../lib/api.ts';
import { supabase } from '../lib/supabase.ts';
import { Stethoscope, UploadCloud, Camera, Loader2, AlertCircle, X } from 'lucide-react';

const DiseasePage = () => {
  const { user, updateMLResults } = useAppStore();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  
  // Camera state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setError(null);
    }
  };

  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      setError("Could not access camera. Please allow camera permissions.");
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        
        canvasRef.current.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setResult(null);
            stopCamera();
          }
        }, 'image/jpeg');
      }
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    try {
      setAnalyzing(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await api.detectDisease(formData);
      
      if (res.disease) {
        setResult(res);
        
        // Update context for Chat AI
        updateMLResults({
          disease_detected: res.disease,
          disease_confidence: res.confidence ? `${(res.confidence * 100).toFixed(2)}%` : 'N/A'
        });

        // Save to history
        if (user) {
          try {
            await supabase.from('history').insert({
              user_id: user.id,
              type: 'Disease Diagnosis',
              result: `Detected: ${res.disease}`
            });
          } catch (e) {
            console.warn("Could not save to history table");
          }
        }
      } else {
        setError("Could not analyze the image. Please try another one.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during analysis.");
    } finally {
      setAnalyzing(false);
    }
  };

  // Convert markdown-like bold (**) to HTML (simplified)
  const formatAdvisory = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => 
      part.startsWith('**') && part.endsWith('**') ? 
        <strong key={i} className="text-primary-800">{part.slice(2, -2)}</strong> : 
        part
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-primary-900 flex items-center gap-2">
          <Stethoscope className="text-red-500" /> Disease Check
        </h1>
        <p className="text-earth-800 mt-2">Upload a photo of a sick plant leaf for instant diagnosis and treatment advice.</p>
      </header>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl flex gap-2 items-center">
          <AlertCircle size={20} /> {error}
        </div>
      )}

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-earth-100">
        {!isCameraActive ? (
          <div className="flex flex-col gap-6">
            {!previewUrl ? (
              <div className="border-2 border-dashed border-primary-300 rounded-2xl p-12 flex flex-col items-center justify-center text-center bg-primary-50">
                <UploadCloud size={48} className="text-primary-500 mb-4" />
                <h3 className="text-lg font-medium text-primary-900 mb-2">Upload an Image</h3>
                <p className="text-sm text-earth-800 mb-6">Drag and drop or select a file from your device.</p>
                
                <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                  <label className="cursor-pointer bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-6 rounded-xl transition-colors text-center shadow-sm">
                    Select File
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  </label>
                  <button 
                    onClick={startCamera}
                    className="bg-white border border-primary-200 hover:bg-earth-50 text-primary-800 font-medium py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Camera size={20} /> Use Camera
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="relative">
                  <img src={previewUrl} alt="Preview" className="max-h-96 rounded-xl shadow-md border border-earth-100 object-contain" />
                  <button 
                    onClick={() => { setPreviewUrl(null); setSelectedFile(null); setResult(null); }}
                    className="absolute -top-3 -right-3 bg-red-500 text-white p-1 rounded-full shadow-lg hover:bg-red-600"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                {!result && (
                  <button 
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="mt-6 w-full sm:w-auto bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-12 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md"
                  >
                    {analyzing ? <Loader2 className="animate-spin" size={24} /> : 'Analyze Image'}
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-full max-w-lg bg-black rounded-xl overflow-hidden shadow-lg">
              <video ref={videoRef} autoPlay playsInline className="w-full h-auto" />
              <canvas ref={canvasRef} className="hidden" />
            </div>
            <div className="flex gap-4">
              <button 
                onClick={capturePhoto}
                className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-md"
              >
                Capture Photo
              </button>
              <button 
                onClick={stopCamera}
                className="bg-earth-200 hover:bg-earth-300 text-earth-900 font-bold py-3 px-6 rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {result && (
        <div className="bg-accent-50 border border-accent-200 rounded-2xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-accent-100 px-6 py-4 border-b border-accent-200 flex justify-between items-center">
            <h2 className="text-xl font-bold text-primary-900 capitalize">
              {result.disease.replace(/_/g, ' ')}
            </h2>
            {result.confidence && (
              <span className="bg-white text-primary-800 text-sm font-bold px-3 py-1 rounded-full shadow-sm">
                {(result.confidence * 100).toFixed(0)}% Match
              </span>
            )}
          </div>
          <div className="p-6">
            <h3 className="font-semibold text-earth-900 mb-2">Recommended Action Plan:</h3>
            <div className="text-earth-800 leading-relaxed bg-white p-4 rounded-xl border border-accent-100">
              {result.advisory ? formatAdvisory(result.advisory) : "Consult with a local agronomist based on this detection."}
            </div>
            {result.source && (
              <div className="mt-4 text-xs text-earth-500 text-right">
                Analyzed via {result.source}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DiseasePage;
