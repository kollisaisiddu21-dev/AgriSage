import axios from 'axios';

const NGROK_BACKEND_URL = 'http://127.0.0.1:8000';

export const apiClient = axios.create({
  baseURL: NGROK_BACKEND_URL,
  headers: {
    'ngrok-skip-browser-warning': 'true',
    'Content-Type': 'application/json',
  },
});

export const api = {
  predictCrop: async (data: { N: number; P: number; K: number; temperature: number; humidity: number; ph: number; rainfall: number }) => {
    const response = await apiClient.post('/predict-crop', data);
    
    // Cache for session so ChatPage can access it
    try {
      const sessionTests = JSON.parse(sessionStorage.getItem('session_ml_tests') || '[]');
      sessionTests.push({
        id: 'session-' + Date.now(),
        test_type: 'crop_recommendation',
        result_data: response.data,
        created_at: new Date().toISOString()
      });
      sessionStorage.setItem('session_ml_tests', JSON.stringify(sessionTests));
    } catch(e) { console.warn("Failed to cache to sessionStorage", e); }
    
    return response.data;
  },
  
  detectDisease: async (formData: FormData) => {
    const response = await apiClient.post('/detect-disease', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    // Cache for session so ChatPage can access it
    try {
      const sessionTests = JSON.parse(sessionStorage.getItem('session_ml_tests') || '[]');
      sessionTests.push({
        id: 'session-' + Date.now(),
        test_type: 'disease_detection',
        result_data: response.data,
        created_at: new Date().toISOString()
      });
      sessionStorage.setItem('session_ml_tests', JSON.stringify(sessionTests));
    } catch(e) { console.warn("Failed to cache to sessionStorage", e); }

    return response.data;
  },
  
  analyzeField: async (data: { lat: number; lon: number }) => {
    let retries = 3;
    let response;
    while(retries > 0) {
      try {
        response = await apiClient.post('/analyze-field', data);
        if (response.data && response.data.status !== 'error') break;
      } catch (e) {}
      retries--;
      if (retries > 0) await new Promise(r => setTimeout(r, 2000));
    }
    
    if (!response || !response.data || response.data.status === 'error') {
      if (response && response.data) return response.data;
      throw new Error("Failed to analyze field. Service is currently busy.");
    }
    
    if (response.data.ndvi_score !== undefined) {
      try {
        const sessionTests = JSON.parse(sessionStorage.getItem('session_ml_tests') || '[]');
        sessionTests.push({
          id: 'session-' + Date.now(),
          test_type: 'ndvi_analysis',
          result_data: response.data,
          created_at: new Date().toISOString()
        });
        sessionStorage.setItem('session_ml_tests', JSON.stringify(sessionTests));
      } catch(e) { console.warn("Failed to cache to sessionStorage", e); }
    }
    
    return response.data;
  },
  
  getAdvisory: async (data: { ml_results: any; language: string; user_query?: string; chat_history?: any[] }) => {
    const response = await apiClient.post('/generate-advisory', data);
    return response.data;
  },
  
  getQueftsSupply: async (data: { lat: number; lon: number }) => {
    // Calling the new backend endpoint for QUEFTS native nutrient supply estimation
    const response = await apiClient.post('/soil/quefts-supply', data);
    return response.data;
  }
};
