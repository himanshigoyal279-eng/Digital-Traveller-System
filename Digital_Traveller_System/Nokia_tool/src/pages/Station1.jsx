import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, Timestamp, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { Toast } from '../components/Toast';
import { 
  Save, CheckCircle, AlertCircle, QrCode, Scan, RotateCcw, Box, 
  User, UserCog, Calendar, Clock, FileSpreadsheet, ChevronDown, 
  ChevronUp, History, Shuffle, Globe 
} from 'lucide-react';

export const Station1 = () => {
  const rawInputRef = useRef(null);
  const [uid, setUid] = useState('');
  const [productNo, setProductNo] = useState(''); 
  const [familyName, setFamilyName] = useState('');
  const [rcInDate, setRcInDate] = useState('');
  const [rcInTime, setRcInTime] = useState('');
  
  // Manual Entry States
  const [customerName, setCustomerName] = useState('');
  const [isCustomCustomer, setIsCustomCustomer] = useState(false);
  const [productName, setProductName] = useState(''); 
  const [engineerName, setEngineerName] = useState(''); // NEW STATE
  const [productStatus, setProductStatus] = useState('Scrap'); 
  const [regionType, setRegionType] = useState('National'); 
  const [warranty, setWarranty] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [uidExists, setUidExists] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const customerOptions = ["BHARTI", "JIO", "VI", "BSNL", "Other"];

  useEffect(() => { rawInputRef.current?.focus(); }, []);

  const handleRescan = () => {
    if (rawInputRef.current) { rawInputRef.current.value = ""; rawInputRef.current.focus(); }
    setUid(''); setProductNo(''); setFamilyName(''); setRcInDate(''); setRcInTime('');
    setUidExists(false); setToast({ message: 'Ready', type: 'info' });
  };

  const handleExtract = () => {
    const rawText = rawInputRef.current.value;
    if (!rawText) { setToast({ message: 'Empty!', type: 'error' }); return; }
    if (rawText.length > 30) {
      const extractedSerial = rawText.substring(19, 30);
      setUid(extractedSerial);
      checkUidInDb(extractedSerial);
      const productNoMatch = rawText.match(/P([^S]+)S/); 
      let extractedProductNo = productNoMatch && productNoMatch[1] ? productNoMatch[1] : rawText.substring(8, 18);
      setProductNo(extractedProductNo);
      determineFamilyName(extractedProductNo);
      const now = new Date();
      setRcInDate(now.toLocaleDateString('en-GB')); 
      setRcInTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
      setToast({ message: 'Extracted', type: 'success' });
    } else { setToast({ message: 'Invalid Format', type: 'error' }); }
  };

  const determineFamilyName = (pNo) => {
    if (!pNo) return;
    if (pNo.startsWith('4763')) setFamilyName('AQQJ');
    else if (pNo.startsWith('475')) setFamilyName('AQQF');
    else if (pNo.startsWith('473')) setFamilyName('AQQA');
    else setFamilyName('UNKNOWN');
  };

  const checkUidInDb = async (id) => {
    try {
      const docSnap = await getDoc(doc(db, 'products', id));
      if (docSnap.exists()) { setUidExists(true); } else { setUidExists(false); }
    } catch (e) { console.error(e); }
  };

  const handleCustomerSelect = (val) => {
      if (val === "Other") {
          setIsCustomCustomer(true);
          setCustomerName("");
      } else {
          setIsCustomCustomer(false);
          setCustomerName(val);
      }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (uidExists) return;
    if (!customerName) { setToast({message:'Customer Name Required', type:'error'}); return; }
    if (!engineerName) { setToast({message:'Engineer Name Required', type:'error'}); return; } // Validation

    setIsLoading(true);
    try {
      await setDoc(doc(db, 'products', uid), {
        uid, productSN: uid, productNo, familyName, rcInDate, rcInTime,
        rawScanData: rawInputRef.current.value, status: 'Registered', 
        customerName: customerName.toUpperCase(), 
        productName: productName || 'N/A',
        engineerName: engineerName, // Save Engineer
        productStatus: productStatus, 
        regionType: regionType, 
        warranty,
        timestamp: serverTimestamp(),
        logs: [{ action: 'RC IN', timestamp: new Date().toISOString() }],
        history: [{ station: 'RC IN', status: 'Started', timestamp: new Date().toISOString() }]
      });
      setToast({ message: 'Saved!', type: 'success' });
      handleRescan(); 
      setCustomerName(''); setIsCustomCustomer(false);
      setEngineerName(''); setProductName(''); // Reset Fields
      setWarranty(false); setProductStatus('Scrap'); setRegionType('National');
    } catch (e) { setToast({ message: e.message, type: 'error' }); } finally { setIsLoading(false); }
  };

  const exportData = async (filterType) => {
    setIsExporting(true);
    try {
      const now = new Date();
      let startTime, prefix = "RC_IN";
      if (filterType === 'lastHour') startTime = new Date(now.getTime() - 3600000);
      else if (filterType === 'today') startTime = new Date(now.setHours(0,0,0,0));
      else startTime = new Date(now.getTime() - 604800000);

      const q = query(collection(db, 'products'), where('timestamp', '>=', Timestamp.fromDate(startTime)), orderBy('timestamp', 'desc'));
      const snap = await getDocs(q);
      const data = [];
      snap.forEach(d => { 
          const p=d.data(); 
          data.push({ 
              'SN': p.uid, 
              'Product': p.productNo, 
              'Family': p.familyName, 
              'Date': p.rcInDate, 
              'Customer': p.customerName,
              'Type': p.productStatus,
              'Region': p.regionType,
              'Engineer': p.engineerName, // Export Engineer
              'Warranty': p.warranty ? 'Yes' : 'No'
          }); 
      });
      
      if (!data.length) { setToast({ message: 'No Data', type: 'warning' }); setIsExporting(false); return; }
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data");
      XLSX.writeFile(wb, `${prefix}_${now.getTime()}.xlsx`);
      setToast({ message: 'Downloaded', type: 'success' }); setShowExportMenu(false);
    } catch (e) { setToast({ message: 'Error', type: 'error' }); } finally { setIsExporting(false); }
  };

  return (
    <div className="min-h-screen p-4 bg-slate-50 text-slate-800 text-sm">
      <div className="w-full max-w-[98%] mx-auto">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 border-b-2 border-blue-600 pb-2 w-fit">
          <QrCode className="w-6 h-6 text-blue-600" /> Station 1: RC IN
        </h2>
        
        <div className="bg-white rounded-xl p-4 shadow-lg border border-slate-200">
          <form onSubmit={handleRegister}>
            {/* SCANNER */}
            <div className="flex gap-4 mb-6 bg-slate-100 p-3 rounded-lg border border-slate-300">
               <div className="flex-1 bg-slate-900 p-3 rounded-lg flex items-center gap-3 cursor-text shadow-inner" onClick={() => rawInputRef.current?.focus()}>
                  <Scan className="text-blue-400 animate-pulse w-5 h-5" />
                  <input ref={rawInputRef} className="w-full bg-transparent text-green-400 font-mono outline-none text-base font-bold" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleExtract()} placeholder="Scan..." autoComplete="off" />
               </div>
               <button type="button" onClick={handleExtract} className="bg-blue-600 text-white px-6 rounded-lg font-bold shadow hover:bg-blue-700">Extract</button>
               <button type="button" onClick={handleRescan} className="bg-slate-700 text-white px-4 rounded-lg shadow hover:bg-slate-600"><RotateCcw size={18} /></button>
            </div>

            {/* DETAILS GRID */}
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6">
               <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Serial No</label>
                    <div className="relative">
                      <input value={uid} readOnly className={`w-full p-2 border rounded font-mono font-bold ${uidExists ? 'bg-red-50 text-red-600 border-red-300' : 'bg-white'}`} />
                      {uidExists && <AlertCircle className="absolute right-2 top-2 text-red-500 w-4 h-4" />}
                    </div>
                  </div>
                  <div><label className="text-xs font-bold text-slate-500 block mb-1">Product No</label><input value={productNo} readOnly className="w-full p-2 border rounded bg-white font-bold" /></div>
                  <div><label className="text-xs font-bold text-slate-500 block mb-1">Family</label><input value={familyName} onChange={e=>setFamilyName(e.target.value)} className="w-full p-2 border rounded bg-white" /></div>
                  <div><label className="text-xs font-bold text-slate-500 block mb-1">Date</label><div className="relative"><input value={rcInDate} readOnly className="w-full p-2 border rounded bg-white" /><Calendar className="absolute right-2 top-2 w-4 h-4 text-slate-400"/></div></div>
                  <div><label className="text-xs font-bold text-slate-500 block mb-1">Time</label><div className="relative"><input value={rcInTime} readOnly className="w-full p-2 border rounded bg-white" /><Clock className="absolute right-2 top-2 w-4 h-4 text-slate-400"/></div></div>
               </div>
            </div>

            {/* MANUAL ENTRY - 3 COLUMNS (Creates 2 Rows) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6"> 
               
               {/* 1. Customer Name */}
               <div>
                   <label className="text-xs font-bold text-slate-500 block mb-1">Customer *</label>
                   <div className="relative">
                       {!isCustomCustomer ? (
                           <select value={customerName} onChange={(e) => handleCustomerSelect(e.target.value)} className="w-full p-3 pl-10 border rounded-lg appearance-none font-bold bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer">
                               <option value="">Select Customer</option>
                               {customerOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                           </select>
                       ) : (
                           <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full p-3 pl-10 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Type New Customer..." autoFocus/>
                       )}
                       <User className="absolute left-3 top-3.5 w-4 h-4 text-slate-400"/>
                       {!isCustomCustomer && <ChevronDown className="absolute right-3 top-4 w-3 h-3 text-slate-400 pointer-events-none"/>}
                   </div>
               </div>

               {/* 2. Product Name */}
               <div>
                   <label className="text-xs font-bold text-slate-500 block mb-1">Product Name</label>
                   <div className="relative">
                       <input value={productName} onChange={e=>setProductName(e.target.value)} className="w-full p-3 pl-10 border rounded-lg" placeholder="Optional"/>
                       <Box className="absolute left-3 top-3.5 w-4 h-4 text-slate-400"/>
                   </div>
               </div>

               {/* 3. Type (Scrap/Swap) */}
               <div>
                   <label className="text-xs font-bold text-slate-500 block mb-1">Type (Scrap/Swap)</label>
                   <div className="relative">
                       <select value={productStatus} onChange={(e) => setProductStatus(e.target.value)} className="w-full p-3 pl-10 border rounded-lg appearance-none font-bold bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 cursor-pointer">
                           <option value="Scrap">Scrap</option>
                           <option value="Swap">Swap</option>
                       </select>
                       <Shuffle className="absolute left-3 top-3.5 w-4 h-4 text-slate-400"/>
                       <ChevronDown className="absolute right-3 top-4 w-3 h-3 text-slate-400 pointer-events-none"/>
                   </div>
               </div>

               {/* 4. Region (National/Overseas) */}
               <div>
                   <label className="text-xs font-bold text-slate-500 block mb-1">Region</label>
                   <div className="relative">
                       <select value={regionType} onChange={(e) => setRegionType(e.target.value)} className="w-full p-3 pl-10 border rounded-lg appearance-none font-bold bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 cursor-pointer">
                           <option value="National">National</option>
                           <option value="Overseas">Overseas</option>
                       </select>
                       <Globe className="absolute left-3 top-3.5 w-4 h-4 text-slate-400"/>
                       <ChevronDown className="absolute right-3 top-4 w-3 h-3 text-slate-400 pointer-events-none"/>
                   </div>
               </div>

               {/* 5. Engineer Name (NEW) */}
               <div>
                   <label className="text-xs font-bold text-slate-500 block mb-1">Engineer Name *</label>
                   <div className="relative">
                       <input value={engineerName} onChange={e=>setEngineerName(e.target.value)} className="w-full p-3 pl-10 border rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="Enter Name" required/>
                       <UserCog className="absolute left-3 top-3.5 w-4 h-4 text-slate-400"/>
                   </div>
               </div>

               {/* 6. Warranty Checkbox */}
               <div className="flex items-end">
                   <label className="flex items-center gap-3 cursor-pointer bg-slate-100 p-3 rounded-lg border w-full hover:bg-slate-200 transition-colors">
                       <input type="checkbox" checked={warranty} onChange={e=>setWarranty(e.target.checked)} className="w-5 h-5 text-blue-600 rounded"/> 
                       <span className="font-bold text-sm text-slate-700">Under Warranty</span>
                   </label>
               </div>

            </div>

            <button type="submit" disabled={isLoading || uidExists || !uid} className="w-full py-4 bg-slate-900 text-white font-bold text-lg rounded-xl shadow hover:bg-slate-800 flex items-center justify-center gap-2 transition-transform active:scale-95">
               <Save className="w-5 h-5" /> {isLoading ? 'Saving...' : 'Register Product'}
            </button>
          </form>

          {/* EXPORT BUTTON */}
          <div className="mt-6 pt-4 border-t">
            <div className="relative inline-block w-full md:w-auto">
                <button type="button" onClick={() => setShowExportMenu(!showExportMenu)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-xs flex items-center gap-2 shadow transition-colors">
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