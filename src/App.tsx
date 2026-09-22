import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './store/useAppStore.ts';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.ts';

// Pages (to be created)
import AuthPage from './pages/AuthPage.tsx';
import DashboardPage from './pages/DashboardPage.tsx';
import RecommendPage from './pages/RecommendPage.tsx';
import DiseasePage from './pages/DiseasePage.tsx';
import FieldPage from './pages/FieldPage.tsx';
import ChatPage from './pages/ChatPage.tsx';
import Layout from './layouts/Layout.tsx';

function App() {
  const { user, setUser, isDemoMode } = useAppStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
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
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
