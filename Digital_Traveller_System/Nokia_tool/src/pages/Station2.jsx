import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, collection, query, getDocs } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import Barcode from 'react-barcode'; 
import { Toast } from '../components/Toast';
import { 
  Save, Scan, RotateCcw, ClipboardCheck, FileSpreadsheet, 
  ChevronDown, ChevronUp, Clock, Calendar, Shuffle, Globe, UserCog 
} from 'lucide-react';

// ✅ IMPORT YOUR IMAGE HERE
import bhartiLogo from '../assets/bharti.png'; 

export const Station2 = () => {
  const rawInputRef = useRef(null);
  
  // Core Data
  const [uid, setUid] = useState('');
  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Inspection Data
  const [missingItems, setMissingItems] = useState({});
  const [mechanicalStatus, setMechanicalStatus] = useState({});
  const [ipStatus, setIpStatus] = useState('');

  // Dashboard Data
  const [targetDate, setTargetDate] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);

  // Export
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const missingItemsList = [
    'E1FI', 'LMP CAP', 'EAC CAP', 'Power Cap', 'RET Cap', 'RXO Cap', 'Fan', 
    'Upper(MB)', 'Ter. Chain', 'Hex Screw', 'Left Prot.', 'Right Prot.', 
    'PCB cond.', 'DC Out', 'Ant. Cap', 'OPT Cap', 'Tray', 'HDMI Cap', 
    'CAPS Other', 'QFSP', 'MECB'
  ];
  const mechanicalStatusList = ['HANDLE BEND', 'COVER DAM', 'HS ASSEMBLY DAM'];

  useEffect(() => { rawInputRef.current?.focus(); }, []);

  // --- TIMER LOGIC ---
  useEffect(() => {
    if (product && product.rcInDate) {
        calculateMetrics();
        const interval = setInterval(calculateMetrics, 60000); 
        return () => clearInterval(interval);
    }
  }, [product]);

  const calculateMetrics = () => {
      if (!product?.rcInDate) return;

      try {
          const dateParts = product.rcInDate.split('/'); 
          const timeParts = product.rcInTime ? product.rcInTime.split(':') : ['00', '00'];
          
          if (dateParts.length !== 3) return;

          const entryDate = new Date(
              parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0]), 
              parseInt(timeParts[0]), parseInt(timeParts[1])
          );

          const target = new Date(entryDate);
          target.setDate(target.getDate() + 10);
          setTargetDate(target.toLocaleDateString('en-GB')); 

          const now = new Date();
          const diffMs = target - now;
          
          if (diffMs > 0) {
              const hours = Math.floor(diffMs / (1000 * 60 * 60));
              setTimeLeft(`${hours} Hours`);
          } else {
              setTimeLeft("EXPIRED");
          }

      } catch (error) { console.error("Date Error:", error); }
  };

  // --- HANDLERS ---

  const handleRescan = () => {
    if (rawInputRef.current) { rawInputRef.current.value = ""; rawInputRef.current.focus(); }
    setUid(''); setProduct(null); setMissingItems({}); setMechanicalStatus({}); setIpStatus('');
    setTargetDate(null); setTimeLeft(null);
    setToast({ message: 'Ready', type: 'info' });
  };

  const handleExtractAndSearch = async () => {
    const rawText = rawInputRef.current.value;
    if (!rawText) { setToast({ message: 'Empty!', type: 'error' }); return; }
    if (rawText.length > 20) {
      const id = rawText.substring(19, 30);
      setUid(id);
      await fetchProduct(id);
    } else { setToast({ message: 'Code too short', type: 'error' }); }
  };

  const fetchProduct = async (id) => {
    setIsLoading(true);
    try {
      const docSnap = await getDoc(doc(db, 'products', id));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProduct(data);
        if (data.visualInspection) {
            setMissingItems(data.visualInspection.missingItems || {});
            setMechanicalStatus(data.visualInspection.mechanicalStatus || {});
            setIpStatus(data.visualInspection.ipStatus || '');
        } else { setMissingItems({}); setMechanicalStatus({}); setIpStatus(''); }
        setToast({ message: 'Product Loaded', type: 'success' });
      } else { setProduct(null); setToast({ message: 'Not Found', type: 'error' }); }
    } catch (e) { setToast({ message: e.message, type: 'error' }); } finally { setIsLoading(false); }
  };

  const handleMissingItemChange = (item, field, value) => {
    setMissingItems(prev => ({ ...prev, [item]: { ...prev[item], [field]: value } }));
  };

  const handleMechanicalChange = (item, value) => {
    setMechanicalStatus(prev => ({ ...prev, [item]: value }));
  };

  const handleSubmit = async () => {
    if (!product || !ipStatus) return;
    setIsLoading(true);
    try {
      const cleanMissing = {}; Object.entries(missingItems).forEach(([k, v]) => { if (v.checked) cleanMissing[k] = v; });
      const cleanMech = {}; Object.entries(mechanicalStatus).forEach(([k, v]) => { if (v) cleanMech[k] = true; });

      await updateDoc(doc(db, 'products', uid), {
        status: `Visual Insp. ${ipStatus}`,
        visualInspection: { missingItems: cleanMissing, mechanicalStatus: cleanMech, ipStatus, timestamp: new Date().toISOString() },
        logs: [...(product.logs || []), { action: `Visual Inspection: ${ipStatus}`, timestamp: new Date() }],
      });
      setToast({ message: 'Inspection Saved!', type: 'success' }); handleRescan();
    } catch (e) { setToast({ message: e.message, type: 'error' }); } finally { setIsLoading(false); }
  };

  const exportData = async (filterType) => {
    setIsExporting(true);
    try {
      const now = new Date();
      let startTime, prefix = "Visual_Data";
      if (filterType === 'lastHour') startTime = new Date(now.getTime() - 3600000);
      else if (filterType === 'today') startTime = new Date(now.setHours(0,0,0,0));
      else startTime = new Date(now.getTime() - 604800000);

      const q = query(collection(db, 'products'));
      const snap = await getDocs(q);
      const data = [];
      snap.forEach(doc => {
        const p = doc.data();
        if (p.visualInspection?.timestamp) {
            const date = new Date(p.visualInspection.timestamp);
            if (date >= startTime) {
                data.push({
                    'SN': p.uid, 'Product': p.productNo, 'Status': p.visualInspection.ipStatus,
                    'Type': p.productStatus || 'Scrap', 
                    'Region': p.regionType || 'National',
                    'Engineer': p.engineerName || '-', // Export Engineer
                    'Missing': Object.keys(p.visualInspection.missingItems || {}).join(', '),
                    'Mech': Object.keys(p.visualInspection.mechanicalStatus || {}).join(', '),
                    'Date': date.toLocaleDateString(), 'Time': date.toLocaleTimeString()
                });
            }
        }
      });
      
      if (!data.length) { setToast({ message: 'No Data', type: 'warning' }); setIsExporting(false); return; }
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data");
      XLSX.writeFile(wb, `${prefix}_${now.getTime()}.xlsx`);
      setToast({ message: 'Downloaded', type: 'success' }); setShowExportMenu(false);
    } catch (e) { setToast({ message: 'Error', type: 'error' }); } finally { setIsExporting(false); }
  };

  // 🌍 Determine Background Color
  const isOverseas = product?.regionType === 'Overseas';
  const bgColor = isOverseas ? 'bg-sky-50' : 'bg-slate-50';
  const cardColor = isOverseas ? 'bg-white border-sky-200' : 'bg-white border-slate-200';

  return (
    <div className={`min-h-screen p-4 text-slate-800 text-sm transition-colors duration-500 ${bgColor}`}>
      <div className="w-full max-w-[98%] mx-auto">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 border-b-2 border-blue-600 pb-2 w-fit">
          <ClipboardCheck className="w-6 h-6 text-blue-600" /> Station 2: Visual Inspection
        </h2>
        
        <div className={`rounded-xl p-4 shadow-lg border ${cardColor}`}>
          
          {/* 1. SCANNER */}
          <div className="flex gap-4 mb-4 bg-slate-100 p-3 rounded-lg border border-slate-300">
             <div className="flex-1 bg-slate-900 p-3 rounded-lg flex items-center gap-3 cursor-text shadow-inner" onClick={() => rawInputRef.current?.focus()}>
                <Scan className="text-blue-400 animate-pulse w-5 h-5" />
                <input ref={rawInputRef} className="w-full bg-transparent text-green-400 font-mono outline-none text-base font-bold" autoFocus onKeyDown={(e)=>e.key==='Enter'&&handleExtractAndSearch()} placeholder="Scan..." autoComplete="off" />
             </div>
             <button onClick={handleExtractAndSearch} className="bg-blue-600 text-white px-6 rounded-lg font-bold shadow hover:bg-blue-700">Search</button>
             <button onClick={handleRescan} className="bg-slate-700 text-white px-4 rounded-lg shadow hover:bg-slate-600"><RotateCcw size={18} /></button>
          </div>

          {product && (
            <div className="animate-in fade-in space-y-6">
                
                {/* 🔥 2. BIG HEADER (5 Columns) 🔥 */}
                <div className={`rounded-xl p-4 shadow-xl border-l-4 ${isOverseas ? 'bg-sky-900 border-sky-400' : 'bg-slate-900 border-blue-500'}`}>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center text-white"> 
                        
                        {/* 1. Barcode */}
                        <div className="flex flex-col items-center bg-white p-2 rounded-lg">
                            <Barcode value={uid} width={1.5} height={40} fontSize={14} marginTop={0} marginBottom={0} />
                        </div>

                        {/* 2. Target Date */}
                        <div className={`text-center border-r px-4 ${isOverseas ? 'border-sky-700' : 'border-slate-700'}`}>
                            <span className="text-white/60 text-xs font-bold uppercase tracking-widest block mb-1">Target (+10 Days)</span>
                            <span className="text-2xl font-black flex justify-center items-center gap-2"><Calendar className="text-white/80 w-5 h-5"/> {targetDate || 'N/A'}</span>
                        </div>

                        {/* 3. Timer */}
                        <div className={`text-center border-r px-4 ${isOverseas ? 'border-sky-700' : 'border-slate-700'}`}>
                            <span className="text-white/60 text-xs font-bold uppercase tracking-widest block mb-1">Time Left</span>
                            <span className={`text-2xl font-black flex justify-center items-center gap-2 ${timeLeft === 'EXPIRED' ? 'text-red-400 animate-pulse' : 'text-green-400'}`}><Clock className="w-5 h-5"/> {timeLeft || '--'}</span>
                        </div>

                        {/* 4. Type (Scrap/Swap) */}
                        <div className={`text-center border-r px-4 ${isOverseas ? 'border-sky-700' : 'border-slate-700'}`}>
                            <span className="text-white/60 text-xs font-bold uppercase tracking-widest block mb-1">Type</span>
                            <span className="text-2xl font-black uppercase tracking-wider flex justify-center items-center gap-2"><Shuffle className="text-yellow-400 w-5 h-5"/> {product.productStatus || 'SCRAP'}</span>
                        </div>

                        {/* 5. Region */}
                        <div className="text-center">
                            <span className="text-white/60 text-xs font-bold uppercase tracking-widest block mb-1">Region</span>
                            <span className="text-2xl font-black uppercase tracking-wider flex justify-center items-center gap-2"><Globe className="text-cyan-400 w-5 h-5"/> {product.regionType || 'National'}</span>
                        </div>

                    </div>
                </div>

                {/* 🔥 2.1 BHARTI LOGO (CENTERED BELOW HEADER) 🔥 */}
                {product.customerName === 'BHARTI' && (
                    <div className="flex justify-center -mt-4 mb-2 animate-in slide-in-from-top-2 fade-in relative z-10">
                        <div className="bg-white px-6 py-2 rounded-b-xl shadow-md border-x border-b border-slate-200">
                            <img src={bhartiLogo} alt="Airtel/Bharti" className="h-8 object-contain" />
                        </div>
                    </div>
                )}

                {/* 3. FULL PRODUCT INFO (Includes Engineer & All Station 1 Data) */}
                <div className={`p-4 rounded-lg border shadow-sm grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 text-xs ${isOverseas ? 'bg-sky-50 border-sky-200' : 'bg-blue-50 border-blue-100'}`}>
                    <div><span className="text-slate-500 block mb-1">Product</span><span className="font-bold">{product?.productNo || '-'}</span></div>
                    <div><span className="text-slate-500 block mb-1">Family</span><span className="font-bold">{product?.familyName || '-'}</span></div>
                    <div><span className="text-slate-500 block mb-1">Customer</span><span className="font-bold">{product?.customerName || '-'}</span></div>
                    <div><span className="text-slate-500 block mb-1">Entry Date</span><span className="font-bold">{product?.rcInDate || '-'}</span></div>
                    <div><span className="text-slate-500 block mb-1">Entry Time</span><span className="font-bold">{product?.rcInTime || '-'}</span></div>
                    <div><span className="text-slate-500 block mb-1">Engineer</span><span className="font-bold flex items-center gap-1"><UserCog size={12} className="text-blue-600"/> {product?.engineerName || '-'}</span></div>
                    <div><span className="text-slate-500 block mb-1">Status</span><span className="font-bold text-blue-600">{product?.status || '-'}</span></div>
                </div>

                <hr className="border-slate-200" />
                
                {/* 4. VISUAL CHECKS GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* MISSING ITEMS */}
                    <div className="lg:col-span-2">
                        <h3 className="text-xs font-bold text-slate-800 uppercase border-b pb-1 mb-2">Missing Items Check</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {missingItemsList.map((item) => (
                                <div key={item} className={`flex items-center gap-2 p-1.5 rounded border transition-colors ${missingItems[item]?.checked ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100'}`}>
                                    <input type="checkbox" checked={missingItems[item]?.checked || false} onChange={(e) => handleMissingItemChange(item, 'checked', e.target.checked)} className="w-4 h-4 rounded text-blue-600 cursor-pointer" />
                                    <label className="text-xs font-medium text-slate-700 cursor-pointer select-none flex-1">{item}</label>
                                    {missingItems[item]?.checked && <input type="text" placeholder="Note" value={missingItems[item]?.desc || ''} onChange={(e) => handleMissingItemChange(item, 'desc', e.target.value)} className="w-16 text-[10px] px-1 py-0.5 rounded border border-slate-300 outline-none" />}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* MECHANICAL & VERDICT */}
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xs font-bold text-slate-800 uppercase border-b pb-1 mb-2">Mechanical Status</h3>
                            <div className="space-y-2">
                                {mechanicalStatusList.map((item) => (
                                    <div key={item} className={`flex items-center gap-2 p-1.5 rounded border ${mechanicalStatus[item] ? 'bg-red-100 border-red-300' : 'bg-white border-slate-100'}`}>
                                        <input type="checkbox" checked={mechanicalStatus[item] || false} onChange={(e) => handleMechanicalChange(item, e.target.checked)} className="w-4 h-4 rounded text-red-600 cursor-pointer" />
                                        <label className={`text-xs font-bold cursor-pointer select-none ${mechanicalStatus[item] ? 'text-red-800' : 'text-slate-600'}`}>{item}</label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xs font-bold text-slate-800 uppercase border-b pb-1 mb-2">Final Verdict</h3>
                            <div className="flex gap-2">
                                <button onClick={() => setIpStatus('PASS')} className={`flex-1 py-3 rounded font-bold border ${ipStatus === 'PASS' ? 'bg-green-100 border-green-500 text-green-700' : 'bg-white'}`}>PASS</button>
                                <button onClick={() => setIpStatus('FAIL')} className={`flex-1 py-3 rounded font-bold border ${ipStatus === 'FAIL' ? 'bg-red-100 border-red-500 text-red-700' : 'bg-white'}`}>FAIL</button>
                            </div>
                        </div>
                    </div>
                </div>

                <button onClick={handleSubmit} disabled={isLoading || !ipStatus} className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl shadow hover:bg-slate-800 flex items-center justify-center gap-2">
                    <Save className="w-5 h-5" /> {isLoading ? 'Saving...' : 'Save Inspection Result'}
                </button>
            </div>
          )}

          {/* EXPORT */}
          <div className="mt-6 pt-4 border-t">
            <div className="relative inline-block">
                <button onClick={() => setShowExportMenu(!showExportMenu)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-xs flex items-center gap-2 shadow">
                    <FileSpreadsheet size={14} /> Export Excel {showExportMenu ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                </button>
                {showExportMenu && (
                    <div className="absolute bottom-full left-0 mb-1 w-40 bg-white border rounded shadow-lg z-10 p-1">
                        <button onClick={()=>exportData('lastHour')} className="w-full text-left p-2 hover:bg-slate-50 text-xs rounded">Last Hour</button>
                        <button onClick={()=>exportData('today')} className="w-full text-left p-2 hover:bg-slate-50 text-xs rounded">Today</button>
                        <button onClick={()=>exportData('last7Days')} className="w-full text-left p-2 hover:bg-slate-50 text-xs rounded">Last 7 Days</button>
                    </div>
                )}
            </div>
          </div>

        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};