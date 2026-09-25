import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore.ts';
import { supabase } from '../lib/supabase.ts';
import { Sprout, LogOut, LayoutDashboard, Satellite, Stethoscope, MessageCircle, Loader2 } from 'lucide-react';

const Layout = () => {
  const { user, testStates } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    // 1. Clear session storage completely
    sessionStorage.clear();

    // 2. Optimistically clear the entire global memory state
    const { resetStore } = useAppStore.getState();
    resetStore();

    // 3. Fire the backend signout in the background if the user was logged in natively
    if (user) {
      supabase.auth.signOut().catch(e => console.warn("Sign out error", e));
    }

    // 4. Navigate to the login page immediately
    navigate('/auth', { replace: true });
  };

  return (
    <div className="min-h-screen bg-transparent text-earth-900 flex flex-col md:flex-row">
      {/* Mobile Nav / Desktop Sidebar */}
      <nav className="bg-primary-900 text-white w-full md:w-64 flex-shrink-0">
        <div className="p-4 flex items-center justify-between md:justify-center md:flex-col gap-4">
          <div className="flex items-center gap-2 font-bold text-2xl tracking-wide text-primary-200">
            <img src="/favicon.png" alt="AgriSage Logo" className="w-8 h-8 object-contain" />
            AgriSage
          </div>
          <button
            className="md:hidden p-2 bg-primary-800 rounded-lg"
            onClick={handleSignOut}
          >
            <LogOut size={20} />
          </button>
        </div>

        <div className="hidden md:flex flex-col gap-2 p-4 flex-grow">
          <Link to="/" className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 hover:scale-[1.02] ${isActive('/') ? 'bg-primary-700 text-white font-bold shadow-lg' : 'hover:bg-primary-800'}`}>
            <LayoutDashboard size={20} /> Dashboard
          </Link>
          <Link to="/recommend" className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 hover:scale-[1.02] ${isActive('/recommend') ? 'bg-primary-700 text-white font-bold shadow-lg' : 'hover:bg-primary-800'}`}>
            <Sprout size={20} /> Crop Advisor
            {testStates['recommend']?.predicting && <Loader2 size={14} className="animate-spin ml-auto text-accent-300" />}
          </Link>
          <Link to="/disease" className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 hover:scale-[1.02] ${isActive('/disease') ? 'bg-primary-700 text-white font-bold shadow-lg' : 'hover:bg-primary-800'}`}>
            <Stethoscope size={20} /> Disease Check
            {testStates['disease']?.analyzing && <Loader2 size={14} className="animate-spin ml-auto text-accent-300" />}
          </Link>
          <Link to="/field" className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 hover:scale-[1.02] ${isActive('/field') ? 'bg-primary-700 text-white font-bold shadow-lg' : 'hover:bg-primary-800'}`}>
            <Satellite size={20} /> Field Monitor
            {testStates['field']?.analyzing && <Loader2 size={14} className="animate-spin ml-auto text-accent-300" />}
          </Link>
          <Link to="/chat" className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 hover:scale-[1.02] ${isActive('/chat') ? 'bg-primary-700 text-white font-bold shadow-lg' : 'hover:bg-primary-800'}`}>
            <MessageCircle size={20} /> Agri Chat
            {testStates['chat']?.loading && <Loader2 size={14} className="animate-spin ml-auto text-accent-300" />}
          </Link>

          <div className="mt-auto">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 p-3 w-full rounded-xl hover:bg-primary-800 transition-all duration-300 hover:scale-[1.02] text-left"
            >
              <LogOut size={20} /> Sign Out
            </button>
          </div>
        </div>

        {/* Mobile Bottom Bar placeholder for full mobile-first approach */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-primary-900 border-t border-primary-800 flex justify-around p-2 z-50">
          <Link to="/" className={`p-3 rounded-xl transition-colors ${isActive('/') ? 'bg-primary-700 text-white' : ''}`}><LayoutDashboard size={24} /></Link>
          <Link to="/recommend" className={`p-3 rounded-xl transition-colors ${isActive('/recommend') ? 'bg-primary-700 text-white' : ''}`}><Sprout size={24} /></Link>
          <Link to="/disease" className={`p-3 rounded-xl transition-colors ${isActive('/disease') ? 'bg-primary-700 text-white' : ''}`}><Stethoscope size={24} /></Link>
          <Link to="/field" className={`p-3 rounded-xl transition-colors ${isActive('/field') ? 'bg-primary-700 text-white' : ''}`}><Satellite size={24} /></Link>
          <Link to="/chat" className={`p-3 rounded-xl transition-colors ${isActive('/chat') ? 'bg-primary-700 text-white' : ''}`}><MessageCircle size={24} /></Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 md:overflow-y-auto md:max-h-screen">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
