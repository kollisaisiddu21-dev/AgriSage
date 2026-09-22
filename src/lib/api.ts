import axios from 'axios';

const NGROK_BACKEND_URL = 'https://radiated-molasses-ream.ngrok-free.dev';

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
  
  getAdvisory: async (data: { ml_results: any; language: string; user_query: string }) => {
    const response = await apiClient.post('/generate-advisory', data);
    return response.data;
  }
};
