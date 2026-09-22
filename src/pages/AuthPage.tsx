import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { Sprout, Loader2 } from 'lucide-react';

const AuthPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setDemoMode } = useAppStore();

  const handleEmailAuth = async (isSignUp: boolean) => {
    try {
      setLoading(true);
      setError(null);
      const { error } = isSignUp 
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      setError(null);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoMode = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      setDemoMode(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to enter Demo Mode');
      // If anonymous auth fails due to config, fallback to local demo mode state
      setDemoMode(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-earth-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md border border-primary-100">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-primary-100 p-4 rounded-full mb-4">
            <Sprout size={48} className="text-primary-600" />
          </div>
          <h1 className="text-3xl font-bold text-primary-900">AgriSage</h1>
          <p className="text-earth-800 mt-2 text-center">Empowering farmers with intelligent crop insights.</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-earth-900 mb-1">Email</label>
            <input 
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-earth-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
              placeholder="farmer@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-earth-900 mb-1">Password</label>
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-earth-100 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          <div className="flex gap-2">
            <button 
              onClick={() => handleEmailAuth(false)}
              disabled={loading}
              className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex justify-center"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Sign In'}
            </button>
            <button 
              onClick={() => handleEmailAuth(true)}
              disabled={loading}
              className="flex-1 bg-primary-100 hover:bg-primary-200 text-primary-800 font-medium py-2 px-4 rounded-lg transition-colors flex justify-center"
            >
              Sign Up
            </button>
          </div>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-earth-100"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-2 text-sm text-earth-800">Or continue with</span>
            </div>
          </div>

          <button 
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full bg-white border border-earth-100 hover:bg-earth-50 text-earth-900 font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google
          </button>

          <button 
            onClick={handleDemoMode}
            disabled={loading}
            className="w-full bg-accent-400 hover:bg-accent-500 text-earth-900 font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 mt-2"
          >
            Enter Demo Mode (No Login)
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
