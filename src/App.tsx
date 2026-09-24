import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './store/useAppStore.ts';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.ts';
import { WifiOff } from 'lucide-react';

// Pages (to be created)
import AuthPage from './pages/AuthPage.tsx';
import DashboardPage from './pages/DashboardPage.tsx';
import RecommendPage from './pages/RecommendPage.tsx';
import DiseasePage from './pages/DiseasePage.tsx';
import FieldPage from './pages/FieldPage.tsx';
import ChatPage from './pages/ChatPage.tsx';
import Layout from './layouts/Layout.tsx';

import HistoryDetailPage from './pages/HistoryDetailPage.tsx';

function App() {
  const { user, setUser, isDemoMode } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null);
      })
      .catch((err) => {
        console.warn("Supabase session error:", err);
      })
      .finally(() => {
        setLoading(false);
      });

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [setUser]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-earth-50 text-primary-800">Loading AgriSage...</div>;
  }

  const isAuthenticated = !!user || isDemoMode;

  return (
    <>
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-red-500 text-white p-3 flex items-center justify-center gap-3 font-bold shadow-lg animate-fade-in-down">
          <WifiOff size={20} /> Connection Lost. AgriSage requires a network connection to function properly.
        </div>
      )}
      <Router>
        <Routes>
        <Route 
          path="/auth" 
          element={!isAuthenticated ? <AuthPage /> : <Navigate to="/" />} 
        />
        
        {/* Protected Routes */}
        <Route element={isAuthenticated ? <Layout /> : <Navigate to="/auth" />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/recommend" element={<RecommendPage />} />
          <Route path="/disease" element={<DiseasePage />} />
          <Route path="/field" element={<FieldPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/history/:id" element={<HistoryDetailPage />} />
        </Route>
        
        {/* Catch-all route to prevent blank screens on invalid URLs */}
        <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </>
  );
}

export default App;
