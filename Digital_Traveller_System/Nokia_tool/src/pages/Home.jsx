import { Link } from 'react-router-dom';
import { 
  Scan,           // Station 1
  Search,         // Station 2
  Activity,       // Station 3
  Bug,            // Station 4
  Microscope,     // Station 5
  ClipboardCheck, // Station 6
  Settings2,      // Station 7
  BarChart3,      // Station 8
  Trash2,         // Station 9
  ArrowRight
} from 'lucide-react';

const stations = [
  { 
    id: 1, 
    name: 'RC IN', 
    icon: Scan, 
    path: '/station/1', 
    desc: 'Scan & Register',
    color: 'bg-blue-100 text-blue-600'
  },
  { 
    id: 2, 
    name: 'Visual Insp.', 
    icon: Search, 
    path: '/station/2', 
    desc: 'Check Damage',
    color: 'bg-purple-100 text-purple-600'
  },
  { 
    id: 3, 
    name: 'RAP & Unit', 
    icon: Activity, 
    path: '/station/3', 
    desc: 'Functional Test',
    color: 'bg-orange-100 text-orange-600'
  },
  { 
    id: 4, 
    name: 'Debug', 
    icon: Bug, 
    path: '/station/4', 
    desc: 'Debug & Modules',
    color: 'bg-rose-100 text-rose-600'
  },
  { 
    id: 5, 
    name: 'Deep Tests', 
    icon: Microscope, 
    path: '/station/5', 
    desc: 'Adv. Diagnostics',
    color: 'bg-cyan-100 text-cyan-600'
  },
  { 
    id: 6, 
    name: 'QC Check', 
    icon: ClipboardCheck, 
    path: '/station/6', 
    desc: 'Final Quality',
    color: 'bg-green-100 text-green-600'
  },
  // ⭐ NAYA STATION 7 INSERTED HERE
  { 
    id: 7, 
    name: 'Lot QC', 
    icon: Settings2, 
    path: '/station/7', 
    desc: 'Final Batch Review',
    color: 'bg-amber-100 text-amber-600'
  },
  // ➡️ SHIFTED STATIONS
  { 
    id: 8, 
    name: 'Dashboard', 
    icon: BarChart3, 
    path: '/station/8', 
    desc: 'Analytics View',
    color: 'bg-indigo-100 text-indigo-600'
  },
  { 
    id: 9, 
    name: 'Detach', 
    icon: Trash2, 
    path: '/station/9', 
    desc: 'Reset Status',
    color: 'bg-slate-200 text-slate-700'
  },
];

export const Home = () => {
  return (
    <div className="min-h-screen p-4 bg-slate-50 relative">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Section */}
        <div className="text-center mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
          <h2 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">
            Digital Traveller <span className="text-blue-600">System</span>
          </h2>
          <p className="text-slate-500 text-sm">Select a workstation to begin operations</p>
        </div>

        {/* Grid Section - Updated to 5 columns for better fit */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-12">
          {stations.map((station, index) => {
            const Icon = station.icon;
            
            return (
              <Link
                key={station.id}
                to={station.path}
                className="group relative bg-white rounded-xl p-4 shadow-sm border border-slate-200 hover:shadow-lg hover:border-blue-300 transition-all duration-300 transform hover:-translate-y-1"
                style={{ animationDelay: `${index * 50}ms` }} 
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-lg ${station.color} transition-transform group-hover:scale-110`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-slate-300 group-hover:text-blue-500 transition-colors">
                    <ArrowRight size={18} />
                  </span>
                </div>
                
                <h3 className="text-sm font-bold text-slate-800 mb-1 group-hover:text-blue-700 transition-colors">
                  {station.name}
                </h3>
                <p className="text-xs font-medium text-slate-500 truncate">
                  {station.desc}
                </p>

                {/* Decorative background number */}
                <div className="absolute bottom-[-5px] right-[0px] text-6xl font-bold text-slate-50 opacity-0 group-hover:opacity-40 transition-opacity select-none pointer-events-none">
                  {station.id}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};