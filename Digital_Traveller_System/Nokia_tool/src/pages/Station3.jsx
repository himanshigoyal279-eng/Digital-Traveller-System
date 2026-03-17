import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, collection, query, getDocs } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import Barcode from 'react-barcode'; 
import { Toast } from '../components/Toast';
import { 
  Save, Scan, RotateCcw, Box, Activity, FileSpreadsheet, 
  ChevronDown, ChevronUp, Clock, Calendar, Search, 
  AlertTriangle, CheckCircle, Shuffle, Globe, UserCog, Plus, Trash2, MessageSquare
} from 'lucide-react';

// ✅ Import Bharti Logo
import bhartiLogo from '../assets/bharti.png'; 

export const Station3 = () => {
  const rawInputRef = useRef(null);
  
  // Core Data
  const [uid, setUid] = useState('');
  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // --- TEST STATES (UPDATED FOR MULTIPLE FAILURES) ---
  const [rapStatus, setRapStatus] = useState('');
  const [rapFailures, setRapFailures] = useState([]); // Array of { id, desc }

  const [unitStatus, setUnitStatus] = useState('');
  const [unitFailures, setUnitFailures] = useState([]); // Array of { id, desc }

  // General Remarks
  const [technicianRemarks, setTechnicianRemarks] = useState('');

  // Dashboard Data
  const [targetDate, setTargetDate] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);

  // Export States
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // ✅ FAILURE OPTIONS
  const rapFailureOptions = [
    "16 - Read Monitor Power", "17 - Power Reset Test", "18 - UART Test",
    "19 - PING Target", "20 - Connect Master CPU", "24 - Sanity Check HWS"
  ];

  const unitFailureOptions = [
    "14 - Vart Test", "15 - Connect DUT(Made 4)", "16 - Connect DUT(Made 7)",
    "17 - Connect DUT(Made 6)", "18 - Connect DUT(Beamer)", "19 - Connect DUT(Made 3)",
    "20 - Connect DUT(Made 1)", "21 - Connect DUT(Made 8)", "22 - Connect DUT(Made 5)", "23 - Connect DUT(Made 2)"
  ];

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
          const entryDate = new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0]), parseInt(timeParts[0]), parseInt(timeParts[1]));
          const target = new Date(entryDate);
          target.setDate(target.getDate() + 10);
          setTargetDate(target.toLocaleDateString('en-GB'));
          const now = new Date();
          const diffMs = target - now;
          if (diffMs > 0) {
              const hours = Math.floor(diffMs / (1000 * 60 * 60));
              setTimeLeft(`${hours} Hours`);
          } else { setTimeLeft("EXPIRED"); }
      } catch (error) { console.error("Date Error:", error); }
  };

  // --- HANDLERS ---
  const handleRescan = () => {
    if (rawInputRef.current) { rawInputRef.current.value = ""; rawInputRef.current.focus(); }
    setUid(''); setProduct(null); 
    setRapStatus(''); setRapFailures([]);
    setUnitStatus(''); setUnitFailures([]);
    setTechnicianRemarks('');
    setTargetDate(null); setTimeLeft(null);
    setToast({ message: 'Ready', type: 'info' });
  };

  const handleExtractAndSearch = async () => {
    const rawText = rawInputRef.current.value;
    if (!rawText) { setToast({ message: 'Empty!', type: 'error' }); return; }
    let id = rawText.length > 20 ? rawText.substring(19, 30) : rawText;
    setUid(id);
    await fetchProduct(id);
  };

  const fetchProduct = async (id) => {
    setIsLoading(true);
    try {
      const docSnap = await getDoc(doc(db, 'products', id));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProduct(data);
        // Load existing data
        if (data.rapTest) { 
            setRapStatus(data.rapTest.status || '');
            setRapFailures(data.rapTest.failures || []); // Load Array
        }
        if (data.unitTest) { 
            setUnitStatus(data.unitTest.status || ''); 
            setUnitFailures(data.unitTest.failures || []); // Load Array
        }
        setTechnicianRemarks(data.technicianRemarks || '');
        setToast({ message: 'Product Loaded', type: 'success' });
      } else { setProduct(null); setToast({ message: 'Not Found', type: 'error' }); }
    } catch (e) { setToast({ message: e.message, type: 'error' }); } 
    finally { setIsLoading(false); }
  };

  // --- DYNAMIC ROW HANDLERS ---
  
  // Add Row from Dropdown or Manual Button
  const addFailureRow = (type, value = null) => {
      const newRow = value ? (() => {
          const parts = value.split('-');
          return { id: parts[0].trim(), desc: parts.slice(1).join('-').trim() };
      })() : { id: '', desc: '' };

      if (type === 'RAP') setRapFailures([...rapFailures, newRow]);
      else setUnitFailures([...unitFailures, newRow]);
  };

  // Update Specific Row
  const updateFailureRow = (type, index, field, val) => {
      const rows = type === 'RAP' ? [...rapFailures] : [...unitFailures];
      rows[index][field] = val;
      if (type === 'RAP') setRapFailures(rows);
      else setUnitFailures(rows);
  };

  // Remove Row
  const removeFailureRow = (type, index) => {
      const rows = type === 'RAP' ? [...rapFailures] : [...unitFailures];
      rows.splice(index, 1);
      if (type === 'RAP') setRapFailures(rows);
      else setUnitFailures(rows);
  };

  const handleSubmit = async () => {
    if (!product || !rapStatus || !unitStatus) return;
    
    // Validation: If FAIL, must have at least one failure row with data
    if (rapStatus === 'FAIL' && (rapFailures.length === 0 || !rapFailures[0].id)) { setToast({ message: 'Add at least one RAP Failure', type: 'error' }); return; }
    if (unitStatus === 'FAIL' && (unitFailures.length === 0 || !unitFailures[0].id)) { setToast({ message: 'Add at least one Unit Failure', type: 'error' }); return; }

    setIsLoading(true);
    try {
      const overall = (rapStatus === 'PASS' && unitStatus === 'PASS') ? 'Testing Passed' : 'Testing Failed';
      
      await updateDoc(doc(db, 'products', uid), {
        status: overall,
        rapTest: { 
            status: rapStatus, 
            failures: rapStatus === 'FAIL' ? rapFailures : [], // Save Array
            timestamp: new Date().toISOString() 
        },
        unitTest: { 
            status: unitStatus, 
            failures: unitStatus === 'FAIL' ? unitFailures : [], // Save Array
            timestamp: new Date().toISOString() 
        },
        technicianRemarks: technicianRemarks, // Save Remarks
        logs: [...(product.logs || []), { action: `RAP: ${rapStatus} | UNIT: ${unitStatus}`, timestamp: new Date() }],
      });
      setToast({ message: 'Results Saved!', type: 'success' }); 
      handleRescan();
    } catch (e) { setToast({ message: e.message, type: 'error' }); } 
    finally { setIsLoading(false); }
  };

  const formatFailuresForExport = (failures) => {
      if (!failures || failures.length === 0) return '-';
      return failures.map(f => `${f.id}:${f.desc}`).join(' | ');
  };

  const exportData = async (filterType) => {
    setIsExporting(true);
    try {
      const now = new Date();
      let startTime, prefix = "Test_Data";
      if (filterType === 'lastHour') startTime = new Date(now.getTime() - 3600000);
      else if (filterType === 'today') startTime = new Date(now.setHours(0,0,0,0));
      else startTime = new Date(now.getTime() - 604800000); 

      const q = query(collection(db, 'products'));
      const snap = await getDocs(q);
      const data = [];
      snap.forEach(doc => {
        const p = doc.data();
        if (p.rapTest?.timestamp) {
            const date = new Date(p.rapTest.timestamp);
            if (date >= startTime) {
                data.push({
                    'SN': p.uid, 'Product': p.productNo, 
                    'Type': p.productStatus || 'Scrap', 'Region': p.regionType || 'National',
                    'RAP Status': p.rapTest.status, 
                    'RAP Failures': formatFailuresForExport(p.rapTest.failures),
                    'UNIT Status': p.unitTest.status, 
                    'UNIT Failures': formatFailuresForExport(p.unitTest.failures),
                    'Remarks': p.technicianRemarks || '-',
                    'Date': date.toLocaleDateString(), 'Time': date.toLocaleTimeString()
                });
            }
        }
      });
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data");
      XLSX.writeFile(wb, `${prefix}_${now.getTime()}.xlsx`);
      setToast({ message: 'Downloaded', type: 'success' }); setShowExportMenu(false);
    } catch (e) { setToast({ message: 'Error: ' + e.message, type: 'error' }); } finally { setIsExporting(false); }
  };

  const formatList = (obj) => obj ? Object.keys(obj).join(', ') : 'None';
  const isOverseas = product?.regionType === 'Overseas';
  const bgColor = isOverseas ? 'bg-sky-50' : 'bg-slate-50';
  const cardColor = isOverseas ? 'bg-white border-sky-200' : 'bg-white border-slate-200';

  return (
    <div className={`min-h-screen p-4 text-slate-800 text-sm transition-colors duration-500 ${bgColor}`}>
      <div className="w-full max-w-[98%] mx-auto">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 border-b-2 border-blue-600 pb-2 w-fit">
          <Activity className="w-6 h-6 text-blue-600" /> Station 3: RAP & Unit Test
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
                
                {/* 2. HEADER */}
                <div className={`rounded-xl p-4 shadow-xl border-l-4 ${isOverseas ? 'bg-sky-900 border-sky-400' : 'bg-slate-900 border-blue-500'}`}>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center text-white">
                        <div className="flex flex-col items-center bg-white p-2 rounded-lg"><Barcode value={uid} width={1.5} height={40} fontSize={14} marginTop={0} marginBottom={0} /></div>
                        <div className={`text-center border-r px-4 ${isOverseas ? 'border-sky-700' : 'border-slate-700'}`}><span className="text-white/60 text-xs font-bold uppercase tracking-widest block mb-1">Target</span><span className="text-2xl font-black flex justify-center items-center gap-2"><Calendar className="text-white/80 w-5 h-5"/> {targetDate || 'N/A'}</span></div>
                        <div className={`text-center border-r px-4 ${isOverseas ? 'border-sky-700' : 'border-slate-700'}`}><span className="text-white/60 text-xs font-bold uppercase tracking-widest block mb-1">Time Left</span><span className={`text-2xl font-black flex justify-center items-center gap-2 ${timeLeft === 'EXPIRED' ? 'text-red-400 animate-pulse' : 'text-green-400'}`}><Clock className="w-5 h-5"/> {timeLeft || '--'}</span></div>
                        <div className={`text-center border-r px-4 ${isOverseas ? 'border-sky-700' : 'border-slate-700'}`}><span className="text-white/60 text-xs font-bold uppercase tracking-widest block mb-1">Type</span><span className="text-2xl font-black uppercase tracking-wider flex justify-center items-center gap-2"><Shuffle className="text-yellow-400 w-5 h-5"/> {product.productStatus || 'SCRAP'}</span></div>
                        <div className="text-center"><span className="text-white/60 text-xs font-bold uppercase tracking-widest block mb-1">Region</span><span className="text-2xl font-black uppercase tracking-wider flex justify-center items-center gap-2"><Globe className="text-cyan-400 w-5 h-5"/> {product.regionType || 'National'}</span></div>
                    </div>
                </div>

                {/* 2.1 BHARTI LOGO */}
                {product.customerName === 'BHARTI' && (
                    <div className="flex justify-center -mt-4 mb-2 animate-in slide-in-from-top-2 fade-in relative z-10">
                        <div className="bg-white px-6 py-2 rounded-b-xl shadow-md border-x border-b border-slate-200">
                            <img src={bhartiLogo} alt="Airtel/Bharti" className="h-8 object-contain" />
                        </div>
                    </div>
                )}

                {/* 3. HISTORY */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide border-b pb-1">Detailed Unit History</h3>
                    
                    {/* Station 1 */}
                    <div className={`p-3 rounded-lg border grid grid-cols-2 md:grid-cols-6 gap-3 text-xs ${isOverseas ? 'bg-sky-50 border-sky-200' : 'bg-blue-50 border-blue-100'}`}>
                        <div><span className="text-slate-500 block">Product</span><span className="font-bold">{product.productNo}</span></div>
                        <div><span className="text-slate-500 block">Family</span><span className="font-bold">{product.familyName}</span></div>
                        <div><span className="text-slate-500 block">Customer</span><span className="font-bold">{product.customerName}</span></div>
                        <div><span className="text-slate-500 block">Entry Date</span><span className="font-bold">{product.rcInDate}</span></div>
                        <div><span className="text-slate-500 block">Engineer</span><span className="font-bold flex items-center gap-1"><UserCog size={12}/> {product.engineerName || '-'}</span></div>
                        <div><span className="text-slate-500 block">Status</span><span className="font-bold text-blue-600">{product.status}</span></div>
                    </div>

                    {/* Station 2 */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-2 p-3 bg-purple-50 border-l-4 border-purple-500 rounded-r shadow-sm text-xs items-center">
                        <div className="font-bold text-purple-800 flex items-center gap-2"><Search size={14}/> STATION 2</div>
                        <div><span className="text-slate-400 block">Visual Status</span><span className={`font-bold ${product.visualInspection?.ipStatus === 'FAIL' ? 'text-red-600' : 'text-green-600'}`}>{product.visualInspection?.ipStatus || 'Pending'}</span></div>
                        <div><span className="text-slate-400 block">Date & Time</span><span className="font-bold">{product.visualInspection?.timestamp ? new Date(product.visualInspection.timestamp).toLocaleString('en-GB') : '-'}</span></div>
                        <div className="col-span-1"><span className="text-slate-400 block">Missing Items</span><span className="font-bold text-red-600 truncate">{formatList(product.visualInspection?.missingItems)}</span></div>
                        <div className="col-span-1"><span className="text-slate-400 block">Mech Defects</span><span className="font-bold text-red-600 truncate">{formatList(product.visualInspection?.mechanicalStatus)}</span></div>
                    </div>
                </div>

                <hr className="border-slate-200" />
                
                {/* 4. TEST FORMS (MULTIPLE FAILURES) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* RAP TEST */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col h-full">
                        <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase flex justify-between">
                            RAP Test 
                            {rapStatus === 'FAIL' && <button onClick={() => addFailureRow('RAP')} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded flex items-center gap-1 hover:bg-blue-200"><Plus size={12}/> Add Manual Row</button>}
                        </h3>
                        
                        <div className="flex gap-2 mb-3">
                            <button onClick={() => { setRapStatus('PASS'); setRapFailures([]); }} className={`flex-1 py-2 rounded font-bold border transition-colors ${rapStatus === 'PASS' ? 'bg-green-100 border-green-500 text-green-700' : 'bg-white hover:bg-green-50'}`}>PASS</button>
                            <button onClick={() => setRapStatus('FAIL')} className={`flex-1 py-2 rounded font-bold border transition-colors ${rapStatus === 'FAIL' ? 'bg-red-100 border-red-500 text-red-700' : 'bg-white hover:bg-red-50'}`}>FAIL</button>
                        </div>
                        
                        {rapStatus === 'FAIL' && (
                            <div className="space-y-3 animate-in fade-in flex-1">
                                {/* Quick Add Dropdown */}
                                <select onChange={(e) => { addFailureRow('RAP', e.target.value); e.target.value = ""; }} className="w-full p-2 text-xs border border-blue-300 rounded bg-blue-50/50 focus:ring-2 focus:ring-blue-200 outline-none font-medium">
                                    <option value="">+ Quick Add Failure...</option>
                                    {rapFailureOptions.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>

                                {/* Dynamic Failure Rows */}
                                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                    {rapFailures.map((fail, idx) => (
                                        <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded border border-slate-200 shadow-sm">
                                            <input value={fail.id} onChange={(e) => updateFailureRow('RAP', idx, 'id', e.target.value)} className="w-1/4 p-1.5 border rounded text-xs text-center font-bold" placeholder="ID" />
                                            <input value={fail.desc} onChange={(e) => updateFailureRow('RAP', idx, 'desc', e.target.value)} className="flex-1 p-1.5 border rounded text-xs font-medium" placeholder="Description" />
                                            <button onClick={() => removeFailureRow('RAP', idx)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16}/></button>
                                        </div>
                                    ))}
                                    {rapFailures.length === 0 && <div className="text-center text-xs text-red-400 italic py-2">Add at least one failure</div>}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* UNIT TEST */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col h-full">
                        <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase flex justify-between">
                            Unit Test
                            {unitStatus === 'FAIL' && <button onClick={() => addFailureRow('UNIT')} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded flex items-center gap-1 hover:bg-blue-200"><Plus size={12}/> Add Manual Row</button>}
                        </h3>

                        <div className="flex gap-2 mb-3">
                            <button onClick={() => { setUnitStatus('PASS'); setUnitFailures([]); }} className={`flex-1 py-2 rounded font-bold border transition-colors ${unitStatus === 'PASS' ? 'bg-green-100 border-green-500 text-green-700' : 'bg-white hover:bg-green-50'}`}>PASS</button>
                            <button onClick={() => setUnitStatus('FAIL')} className={`flex-1 py-2 rounded font-bold border transition-colors ${unitStatus === 'FAIL' ? 'bg-red-100 border-red-500 text-red-700' : 'bg-white hover:bg-red-50'}`}>FAIL</button>
                        </div>
                        
                        {unitStatus === 'FAIL' && (
                            <div className="space-y-3 animate-in fade-in flex-1">
                                {/* Quick Add Dropdown */}
                                <select onChange={(e) => { addFailureRow('UNIT', e.target.value); e.target.value = ""; }} className="w-full p-2 text-xs border border-blue-300 rounded bg-blue-50/50 focus:ring-2 focus:ring-blue-200 outline-none font-medium">
                                    <option value="">+ Quick Add Failure...</option>
                                    {unitFailureOptions.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>

                                {/* Dynamic Failure Rows */}
                                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                    {unitFailures.map((fail, idx) => (
                                        <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded border border-slate-200 shadow-sm">
                                            <input value={fail.id} onChange={(e) => updateFailureRow('UNIT', idx, 'id', e.target.value)} className="w-1/4 p-1.5 border rounded text-xs text-center font-bold" placeholder="ID" />
                                            <input value={fail.desc} onChange={(e) => updateFailureRow('UNIT', idx, 'desc', e.target.value)} className="flex-1 p-1.5 border rounded text-xs font-medium" placeholder="Description" />
                                            <button onClick={() => removeFailureRow('UNIT', idx)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16}/></button>
                                        </div>
                                    ))}
                                    {unitFailures.length === 0 && <div className="text-center text-xs text-red-400 italic py-2">Add at least one failure</div>}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 5. TECHNICIAN REMARKS (FULL WIDTH) */}
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                    <h3 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2"><MessageSquare size={14}/> Technician Description / Remarks</h3>
                    <textarea 
                        value={technicianRemarks} 
                        onChange={(e) => setTechnicianRemarks(e.target.value)} 
                        rows="3" 
                        className="w-full p-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none resize-none" 
                        placeholder="Enter any additional findings, observations, or special instructions here..."
                    ></textarea>
                </div>

                {/* SAVE BUTTON */}
                <button onClick={handleSubmit} disabled={isLoading || !rapStatus || !unitStatus} className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl shadow hover:bg-slate-800 flex items-center justify-center gap-2 disabled:opacity-50 transition-transform active:scale-95">
                    <Save className="w-4 h-4" /> {isLoading ? 'Saving...' : 'Save All Results'}
                </button>
            </div>
          )}

          {/* EXPORT */}
          <div className="mt-6 pt-4 border-t">
            <div className="relative inline-block">
                <button onClick={() => setShowExportMenu(!showExportMenu)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-xs flex items-center gap-2 shadow transition-colors">
                    <FileSpreadsheet size={14} /> Export Excel {showExportMenu ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                </button>
                {showExportMenu && (
                    <div className="absolute bottom-full left-0 mb-1 w-40 bg-white border rounded shadow-lg z-10 p-1">
                        <button onClick={()=>exportData('lastHour')} className="w-full text-left p-2 hover:bg-slate-50 text-xs rounded transition-colors">Last Hour</button>
                        <button onClick={()=>exportData('today')} className="w-full text-left p-2 hover:bg-slate-50 text-xs rounded transition-colors">Today</button>
                        <button onClick={()=>exportData('last7Days')} className="w-full text-left p-2 hover:bg-slate-50 text-xs rounded transition-colors">Last 7 Days</button>
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