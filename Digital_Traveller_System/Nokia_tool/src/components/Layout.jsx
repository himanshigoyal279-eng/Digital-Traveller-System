import { Outlet, Link, useLocation } from 'react-router-dom';
import { Header } from './Header';
// Maine naye station ke liye 'Settings2' aur 'LogOut' (optional) icon add kiya hai
import { 
  Home, Scan, Search, Activity, Bug, Microscope, 
  ClipboardCheck, BarChart3, Truck, Settings2, LogOut 
} from 'lucide-react';

export const Layout = () => {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  // ✅ UPDATED NAVIGATION ITEMS
  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/station/1', icon: Scan, label: 'RC IN' },
    { path: '/station/2', icon: Search, label: 'Visual' },
    { path: '/station/3', icon: Activity, label: 'RAP/Unit' },
    { path: '/station/4', icon: Bug, label: 'Debug' },
    { path: '/station/5', icon: Microscope, label: 'Deep Test' },
    { path: '/station/6', icon: ClipboardCheck, label: 'QC Check' },
    
    
    { path: '/station/7', icon: Settings2, label: 'Lot QC' }, 
    
    
    { path: '/station/8', icon: BarChart3, label: 'Dashboard' }, // Pehle ye 7 tha
    { path: '/station/9', icon: Truck, label: 'Detach' },        // Pehle ye 8 tha
  ];

  return (
    <div className="min-h-screen bg-slate-50 relative">
      <Header />

      {/* Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[95%] mx-auto px-4">
          <div className="flex items-center gap-2 py-3 overflow-x-auto scrollbar-hide">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap
                    ${active 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                      : 'text-slate-600 hover:bg-slate-100 hover:text-blue-600'
                    }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'animate-pulse' : ''}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <main className="animate-in fade-in duration-300 pb-12">
        <Outlet />
      </main>

      
    </div>
  );
};