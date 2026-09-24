import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase.ts';
import { useAppStore } from '../store/useAppStore.ts';
import { Sprout, Loader2, ArrowRight } from 'lucide-react';
import styles from '../styles/AuthPage.module.css';

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
    <div className={styles.pageContainer}>
      <div className={styles.card}>

        <div className={styles.logoContainer}>
          <div className={styles.logoIcon}>
            <Sprout size={48} className="text-primary-600" />
          </div>
          <h1 className={styles.title}>AgriSage</h1>
          <p className={styles.subtitle}>Empowering farmers with intelligent crop insights.</p>
        </div>

        <div className={styles.demoButtonContainer}>
          <button
            onClick={handleDemoMode}
            disabled={loading}
            className={styles.demoButton}
          >
            Enter Demo Mode (No Login)
          </button>
          
          <div className={styles.dividerContainerDemo}>
            <div className={styles.dividerLineWrapper}><div className={styles.dividerLine}></div></div>
            <div className={styles.dividerTextWrapper}><span className={styles.dividerText}>or continue with an account</span></div>
          </div>
        </div>

        {error && (
          <div className={styles.errorBox}>
            {error}
          </div>
        )}

        {/* ----------------- OTP VIEW ----------------- */}
        {showOtp && (
          <div className={styles.viewContainerBottom}>
            <div className={styles.textCenter}>
              <h2 className={styles.otpHeader}>Check your email</h2>
              <p className={styles.otpSubheader}>We've sent a 6-digit code to {email}</p>
            </div>

            <div className={styles.otpInputContainer}>
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
                  className={styles.otpInput}
                />
              ))}
            </div>

            <button
              onClick={handleVerifyOtp}
              disabled={loading || isVerifyOtpDisabled}
              className={styles.primaryButton}
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Verify & Create Account'}
            </button>
          </div>
        )}

        {/* ----------------- SIGN UP VIEW ----------------- */}
        {!showOtp && view === 'signup' && (
          <div className={styles.viewContainerLeft}>
            <div>
              <label className={styles.inputLabel}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.textInput}
                placeholder="farmer@example.com"
              />
            </div>
            <div>
              <label className={styles.inputLabel}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.textInput}
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className={styles.inputLabel}>Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={styles.textInput}
                placeholder="John Doe"
              />
            </div>

            <button
              onClick={handleSignUp}
              disabled={loading || !email || !password || !name}
              className={styles.buttonPrimaryMargin}
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <>Verify Email <ArrowRight size={18} /></>}
            </button>

            <div className={styles.dividerContainer}>
              <div className={styles.dividerLineWrapper}><div className={styles.dividerLine}></div></div>
              <div className={styles.dividerTextWrapper}><span className={styles.dividerText}>Or</span></div>
            </div>

            <button
              onClick={handleGoogleAuth}
              disabled={loading}
              className={styles.googleButton}
            >
              <svg style={{ width: "1.25rem", height: "1.25rem" }} viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
              Sign up with Google
            </button>

            <p className={styles.footerText}>
              Already have an account?{' '}
              <button onClick={() => { setView('signin'); resetForm(); }} className={styles.linkButton}>
                Sign In
              </button>
            </p>
          </div>
        )}

        {/* ----------------- SIGN IN VIEW ----------------- */}
        {!showOtp && view === 'signin' && (
          <div className={styles.viewContainerRight}>
            <div>
              <label className={styles.inputLabel}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.textInput}
                placeholder="farmer@example.com"
              />
            </div>
            <div>
              <label className={styles.inputLabel}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.textInput}
                placeholder="••••••••"
              />
            </div>

            <button
              onClick={handleSignIn}
              disabled={loading || isSignInDisabled}
              className={styles.buttonPrimaryMargin}
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Sign In'}
            </button>

            <div className={styles.dividerContainer}>
              <div className={styles.dividerLineWrapper}><div className={styles.dividerLine}></div></div>
              <div className={styles.dividerTextWrapper}><span className={styles.dividerText}>Or</span></div>
            </div>

            <button
              onClick={handleGoogleAuth}
              disabled={loading}
              className={styles.googleButton}
            >
              <svg style={{ width: "1.25rem", height: "1.25rem" }} viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
              Sign in with Google
            </button>

            <p className={styles.footerText}>
              Don't have an account?{' '}
              <button onClick={() => { setView('signup'); resetForm(); }} className={styles.linkButton}>
                Sign Up
              </button>
            </p>
          </div>
        )}



      </div>
    </div>
  );
};

export default AuthPage;
