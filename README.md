# AgriSage 🌱

AgriSage is a modern, mobile-first Multi-Modal AI platform built to revolutionize precision agriculture. Developed for **AgriN Track 4**, AgriSage combines the power of large language models, computer vision, and satellite geospatial data to provide farmers and agricultural experts with actionable, localized insights.

## ✨ Key Features

1. **Crop Recommendation Engine**
   - Analyzes real-time soil metrics (N, P, K, pH) and hyper-local climate data (Temperature, Humidity, Rainfall).
   - Recommends the most optimal crop to maximize yield.
   - Fully interactive visualizations using dynamic charting.

2. **Computer Vision Disease Detection**
   - Upload a photo of a sick plant leaf directly from your phone.
   - Utilizes advanced Computer Vision models to instantly detect diseases, providing a confidence score and a step-by-step biological treatment plan.

3. **Satellite Field Monitor (Google Earth Engine)**
   - Drop a pin anywhere in the world on an interactive map.
   - AgriSage reaches out to the European Space Agency's Sentinel-2 satellites via Google Earth Engine to compute the Normalized Difference Vegetation Index (NDVI).
   - Generates an accurate, localized assessment of your field's current vegetation health.

4. **AgriSage Chatbot Assistant**
   - A dedicated multi-modal AI chatbot built with Groq/Llama3 for lightning-fast inference.
   - The chatbot maintains memory of all your recent ML analyses (crop recommendations, disease scans, and satellite queries) and weaves them together to give holistic, multi-faceted farming advice in your native language.

5. **PWA Mobile-First Experience**
   - Built natively for touch. Installable directly to your phone's home screen.
   - Bypasses traditional mobile web delays for instant, tactile feedback on all interactions.
   - Offline-capable UI routing and optimized viewport rendering.

## 🚀 Technology Stack

### Frontend (Web UI)
- **Framework:** React 18 + Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS (Custom thematic styling, micro-animations, glassmorphism)
- **Routing:** React Router DOM
- **Authentication & Database:** Supabase (PostgreSQL + Auth)
- **Mapping:** Leaflet & React-Leaflet
- **Icons:** Lucide React

### Backend (ML API)
- **Framework:** FastAPI (Python)
- **Deployment:** Google Cloud Run (Fully serverless, autoscaling container)
- **Geospatial Processing:** Google Earth Engine Python API
- **Machine Learning Integration:**
  - HuggingFace SentenceTransformers (Text Embeddings)
  - Groq API (High-speed Llama3 inference)
  - Cerebras API (Vision capabilities)
- **Image Processing:** Pillow & python-multipart

## 📦 Running the Project Locally

### Prerequisites
- Node.js (v18+)
- Python (3.10+)
- Supabase Project (for Authentication)
- Google Cloud Project (with Earth Engine API enabled)

### 1. Frontend Setup
```bash
git clone <repository_url>
cd CFC
npm install

# Create a .env file and add your Supabase credentials:
# VITE_SUPABASE_URL=your_url
# VITE_SUPABASE_ANON_KEY=your_key
# VITE_API_URL=http://127.0.0.1:8000

npm run dev
```

### 2. Backend Setup
```bash
cd ml_backend_workspace/ml_backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create a .env file for backend API keys (Gemini, Groq, Cerebras, GCP Project ID)
uvicorn app.main:app --reload
```

## 🌐 Production Deployment
- **Frontend:** Hosted on Vercel. Continuous deployment integrated directly into the `main` branch.
- **Backend:** Packaged as a Docker container and deployed to Google Cloud Run (`us-central1`). Environment variables are securely injected via Google Secret Manager / Cloud Run configuration.

## 🛡️ Security & Privacy
- All user histories are securely sandboxed via Supabase Row-Level Security (RLS).
- API keys are completely obscured from the frontend, securely residing within the Google Cloud Run server environment.
