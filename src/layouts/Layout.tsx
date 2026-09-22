import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../lib/supabase';
import { Sprout, LogOut, LayoutDashboard, Map, Stethoscope, MessageCircle } from 'lucide-react';

const Layout = () => {
  const { setDemoMode, isDemoMode, user } = useAppStore();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    if (isDemoMode) {
      setDemoMode(false);
    } else if (user) {
      await supabase.auth.signOut();
    }
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-earth-50 text-earth-900 flex flex-col md:flex-row">
      {/* Mobile Nav / Desktop Sidebar */}
      <nav className="bg-primary-900 text-white w-full md:w-64 flex-shrink-0">
        <div className="p-4 flex items-center justify-between md:justify-center md:flex-col gap-4">
          <div className="flex items-center gap-2 font-bold text-2xl tracking-wide text-primary-200">
            <Sprout size={32} />
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
          <Link to="/" className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary-800 transition-colors">
            <LayoutDashboard size={20} /> Dashboard
          </Link>
          <Link to="/recommend" className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary-800 transition-colors">
            <Sprout size={20} /> Crop Advisor
          </Link>
          <Link to="/disease" className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary-800 transition-colors">
            <Stethoscope size={20} /> Disease Check
          </Link>
          <Link to="/field" className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary-800 transition-colors">
            <Map size={20} /> Field Monitor
          </Link>
          <Link to="/chat" className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary-800 transition-colors">
            <MessageCircle size={20} /> Agri Chat
          </Link>

          <div className="mt-auto">
            <button 
              onClick={handleSignOut}
              className="flex items-center gap-3 p-3 w-full rounded-xl hover:bg-primary-800 transition-colors text-left"
            >
              <LogOut size={20} /> Sign Out
            </button>
          </div>
        </div>

        {/* Mobile Bottom Bar placeholder for full mobile-first approach */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-primary-900 border-t border-primary-800 flex justify-around p-3 z-50">
          <Link to="/" className="p-2"><LayoutDashboard size={24} /></Link>
          <Link to="/recommend" className="p-2"><Sprout size={24} /></Link>
          <Link to="/disease" className="p-2"><Stethoscope size={24} /></Link>
          <Link to="/field" className="p-2"><Map size={24} /></Link>
          <Link to="/chat" className="p-2"><MessageCircle size={24} /></Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 overflow-y-auto max-h-screen">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
