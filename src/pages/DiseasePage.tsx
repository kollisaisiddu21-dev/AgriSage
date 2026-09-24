import { useState, useRef } from 'react';
import { useAppStore } from '../store/useAppStore.ts';
import { api } from '../lib/api.ts';
import { supabase } from '../lib/supabase.ts';
import { Stethoscope, UploadCloud, Camera, Loader2, AlertCircle, X } from 'lucide-react';
import styles from '../styles/DiseasePage.module.css';

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
        <p className={styles.subtitle}>Upload a photo of a sick plant leaf for instant diagnosis and treatment advice.</p>
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
                  <img src={previewUrl} alt="Preview" className={styles.previewImage} />
                  <button 
                    onClick={() => { setPreviewUrl(null); setSelectedFile(null); setResult(null); }}
                    className={styles.closeBtn}
                  >
                    <X size={20} />
                  </button>
                </div>
                
                {!result && (
                  <button 
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className={styles.analyzeBtn}
                  >
                    {analyzing ? <Loader2 className="animate-spin" size={24} /> : 'Analyze Image'}
                  </button>
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
        <div className={styles.resultContainer}>
          <div className={styles.resultHeader}>
            <h2 className={styles.resultTitle}>
              {result.disease.replace(/_/g, ' ')}
            </h2>
            {result.confidence && (
              <span className={styles.confidenceBadge}>
                {(result.confidence * 100).toFixed(0)}% Match
              </span>
            )}
          </div>
          <div className={styles.resultBody}>
            <h3 className={styles.advisoryTitle}>Recommended Action Plan:</h3>
            <div className={styles.advisoryContent}>
              {result.advisory ? formatAdvisory(result.advisory) : "Consult with a local agronomist based on this detection."}
            </div>
            {result.source && (
              <div className={styles.advisorySource}>
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
