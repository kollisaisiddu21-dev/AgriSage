import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase.ts';
import { useAppStore } from '../store/useAppStore.ts';
import { Sprout, Loader2, ArrowRight } from 'lucide-react';

const AuthPage = () => {
  const [view, setView] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { setDemoMode } = useAppStore();

  const handleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Manually check if the user exists first using our custom RPC
      const { data: userExists, error: checkError } = await supabase.rpc('check_user_exists', {
        lookup_email: email
      });

      if (checkError) throw checkError;

      if (userExists) {
        setError("User already exists... try signing in...");
        setEmail('');
        setPassword('');
        setName('');
        setView('signin');
        return; // Stop execution here!
      }

      // 2. If user doesn't exist, proceed with signup
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name
          }
        }
      });

      if (error) {
        throw error;
      } else {
        // Success - show OTP UI
        setShowOtp(true);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const token = otp.join('');
    if (token.length !== 6) return;

    try {
      setLoading(true);
      setError(null);
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'signup'
      });

      if (error) throw error;
      // On success, session is automatically established
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
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      setDemoMode(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to enter Demo Mode');
      setDemoMode(true);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return; // Prevent pasting multiple chars here

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-advance
    if (value !== '' && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && otp[index] === '' && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setError(null);
    setShowOtp(false);
    setOtp(['', '', '', '', '', '']);
  };

  const isSignInDisabled = !email || !password;
  const isVerifyOtpDisabled = otp.join('').length !== 6;

  return (
    <div className="min-h-screen bg-earth-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md border border-primary-100 relative overflow-hidden">

        <div className="flex flex-col items-center mb-8">
          <div className="bg-primary-100 p-4 rounded-full mb-4">
            <Sprout size={48} className="text-primary-600" />
          </div>
          <h1 className="text-3xl font-bold text-primary-900">AgriSage</h1>
          <p className="text-earth-800 mt-2 text-center">Empowering farmers with intelligent crop insights.</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm font-medium border border-red-100">
            {error}
          </div>
        )}

        {/* ----------------- OTP VIEW ----------------- */}
        {showOtp && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center">
              <h2 className="text-xl font-bold text-primary-900">Check your email</h2>
              <p className="text-sm text-earth-600 mt-1">We've sent a 6-digit code to {email}</p>
            </div>

            <div className="flex justify-between gap-2 px-4">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { otpRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="w-12 h-14 text-center text-2xl font-bold border-2 border-earth-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none transition-colors"
                />
              ))}
            </div>

            <button
              onClick={handleVerifyOtp}
              disabled={loading || isVerifyOtpDisabled}
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-earth-200 disabled:text-earth-500 text-white font-bold py-3 px-4 rounded-xl transition-colors flex justify-center items-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Verify & Create Account'}
            </button>
          </div>
        )}

        {/* ----------------- SIGN UP VIEW ----------------- */}
        {!showOtp && view === 'signup' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
            <div>
              <label className="block text-sm font-medium text-earth-900 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-earth-50 border border-earth-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                placeholder="farmer@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-earth-900 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-earth-50 border border-earth-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-earth-900 mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-earth-50 border border-earth-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                placeholder="John Doe"
              />
            </div>

            <button
              onClick={handleSignUp}
              disabled={loading || !email || !password || !name}
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-earth-200 disabled:text-earth-500 text-white font-bold py-3 px-4 rounded-xl transition-colors flex justify-center items-center gap-2 mt-4"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <>Verify Email <ArrowRight size={18} /></>}
            </button>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-earth-200"></div></div>
              <div className="relative flex justify-center"><span className="bg-white px-3 text-sm text-earth-500 font-medium">Or</span></div>
            </div>

            <button
              onClick={handleGoogleAuth}
              disabled={loading}
              className="w-full bg-white border-2 border-earth-200 hover:bg-earth-50 text-earth-900 font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
              Sign up with Google
            </button>

            <p className="text-center text-earth-600 mt-6">
              Already have an account?{' '}
              <button onClick={() => { setView('signin'); resetForm(); }} className="text-primary-600 font-bold hover:underline">
                Sign In
              </button>
            </p>
          </div>
        )}

        {/* ----------------- SIGN IN VIEW ----------------- */}
        {!showOtp && view === 'signin' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <div>
              <label className="block text-sm font-medium text-earth-900 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-earth-50 border border-earth-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                placeholder="farmer@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-earth-900 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-earth-50 border border-earth-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                placeholder="••••••••"
              />
            </div>

            <button
              onClick={handleSignIn}
              disabled={loading || isSignInDisabled}
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-earth-200 disabled:text-earth-500 text-white font-bold py-3 px-4 rounded-xl transition-colors flex justify-center mt-4"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Sign In'}
            </button>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-earth-200"></div></div>
              <div className="relative flex justify-center"><span className="bg-white px-3 text-sm text-earth-500 font-medium">Or</span></div>
            </div>

            <button
              onClick={handleGoogleAuth}
              disabled={loading}
              className="w-full bg-white border-2 border-earth-200 hover:bg-earth-50 text-earth-900 font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
              Sign in with Google
            </button>

            <p className="text-center text-earth-600 mt-6">
              Don't have an account?{' '}
              <button onClick={() => { setView('signup'); resetForm(); }} className="text-primary-600 font-bold hover:underline">
                Sign Up
              </button>
            </p>
          </div>
        )}

        {/* ----------------- SHARED FOOTER ----------------- */}
        <div className="mt-8 pt-6 border-t border-earth-100">
          <button
            onClick={handleDemoMode}
            disabled={loading}
            className="w-full bg-accent-100 hover:bg-accent-200 text-accent-800 font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            Enter Demo Mode (No Login)
          </button>
        </div>

      </div>
    </div>
  );
};

export default AuthPage;
