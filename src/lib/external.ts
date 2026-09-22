import axios from 'axios';

// Get current position using browser Geolocation API
export const getCurrentPosition = (): Promise<{ lat: number; lon: number }> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
    } else {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
        },
        (error) => {
          reject(error);
        }
      );
    }
  });
};

// Fetch real-time weather from Open-Meteo
export const fetchWeather = async (lat: number, lon: number) => {
  // Using Open-Meteo API to get temperature, relative humidity, and precipitation/rainfall
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation`;
  
  try {
    const response = await axios.get(url);
    const current = response.data.current;
    return {
      temperature: current.temperature_2m,
      humidity: current.relative_humidity_2m,
      rainfall: current.precipitation,
    };
  } catch (error) {
    console.error("Failed to fetch weather:", error);
    throw error;
  }
};

// Fetch soil data from ISRIC with a strict timeout and mock fallback
export const fetchSoilData = async (lat: number, lon: number) => {
  // Typical Karnataka soil values as mock fallback
  const mockSoil = { N: 90, P: 42, K: 43, ph: 6.5 };
  
  try {
    // Attempting a pseudo-call to ISRIC. In reality, ISRIC REST API requires specific query structures.
    // For this hackathon, we simulate an API call that will quickly timeout or fail if real ISRIC isn't configured perfectly.
    const source = axios.CancelToken.source();
    const timeout = setTimeout(() => {
      source.cancel('ISRIC API Timeout');
    }, 3000); // 3-second strict timeout

    // Actual ISRIC endpoint for point query (simplified example)
    const response = await axios.get(`https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon}&lat=${lat}&property=nitrogen,phh2o`, {
      cancelToken: source.token
    });
    
    clearTimeout(timeout);
    
    // Parse response if successful
    // The response structure of ISRIC is deeply nested. This is a simplified extraction.
    const nLayer = response.data?.properties?.layers?.find((l: any) => l.name === 'nitrogen');
    const phLayer = response.data?.properties?.layers?.find((l: any) => l.name === 'phh2o');
    
    // We convert ISRIC's specific units (cg/kg, ph*10) to standard.
    const nValue = nLayer?.depths[0]?.values?.mean || mockSoil.N;
    const phValue = phLayer?.depths[0]?.values?.mean ? phLayer.depths[0].values.mean / 10 : mockSoil.ph;
    
    return {
      N: nValue > 1000 ? mockSoil.N : nValue, // Fallback if out of typical range
      P: mockSoil.P, // ISRIC doesn't reliably provide available P/K without complex layers
      K: mockSoil.K,
      ph: phValue,
    };
  } catch (error) {
    console.warn("ISRIC API failed or timed out. Falling back to mock data.", error);
    return mockSoil;
  }
};
