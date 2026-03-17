import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, Search, Scan, RotateCcw, X, BarChart3, FileSpreadsheet, AlertCircle, Clock, Calendar, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Toast } from '../components/Toast';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export const Station8 = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]); 
  const [toast, setToast] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 🕒 1. New State for Time Filter
  const [timeFilter, setTimeFilter] = useState('All'); // 'All', '1H', 'Today', '7D'

  const searchInputRef = useRef(null);

  // Real-time Firestore listener
  useEffect(() => {
    const q = query(collection(db, 'products'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productsData = [];
      snapshot.forEach((doc) => {
        productsData.push({ id: doc.id, ...doc.data() });
      });
      setProducts(productsData);
      // Filter logic will be handled by the other useEffect
    }, (error) => {
      setToast({ message: 'Error listening to updates: ' + error.message, type: 'error' });
    });

    return () => unsubscribe();
  }, []);

  // 🔍 2. Centralized Filtering Logic (Search + Time Slicer)
  useEffect(() => {
    let result = products;

    // A. Apply Search Filter
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(p => 
        (p.uid && p.uid.toLowerCase().includes(lowerTerm)) ||
        (p.productNo && p.productNo.toLowerCase().includes(lowerTerm)) ||
        (p.customerName && p.customerName.toLowerCase().includes(lowerTerm))
      );
    }

    // B. Apply Time Slicer Filter
    if (timeFilter !== 'All') {
      const now = new Date();
      result = result.filter(p => {
        // Parse date safely (FireStore Timestamp or String)
        const dateField = p.timestamp || p.entryDate;
        if (!dateField) return false;
        
        const pDate = dateField.toDate ? dateField.toDate() : new Date(dateField);
        if (isNaN(pDate)) return false;

        if (timeFilter === '1H') {
           // Last 1 Hour (3600 * 1000 ms)
           return (now - pDate) <= 3600000;
        } else if (timeFilter === 'Today') {
           // Start of Today (00:00:00)
           const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
           return pDate >= todayStart;
        } else if (timeFilter === '7D') {
           // Last 7 Days
           const sevenDaysAgo = new Date(now);
           sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
           return pDate >= sevenDaysAgo;
        }
        return true;
      });
    }

    setFilteredProducts(result);

  }, [products, searchTerm, timeFilter]);

  // 🛠️ SEARCH HANDLER (Just updates state now)
  const handleSearch = () => {
    const rawText = searchInputRef.current.value.trim();

    if (!rawText) {
      setSearchTerm('');
      return;
    }

    let term = rawText;
    if (rawText.length > 20) {
       term = rawText.substring(19, 30);
       searchInputRef.current.value = term;
    }

    setSearchTerm(term);
    // Toast logic is tricky here because filtering happens in useEffect, 
    // but we can assume if state changes, user sees result.
  };

  const handleRescan = () => {
    if (searchInputRef.current) {
        searchInputRef.current.value = "";
        searchInputRef.current.focus();
    }
    setSearchTerm('');
    // setFilteredProducts will be handled by useEffect based on 'All' timeFilter if kept or existing
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  // Pie Chart Data
  const statusCounts = products.reduce((acc, product) => {
    const status = product.status || 'Unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  // Bar Chart Data (Last 7 Days)
  const dailyEntries = products.reduce((acc, product) => {
    const dateField = product.timestamp || product.entryDate;
    if (dateField) {
      const dateObj = dateField.toDate ? dateField.toDate() : new Date(dateField);
      if (!isNaN(dateObj)) {
        const dateKey = dateObj.toLocaleDateString();
        acc[dateKey] = (acc[dateKey] || 0) + 1;
      }
    }
    return acc;
  }, {});

  const barData = Object.entries(dailyEntries)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-7);

  // Export Logic
  const exportToExcel = () => {
    const dataToExport = filteredProducts.length > 0 ? filteredProducts : products;

    if (dataToExport.length === 0) {
      setToast({ message: 'No data to export', type: 'error' });
      return;
    }

    const data = dataToExport.map(p => ({
      'UID': p.uid || '',
      'Customer': p.customerName || '',
      'Product No': p.productNo || '',
      'Status': p.status || '',
      'Warranty': p.warranty ? 'Yes' : 'No',
      'Date': (p.timestamp || p.entryDate)?.toDate ? (p.timestamp || p.entryDate).toDate().toLocaleString() : '',
      'Visual Status': p.visualInspection?.ipStatus || '',
      'RAP Status': p.rapTest?.status || '',
      'Unit Status': p.unitTest?.status || '',
      'Debug Status': p.debugValidation?.status || '',
      'Deep Test': p.deepTest?.status || '',
      'QC Status': p.qcCheck?.status || '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dashboard_Data');
    XLSX.writeFile(wb, `Dashboard_Export_${new Date().getTime()}.xlsx`);
    setToast({ message: 'Excel exported successfully!', type: 'success' });
  };

  return (
    <div className="min-h-screen p-6 bg-slate-50 text-slate-800">
      <div className="w-full max-w-[95%] mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
          <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3 border-b-2 border-blue-600 pb-4 w-fit">
            <BarChart3 className="w-8 h-8 text-blue-600" /> Station 7: Dashboard
          </h2>
          <button onClick={exportToExcel} className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-md flex items-center gap-2 transition-all">
            <Download className="w-5 h-5" /> Export All Data
          </button>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          
          {/* Pie Chart Card */}
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200">
            <h3 className="text-lg font-bold text-slate-700 mb-4 border-b pb-2">Status Distribution</h3>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={100} fill="#8884d8" dataKey="value">
                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#1e293b' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-slate-400">
                <AlertCircle size={40} className="mb-2"/> <p>No data available</p>
              </div>
            )}
          </div>

          {/* Bar Chart Card */}
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200">
            <h3 className="text-lg font-bold text-slate-700 mb-4 border-b pb-2">Daily Entries (Last 7 Days)</h3>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#1e293b' }} cursor={{fill: '#f1f5f9'}} />
                  <Legend wrapperStyle={{ paddingTop: '10px' }} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Units Processed" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-slate-400">
                <AlertCircle size={40} className="mb-2"/> <p>No data available</p>
              </div>
            )}
          </div>
        </div>

        {/* 🔍 SEARCH SECTION */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 mb-8">
            <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2"><Search size={20}/> Search Product Database</h3>
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 bg-slate-100 p-3 rounded-xl border border-slate-300 flex items-center gap-3 focus-within:ring-2 focus-within:ring-blue-500 transition-all">
                    <Scan size={20} className="text-slate-500" />
                    <input 
                        ref={searchInputRef}
                        type="text"
                        defaultValue=""
                        onKeyDown={handleKeyDown}
                        className="bg-transparent flex-1 text-slate-800 focus:outline-none font-mono placeholder-slate-400"
                        placeholder="Scan QR or type S.No/Name..." 
                        autoComplete="off"
                    />
                    <button type="button" onClick={handleRescan} className="text-slate-400 hover:text-slate-700 p-1 hover:bg-slate-200 rounded-full transition-all"><RotateCcw size={18}/></button>
                </div>
                
                <button onClick={handleSearch} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-2 shadow-md transition-transform active:scale-95">
                    <Search size={20} /> Search
                </button>
            </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          {/* Header with Slicer */}
          <div className="p-6 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
                <h3 className="text-lg font-bold text-slate-800">Product Records</h3>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">{filteredProducts.length}</span>
                {searchTerm && <span className="text-sm font-medium text-slate-500 bg-white px-2 py-1 rounded border">Filter: "{searchTerm}"</span>}
            </div>

            {/* 🕰️ TIME SLICER CONTROLS */}
            <div className="flex bg-slate-200 p-1 rounded-lg">
                {[
                    { label: 'All', value: 'All' },
                    { label: 'Last Hour', value: '1H' },
                    { label: 'Today', value: 'Today' },
                    { label: 'Last 7 Days', value: '7D' },
                ].map((item) => (
                    <button
                        key={item.value}
                        onClick={() => setTimeFilter(item.value)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                            timeFilter === item.value 
                            ? 'bg-white text-blue-700 shadow-sm' 
                            : 'text-slate-600 hover:text-slate-800 hover:bg-slate-300'
                        }`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 text-slate-600 uppercase text-xs font-bold">
                <tr>
                  <th className="py-4 px-6 border-b border-slate-200">UID / Serial</th>
                  <th className="py-4 px-6 border-b border-slate-200">Customer</th>
                  <th className="py-4 px-6 border-b border-slate-200">Product No</th>
                  <th className="py-4 px-6 border-b border-slate-200">Current Status</th>
                  <th className="py-4 px-6 border-b border-slate-200">QC Status</th>
                  <th className="py-4 px-6 border-b border-slate-200">Entry Time</th>
                </tr>
              </thead>
              <tbody className="text-sm text-slate-700">
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-none">
                      <td className="py-4 px-6 font-mono font-medium">{product.uid || '-'}</td>
                      <td className="py-4 px-6">{product.customerName || '-'}</td>
                      <td className="py-4 px-6">{product.productNo || '-'}</td>
                      <td className="py-4 px-6">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          product.status?.includes('Passed') || product.status?.includes('Registered') ? 'bg-green-100 text-green-700' :
                          product.status?.includes('Failed') ? 'bg-red-100 text-red-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {product.status || 'Unknown'}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-medium">{product.qcCheck?.status || '-'}</td>
                      <td className="py-4 px-6 text-slate-500 text-xs">
                        {(product.timestamp || product.entryDate)?.toDate 
                            ? (product.timestamp || product.entryDate).toDate().toLocaleString() 
                            : (product.entryDate || '-')}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-400 flex flex-col items-center justify-center">
                      <Search size={40} className="mb-2 opacity-50"/>
                      No matching records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};