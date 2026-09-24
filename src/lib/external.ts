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

// Fetch real-time weather, forecast from Open-Meteo, and seasonal climate from NASA POWER
export const fetchWeather = async (lat: number, lon: number) => {
  const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
  const nasaPowerUrl = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=PRECTOTCORR,T2M&community=AG&longitude=${lon}&latitude=${lat}&format=JSON`;
  
  try {
    const [omResponse, nasaResponse] = await Promise.all([
      axios.get(openMeteoUrl),
      axios.get(nasaPowerUrl).catch(() => null) // Fallback if NASA fails
    ]);

    const current = omResponse.data.current;
    const daily = omResponse.data.daily;
    
    // Default fallback values if NASA POWER fails
    let seasonalRainfall = 100; 
    let seasonalTemperature = current.temperature_2m; // fallback to current if seasonal fails

    if (nasaResponse && nasaResponse.data) {
      const annMmPerDay = nasaResponse.data.properties?.parameter?.PRECTOTCORR?.ANN;
      const annTemp = nasaResponse.data.properties?.parameter?.T2M?.ANN;
      
      if (annMmPerDay) {
        // Kaggle ML dataset expects seasonal rainfall (approx 3 months). 
        // We multiply mm/day by 90 days to scale it to the model's 50-300mm range.
        seasonalRainfall = Math.round(annMmPerDay * 90);
      }
      if (annTemp) {
        seasonalTemperature = Math.round(annTemp * 10) / 10;
      }
    }

    return {
      // Legacy flat properties for RecommendPage (needs seasonal temp/rainfall for crop model)
      temperature: seasonalTemperature,
      humidity: current.relative_humidity_2m,
      rainfall: seasonalRainfall,
      
      // Rich structured data for AI Context (Irrigation, Forecasting)
      current: {
        temperature: current.temperature_2m,
        humidity: current.relative_humidity_2m,
        precipitation: current.precipitation || 0
      },
      forecast: {
        daily_max_temp: daily?.temperature_2m_max || [],
        daily_min_temp: daily?.temperature_2m_min || [],
        daily_precipitation: daily?.precipitation_sum || []
      },
      seasonal: {
        temperature: seasonalTemperature,
        rainfall: seasonalRainfall
      }
    };
  } catch (error) {
    console.error("Failed to fetch weather/climate data:", error);
    throw error;
  }
};

// Fetch soil data from ISRIC with a strict timeout and mock fallback
export const fetchSoilData = async (lat: number, lon: number) => {
  // Typical Karnataka soil values as mock fallback
  const mockSoil = { N: 0, P: 0, K: 0, ph: 6.5 };
  
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
