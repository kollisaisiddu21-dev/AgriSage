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
    return response.data;
  },
  
  detectDisease: async (formData: FormData) => {
    const response = await apiClient.post('/detect-disease', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  
  analyzeField: async (data: { lat: number; lon: number }) => {
    const response = await apiClient.post('/analyze-field', data);
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
