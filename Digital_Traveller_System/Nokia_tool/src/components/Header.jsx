export const Header = () => {
  return (
    <header className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-white to-blue-100">
      <div className="flex items-center justify-between">
        
        {/* Nokia Logo */}
        <div className="flex items-center gap-3">
          <img 
            src="/Nokia-Logo.png" 
            alt="Nokia logo" 
            className="h-12 max-w-[320px] w-auto object-contain bg-white p-1 rounded" 
          />
        </div>

        {/* Right Side Info (Optional - Date/Time or User Info) */}
        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-gray-500 uppercase font-bold">System Status</p>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
              <span className="text-sm font-bold text-blue-900">Online</span>
            </div>
          </div>
        </div>

      </div>
    </header>
  );
};