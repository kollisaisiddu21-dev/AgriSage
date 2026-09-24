import { useState, useRef } from 'react';
import { useAppStore } from '../store/useAppStore.ts';
import { api } from '../lib/api.ts';
import { supabase } from '../lib/supabase.ts';
import { Stethoscope, UploadCloud, Camera, Loader2, AlertCircle, X, MapPin } from 'lucide-react';
import styles from '../styles/DiseasePage.module.css';
import { LocationPickerModal } from '../components/LocationPickerModal.tsx';

const DiseasePage = () => {
  const { user, isDemoMode, location, setLocation, updateMLResults, testStates, setTestState } = useAppStore();
  const pageState = testStates['disease'] || {};

  const selectedFile = pageState.selectedFile || null;
  const previewUrl = pageState.previewUrl || null;
  const analyzing = pageState.analyzing || false;
  const error = pageState.error || null;
  const result = pageState.result || null;

  const setSelectedFile = (val: File | null) => setTestState('disease', { selectedFile: val });
  const setPreviewUrl = (val: string | null) => setTestState('disease', { previewUrl: val });
  const setAnalyzing = (val: boolean) => setTestState('disease', { analyzing: val });
  const setError = (val: string | null) => setTestState('disease', { error: val });
  const setResult = (val: any) => setTestState('disease', { result: val });

  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

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

        // Always save to session storage for rich local history
        const finalData = { ...res, location: location ? { lat: location.lat, lon: location.lon } : null };
        const testData = {
          id: Date.now().toString(),
          test_type: 'disease_detection',
          result_data: finalData, // already contains full cause/solution/etc
          created_at: new Date().toISOString()
        };
        const existing = JSON.parse(sessionStorage.getItem('session_ml_tests') || '[]');
        sessionStorage.setItem('session_ml_tests', JSON.stringify([...existing, testData]));

        // Save to history db
        if (user && !isDemoMode) {
          try {
            await supabase.from('history').insert({
              user_id: user.id,
              type: 'Disease Diagnosis',
              result: `Detected: ${res.disease || res.status}`,
              full_data: finalData
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
  const formatAdvisory = (text: any) => {
    if (!text) return null;

    // Safety check in case LLM returns an array or object instead of string
    let processText = text;
    if (typeof processText !== 'string') {
      if (Array.isArray(processText)) processText = processText.join('\n');
      else processText = JSON.stringify(processText);
    }

    const parts = processText.split(/(\*\*.*?\*\*)/g);
    return parts.map((part: string, i: number) =>
      part.startsWith('**') && part.endsWith('**') ?
        <strong key={i} className={styles.strongText}>{part.slice(2, -2)}</strong> :
        part
    );
  };

  return (
    <div className={styles.pageContainer}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          <Stethoscope className={styles.titleIcon} /> Disease Check
        </h1>
        <div className="flex flex-col md:flex-row md:items-center justify-between w-full mt-2 gap-4">
          <p className={styles.subtitle} style={{ marginBottom: 0 }}>Upload a photo of a sick plant leaf for instant diagnosis and treatment advice.</p>
          <button
            onClick={() => setIsLocationModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-primary-700 bg-white/80 backdrop-blur-sm rounded-full shadow-sm border border-primary-100 hover:bg-white transition-colors"
          >
            <MapPin size={16} />
            {location ? 'Change Location Context' : 'Set Location Context'}
          </button>
        </div>
      </header>

      {error && (
        <div className={styles.errorBox}>
          <AlertCircle size={20} /> {error}
        </div>
      )}

      <div className={styles.mainSection}>
        {!isCameraActive ? (
          <div className={styles.uploadContainer}>
            {!previewUrl ? (
              <div className={styles.dropzone}>
                <UploadCloud size={48} className={styles.dropzoneIcon} />
                <h3 className={styles.dropzoneTitle}>Upload an Image</h3>
                <p className={styles.dropzoneSubtitle}>Drag and drop or select a file from your device.</p>

                <div className={styles.actionButtons}>
                  <label className={styles.selectFileBtn}>
                    Select File
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  </label>
                  <button
                    onClick={startCamera}
                    className={styles.cameraBtn}
                  >
                    <Camera size={20} /> Use Camera
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.previewContainer}>
                <div className={styles.previewWrapper}>
                  <img src={previewUrl} alt="Preview" className={`${styles.previewImage} ${analyzing ? 'opacity-90 grayscale-[20%]' : ''}`} />

                  {analyzing && (
                    <div className={styles.scanningOverlay}>
                      <div className={styles.scanLine}></div>
                    </div>
                  )}

                  {!analyzing && (
                    <button
                      onClick={() => { setPreviewUrl(null); setSelectedFile(null); setResult(null); }}
                      className={styles.closeBtn}
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>

                {!result && !analyzing && (
                  <button
                    onClick={handleAnalyze}
                    className={styles.analyzeBtn}
                  >
                    Analyze Image
                  </button>
                )}

                {analyzing && (
                  <div className="mt-8 w-full max-w-lg">
                    <div className="flex items-center justify-center gap-3 mb-6">
                      <Loader2 className="animate-spin text-primary-600" size={24} />
                      <p className="text-primary-800 font-bold text-lg animate-pulse">Running AI Pathology Scan...</p>
                    </div>
                    {/* Skeleton Result Cards */}
                    <div className="flex flex-col gap-5 w-full">
                      <div className="w-full h-16 bg-primary-50 rounded-2xl animate-pulse border border-primary-100 shadow-sm"></div>
                      <div className="w-full h-28 bg-orange-50 rounded-2xl animate-pulse delay-75 border border-orange-100 shadow-sm"></div>
                      <div className="w-full h-28 bg-earth-50 rounded-2xl animate-pulse delay-150 border border-earth-100 shadow-sm"></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className={styles.cameraContainer}>
            <div className={styles.videoWrapper}>
              <video ref={videoRef} autoPlay playsInline className={styles.videoElement} />
              <canvas ref={canvasRef} className="hidden" />
            </div>
            <div className={styles.cameraActions}>
              <button
                onClick={capturePhoto}
                className={styles.captureBtn}
              >
                Capture Photo
              </button>
              <button
                onClick={stopCamera}
                className={styles.cancelBtn}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {result && (
        <div className={`${styles.resultContainer} ${result.status === 'healthy' ? 'border-primary-300 bg-primary-50/30 shadow-primary-500/10' : 'border-red-200 bg-red-50/30'}`}>
          <div className={styles.resultHeader}>
            <h2 className={`${styles.resultTitle} ${result.status === 'healthy' ? 'text-primary-700' : 'text-red-700'}`}>
              {result.status === 'healthy' ? '🌿 Plant is Healthy!' : (typeof result.disease === 'string' ? result.disease.replace(/_/g, ' ') : String(result.disease))}
            </h2>
          </div>
          <div className={styles.resultBody}>
            {result.status === 'disease_detected' ? (
              <div className="flex flex-col gap-6">
                {result.cause && result.cause !== 'N/A' && (
                  <div className="bg-orange-50 p-5 rounded-2xl border border-orange-200 shadow-sm">
                    <h3 className="font-black text-orange-800 mb-2 text-base uppercase tracking-widest flex items-center gap-2">
                      ⚠️ Possible Cause
                    </h3>
                    <p className="text-orange-900 text-base md:text-lg leading-relaxed">{formatAdvisory(result.cause)}</p>
                  </div>
                )}
                {result.solution && result.solution !== 'N/A' && (
                  <div className="bg-primary-50 p-5 rounded-2xl border border-primary-200 shadow-sm">
                    <h3 className="font-black text-primary-800 mb-2 text-base uppercase tracking-widest flex items-center gap-2">
                      💊 Recommended Treatment
                    </h3>
                    <p className="text-primary-900 text-base md:text-lg leading-relaxed whitespace-pre-wrap">{formatAdvisory(result.solution)}</p>
                  </div>
                )}
                {result.advisory && (
                  <div className="bg-earth-50 p-5 rounded-2xl border border-earth-200 shadow-sm">
                    <h3 className="font-black text-earth-800 mb-2 text-base uppercase tracking-widest flex items-center gap-2">
                      📋 Expert Advisory
                    </h3>
                    <p className="text-earth-900 text-base md:text-lg leading-relaxed">{formatAdvisory(result.advisory)}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3 p-6 bg-white rounded-2xl border border-primary-200 shadow-sm">
                <h3 className="font-black text-primary-700 mb-1 text-xl flex items-center gap-2">🎉 Excellent News!</h3>
                <div className="text-earth-800 leading-relaxed text-base md:text-lg">
                  {result.advisory ? formatAdvisory(result.advisory) : "Your plant looks completely healthy!"}
                </div>
              </div>
            )}

            {result.source && (
              <div className="mt-6 pt-3 border-t border-earth-200/60 text-[10px] text-earth-400 font-bold uppercase tracking-widest text-right">
                Analyzed via {result.source}
              </div>
            )}
          </div>
        </div>
      )}

      <LocationPickerModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        defaultLocation={location}
        onSelectLocation={(lat, lon) => setLocation({ lat, lon })}
      />
    </div>
  );
};

export default DiseasePage;
