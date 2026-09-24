import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';

interface Location {
  lat: number;
  lon: number;
}

interface Weather {
  temperature: number;
  humidity: number;
  rainfall: number;
  current: {
    temperature: number;
    humidity: number;
    precipitation: number;
  };
  forecast: {
    daily_max_temp: number[];
    daily_min_temp: number[];
    daily_precipitation: number[];
  };
  seasonal: {
    temperature: number;
    rainfall: number;
  };
}

interface Soil {
  N: number;
  P: number;
  K: number;
  ph: number;
}

interface MLResults {
  recommended_crop?: string;
  all_recommended?: string[];
  disease_detected?: string;
  disease_confidence?: string;
  satellite_ndvi?: number;
  satellite_status?: string;
  soil_n?: number;
  soil_p?: number;
  soil_k?: number;
  rainfall?: number;
}

interface AppState {
  user: User | null;
  isDemoMode: boolean;
  location: Location | null;
  weather: Weather | null;
  soil: Soil | null;
  mlResults: MLResults;
  testStates: Record<string, any>;
  
  setUser: (user: User | null) => void;
  setDemoMode: (isDemo: boolean) => void;
  setLocation: (location: Location | null) => void;
  setWeather: (weather: Weather | null) => void;
  setSoil: (soil: Soil | null) => void;
  updateMLResults: (results: Partial<MLResults>) => void;
  setTestState: (pageId: string, state: any) => void;
}

import { persist } from 'zustand/middleware';

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      isDemoMode: false,
      location: null,
      weather: null,
      soil: null,
      mlResults: {},

      testStates: {},

      setUser: (user) => set({ user }),
      setDemoMode: (isDemoMode) => set({ isDemoMode }),
      setLocation: (location) => set({ location }),
      setWeather: (weather) => set({ weather }),
      setSoil: (soil) => set({ soil }),
      updateMLResults: (results) => set((state) => ({ 
        mlResults: { ...state.mlResults, ...results } 
      })),
      setTestState: (pageId, newState) => set((state) => ({
        testStates: {
          ...state.testStates,
          [pageId]: { ...(state.testStates[pageId] || {}), ...newState }
        }
      })),
    }),
    {
      name: 'agrisage-storage',
      partialize: (state) => ({ isDemoMode: state.isDemoMode }),
    }
  )
);
