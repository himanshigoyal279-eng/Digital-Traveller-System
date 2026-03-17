import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import Barcode from 'react-barcode'; 
import { Toast } from '../components/Toast';
import { 
  Save, Scan, RotateCcw, Box, Search, Activity, Bug, 
  Microscope, Wifi, ShieldCheck, Terminal, 
  FileSpreadsheet, ChevronDown, ChevronUp, Clock, Calendar, History,
  Zap, BatteryCharging, CheckCircle, AlertTriangle, ClipboardCheck, Cpu, UserCog, Globe, Shuffle, Plus, Trash2, MessageSquare
} from 'lucide-react';

// ✅ Import Bharti Logo
import bhartiLogo from '../assets/bharti.png'; 

// ----------------------------------------------------------------------
// ⚡️ TestCard defined OUTSIDE to prevent focus loss while typing
// ----------------------------------------------------------------------
const TestCard = ({ label, testKey, icon: Icon, data, onUpdate, onAddRow, onRemoveRow, onRowChange }) => {
  const failures = Array.isArray(data.failures) ? data.failures : [];

  return (
    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full transition-all hover:shadow-md">
        <div className="flex justify-between items-center mb-2">
            <h4 className="font-bold text-slate-700 text-xs uppercase flex items-center gap-2">
                <Icon size={14} className="text-blue-600"/> {label}
            </h4>
            <div className="flex gap-1">
                <button 
                    onClick={() => onUpdate(testKey, 'PASS')} 
                    className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${data.status === 'PASS' ? 'bg-green-100 border-green-500 text-green-700 shadow-sm scale-105' : 'bg-slate-50 text-slate-400'}`}
                >
                    PASS
                </button>
                <button 
                    onClick={() => onUpdate(testKey, 'FAIL')} 
                    className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${data.status === 'FAIL' ? 'bg-red-100 border-red-500 text-red-700 shadow-sm scale-105' : 'bg-slate-50 text-slate-400'}`}
                >
                    FAIL
                </button>
            </div>
        </div>
        
        {data.status === 'FAIL' && (
            <div className="flex-1 space-y-2 animate-in fade-in">
                <div className="flex justify-end">
                    <button 
                        onClick={() => onAddRow(testKey)} 
                        className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1 hover:bg-blue-100 transition-colors"
                    >
                        <Plus size={10}/> Add Row
                    </button>
                </div>
                
                <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                    {failures.map((fail, idx) => (
                        <div key={idx} className="flex gap-1 items-center bg-red-50/50 p-1 rounded border border-red-100">
                            <input 
                                value={fail.id || ''} 
                                onChange={(e) => onRowChange(testKey, idx, 'id', e.target.value)} 
                                className="w-12 p-1 border rounded text-[10px] text-center font-bold bg-white focus:ring-1 focus:ring-red-200 outline-none" 
                                placeholder="ID" 
                            />
                            <input 
                                value={fail.desc || ''} 
                                onChange={(e) => onRowChange(testKey, idx, 'desc', e.target.value)} 
                                className="flex-1 p-1 border rounded text-[10px] bg-white focus:ring-1 focus:ring-red-200 outline-none" 
                                placeholder="Description" 
                            />
                            <button 
                                onClick={() => onRemoveRow(testKey, idx)} 
                                className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-100"
                            >
                                <Trash2 size={12}/>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        )}
    </div>
  );
};

export const Station5 = () => {
  const mainInputRef = useRef(null);
  
  const [uid, setUid] = useState('');
  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const [tests, setTests] = useState({
    rap: { status: '', failures: [] },
    ota: { status: '', failures: [] },
    lbts: { status: '', failures: [] },
    sw: { status: '', failures: [] },
    ip: { status: '', failures: [] }
  });

  const [deepTestRemarks, setDeepTestRemarks] = useState('');
  const [targetDate, setTargetDate] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => { mainInputRef.current?.focus(); }, []);

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
      } catch (error) { console.error("Date Error", error); }
  };

  const handleRescan = () => {
    if (mainInputRef.current) { mainInputRef.current.value = ""; mainInputRef.current.focus(); }
    setUid(''); setProduct(null);
    setTests({ rap: { status: '', failures: [] }, ota: { status: '', failures: [] }, lbts: { status: '', failures: [] }, sw: { status: '', failures: [] }, ip: { status: '', failures: [] } });
    setDeepTestRemarks('');
    setTargetDate(null); setTimeLeft(null);
    setToast({ message: 'Ready', type: 'info' });
  };

  // ⚡️ UPDATED SEARCH: Robust Module + Unit Search
  const handleSearch = async () => {
    const rawText = mainInputRef.current.value.trim();
    if (!rawText) return;

    setIsLoading(true);
    try {
      const cleanedId = rawText.length > 20 ? rawText.substring(19, 30) : rawText;
      let docRef = doc(db, 'products', cleanedId);
      let docSnap = await getDoc(docRef);

      // Robust check for Module IDs if parent unit not found directly
      if (!docSnap.exists()) {
        const moduleQueries = [
            query(collection(db, 'products'), where('searchableModuleIds', 'array-contains', cleanedId)),
            query(collection(db, 'products'), where('searchableModuleIds', 'array-contains', rawText))
        ];

        for (const q of moduleQueries) {
            const snap = await getDocs(q);
            if (!snap.empty) {
                docSnap = snap.docs[0];
                setUid(docSnap.id); // Map back to Parent UID
                setToast({ message: 'Module Linked to Unit Found!', type: 'success' });
                break;
            }
        }
      } else {
        setUid(cleanedId);
        setToast({ message: 'Unit Found!', type: 'success' });
      }

      if (docSnap && docSnap.exists()) {
        const data = docSnap.data();
        setProduct(data);
        if (data.deepTests) { 
            setTests({
                rap: { ...data.deepTests.rap, failures: data.deepTests.rap?.failures || [] },
                ota: { ...data.deepTests.ota, failures: data.deepTests.ota?.failures || [] },
                lbts: { ...data.deepTests.lbts, failures: data.deepTests.lbts?.failures || [] },
                sw: { ...data.deepTests.sw, failures: data.deepTests.sw?.failures || [] },
                ip: { ...data.deepTests.ip, failures: data.deepTests.ip?.failures || [] }
            });
        }
        if (data.deepTestRemarks) setDeepTestRemarks(data.deepTestRemarks);
      } else {
        setProduct(null); setToast({ message: 'Unit or Module Not Found', type: 'error' });
      }
    } catch (e) { setToast({ message: 'Error: ' + e.message, type: 'error' }); }
    finally { setIsLoading(false); }
  };

  const updateTestStatus = (key, status) => {
      setTests(prev => ({ ...prev, [key]: { ...prev[key], status, failures: status === 'PASS' ? [] : (prev[key].failures || []) } }));
  };

  const addFailureRow = (key) => {
      setTests(prev => ({ ...prev, [key]: { ...prev[key], failures: [...(prev[key].failures || []), { id: '', desc: '' }] } }));
  };

  const removeFailureRow = (key, index) => {
      setTests(prev => {
          const newFailures = [...(prev[key].failures || [])];
          newFailures.splice(index, 1);
          return { ...prev, [key]: { ...prev[key], failures: newFailures } };
      });
  };

  const updateFailureRow = (key, index, field, value) => {
      setTests(prev => {
          const newFailures = [...(prev[key].failures || [])];
          newFailures[index][field] = value;
          return { ...prev, [key]: { ...prev[key], failures: newFailures } };
      });
  };

  const handleSubmit = async () => {
    if (!product) return;
    setIsLoading(true);
    try {
      const allPassed = Object.values(tests).every(t => t.status === 'PASS');
      const finalStatus = allPassed ? 'Deep Test Passed' : 'Deep Test Failed';
      await updateDoc(doc(db, 'products', uid), {
        status: finalStatus,
        deepTests: tests,
        deepTestRemarks: deepTestRemarks,
        deepTestStatus: finalStatus,
        logs: [...(product.logs || []), { action: `Deep Tests: ${finalStatus}`, timestamp: new Date() }]
      });
      setToast({ message: 'All Deep Tests Saved!', type: 'success' });
      setTimeout(handleRescan, 1000);
    } catch (e) { setToast({ message: 'Save Failed', type: 'error' }); } 
    finally { setIsLoading(false); }
  };

  const formatList = (obj) => obj ? Object.keys(obj).join(', ') : 'None';
  const formatFailures = (f) => (!f || f.length === 0) ? '-' : f.map(x => `[${x.id}:${x.desc}]`).join(' | ');
  
  const getTrxReason = (trx) => {
      if (!trx) return '-';
      let r = [];
      if (trx.bscanFailures?.length) r.push(`BSCAN: ${formatFailures(trx.bscanFailures)}`);
      if (trx.paFailures?.length) r.push(`PA: ${formatFailures(trx.paFailures)}`);
      if (trx.faultDesc) r.push(trx.faultDesc);
      return r.length > 0 ? r.join(' | ') : '-';
  };
  const getPsuReason = (psu) => psu?.failures?.length ? formatFailures(psu.failures) : psu?.faultDesc || '-';

  const exportData = async () => {
      setIsExporting(true);
      try {
          const q = query(collection(db, 'products'));
          const snap = await getDocs(q);
          const data = [];
          snap.forEach(doc => {
              const p = doc.data();
              if (p.deepTests) {
                  data.push({
                      'Serial': p.uid, 'Product': p.productNo,
                      'RAP': p.deepTests.rap?.status, 'RAP Fail': formatFailures(p.deepTests.rap?.failures),
                      'OTA': p.deepTests.ota?.status, 'OTA Fail': formatFailures(p.deepTests.ota?.failures),
                      'LBTS': p.deepTests.lbts?.status, 'LBTS Fail': formatFailures(p.deepTests.lbts?.failures),
                      'SW': p.deepTests.sw?.status, 'SW Fail': formatFailures(p.deepTests.sw?.failures),
                      'IP': p.deepTests.ip?.status, 'IP Fail': formatFailures(p.deepTests.ip?.failures),
                      'Remarks': p.deepTestRemarks || '-', 'Result': p.deepTestStatus
                  });
              }
          });
          const ws = XLSX.utils.json_to_sheet(data);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Data");
          XLSX.writeFile(wb, `DeepTest_Data_${new Date().getTime()}.xlsx`);
          setToast({ message: 'Downloaded', type: 'success' }); setShowExportMenu(false);
      } catch (e) { setToast({ message: 'Error Exporting', type: 'error' }); } finally { setIsExporting(false); }
  };

  const isOverseas = product?.regionType === 'Overseas';

  return (
    <div className={`min-h-screen p-4 text-slate-800 text-sm ${isOverseas ? 'bg-sky-50' : 'bg-slate-50'}`}>
      <div className="w-full max-w-[98%] mx-auto">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 border-b-2 border-cyan-600 pb-2 w-fit">
          <Microscope className="w-6 h-6 text-cyan-600" /> Station 5: Deep Tests
        </h2>
        
        <div className={`rounded-xl p-4 shadow-lg border bg-white ${isOverseas ? 'border-sky-200' : 'border-slate-200'}`}>
          
          {/* SCANNER BAR */}
          <div className="flex gap-4 mb-6 bg-slate-100 p-3 rounded-lg border border-slate-300">
             <div className="flex-1 bg-slate-900 p-3 rounded-lg flex items-center gap-3 shadow-inner" onClick={() => mainInputRef.current?.focus()}>
                <Scan className="text-cyan-400 animate-pulse w-5 h-5" />
                <input ref={mainInputRef} className="w-full bg-transparent text-green-400 font-mono outline-none text-base font-bold" autoFocus onKeyDown={(e)=>e.key==='Enter'&&handleSearch()} placeholder="Scan Serial OR Module QR..." autoComplete="off" />
             </div>
             <button onClick={handleSearch} className="bg-blue-600 text-white px-6 rounded-lg font-bold hover:bg-blue-700">Search</button>
             <button onClick={handleRescan} className="bg-slate-700 text-white px-4 rounded-lg shadow hover:bg-slate-600"><RotateCcw size={18} /></button>
          </div>

          {product && (
            <div className="animate-in fade-in duration-300 space-y-6">
                
                {/* HEADER INFO */}
                <div className={`rounded-xl p-4 shadow-xl border-l-4 ${isOverseas ? 'bg-sky-900 border-sky-400' : 'bg-slate-900 border-blue-500'}`}>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center text-white text-center">
                        <div className="flex flex-col items-center bg-white p-2 rounded-lg"><Barcode value={uid} width={1.5} height={40} fontSize={14} /></div>
                        <div><span className="text-white/60 text-xs block uppercase">Target</span><span className="text-xl font-bold">{targetDate || 'N/A'}</span></div>
                        <div><span className="text-white/60 text-xs block uppercase">Time Left</span><span className={`text-xl font-bold ${timeLeft === 'EXPIRED' ? 'text-red-400 animate-pulse' : 'text-green-400'}`}>{timeLeft || '--'}</span></div>
                        <div><span className="text-white/60 text-xs block uppercase">Type</span><span className="text-xl font-bold uppercase">{product.productStatus || 'SCRAP'}</span></div>
                        <div><span className="text-white/60 text-xs block uppercase">Region</span><span className="text-xl font-bold uppercase">{product.regionType || 'National'}</span></div>
                    </div>
                </div>

                {product.customerName === 'BHARTI' && (
                    <div className="flex justify-center -mt-4 mb-2">
                        <div className="bg-white px-6 py-2 rounded-b-xl shadow-md border border-t-0 border-slate-200">
                            <img src={bhartiLogo} alt="Airtel" className="h-8 object-contain" />
                        </div>
                    </div>
                )}

                {/* --- DETAILED HISTORY REPORT --- */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide border-b pb-1">Detailed Unit History</h3>
                    <div className={`p-3 rounded-lg border grid grid-cols-2 md:grid-cols-6 gap-3 text-xs ${isOverseas ? 'bg-sky-50 border-sky-200' : 'bg-blue-50 border-blue-100'}`}>
                        <div><span className="text-slate-500 block">Product</span><span className="font-bold">{product.productNo}</span></div>
                        <div><span className="text-slate-500 block">Family</span><span className="font-bold">{product.familyName}</span></div>
                        <div><span className="text-slate-500 block">Customer</span><span className="font-bold">{product.customerName}</span></div>
                        <div><span className="text-slate-500 block">Entry Date</span><span className="font-bold">{product.rcInDate}</span></div>
                        <div><span className="text-slate-500 block">Engineer</span><span className="font-bold">{product.engineerName || '-'}</span></div>
                        <div><span className="text-slate-500 block">Status</span><span className="font-bold text-blue-600">{product.status}</span></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-2 p-3 bg-purple-50 border-l-4 border-purple-500 rounded-r shadow-sm text-xs items-center">
                        <div className="font-bold text-purple-800 flex items-center gap-2"><Search size={14}/> STATION 2</div>
                        <div><span className="text-slate-400 block">Visual Status</span><span className={`font-bold ${product.visualInspection?.ipStatus === 'FAIL' ? 'text-red-600' : 'text-green-600'}`}>{product.visualInspection?.ipStatus || 'Pending'}</span></div>
                        <div><span className="text-slate-400 block">Date</span><span className="font-bold">{product.visualInspection?.timestamp ? new Date(product.visualInspection.timestamp).toLocaleDateString() : '-'}</span></div>
                        <div className="col-span-1"><span className="text-slate-400 block">Missing Items</span><span className="font-bold text-red-600 truncate">{formatList(product.visualInspection?.missingItems)}</span></div>
                        <div className="col-span-1"><span className="text-slate-400 block">Mech Defects</span><span className="font-bold text-red-600 truncate">{formatList(product.visualInspection?.mechanicalStatus)}</span></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-7 gap-2 p-3 bg-orange-50 border-l-4 border-orange-500 rounded-r shadow-sm text-xs items-start">
                        <div className="font-bold text-orange-800 flex items-center gap-2 md:col-span-1"><Activity size={14}/> STATION 3</div>
                        <div className="col-span-3">
                            <span className="text-slate-400 block">RAP Status: <b className={product.rapTest?.status==='FAIL'?'text-red-600':'text-green-600'}>{product.rapTest?.status}</b></span>
                            {product.rapTest?.status === 'FAIL' && <div className="text-red-600 font-mono mt-1 text-[10px] bg-white p-1 rounded border border-red-200">{formatFailures(product.rapTest?.failures)}</div>}
                        </div>
                        <div className="col-span-3 border-l pl-2 border-orange-200">
                            <span className="text-slate-400 block">UNIT Status: <b className={product.unitTest?.status==='FAIL'?'text-red-600':'text-green-600'}>{product.unitTest?.status}</b></span>
                            {product.unitTest?.status === 'FAIL' && <div className="text-red-600 font-mono mt-1 text-[10px] bg-white p-1 rounded border border-red-200">{formatFailures(product.unitTest?.failures)}</div>}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-7 gap-2 p-3 bg-rose-50 border-l-4 border-rose-500 rounded-r shadow-sm text-xs items-start">
                        <div className="font-bold text-rose-800 flex items-center gap-2 md:col-span-1"><Bug size={14}/> STATION 4</div>
                        <div className="col-span-2">
                            <span className="text-slate-400 block">TRX Status: <b className={product.debugValidation?.trx?.status==='FAIL'?'text-red-600':'text-green-600'}>{product.debugValidation?.trx?.status}</b></span>
                            {product.debugValidation?.trx?.status === 'FAIL' && <div className="text-red-600 font-mono mt-1 text-[10px] bg-white p-1 rounded border border-red-200">{getTrxReason(product.debugValidation?.trx)}</div>}
                        </div>
                        <div className="col-span-2 border-l pl-2 border-rose-200">
                            <span className="text-slate-400 block">PSU Status: <b className={product.debugValidation?.psu?.status==='FAIL'?'text-red-600':'text-green-600'}>{product.debugValidation?.psu?.status}</b></span>
                            {product.debugValidation?.psu?.status === 'FAIL' && <div className="text-red-600 font-mono mt-1 text-[10px] bg-white p-1 rounded border border-red-200">{getPsuReason(product.debugValidation?.psu)}</div>}
                        </div>
                        <div className="col-span-2 border-l pl-2 border-rose-200">
                             <span className="text-slate-400 block flex items-center gap-1"><Cpu size={10}/> Module QR</span>
                             <span className="font-mono font-bold text-slate-700 truncate">{product.moduleQr || 'Not Linked'}</span>
                        </div>
                    </div>
                </div>

                <hr className="border-slate-200" />

                {/* TEST CARDS GRID */}
                <div>
                    <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2"><Microscope className="w-4 h-4 text-cyan-600"/> Execute Deep Tests</h3>
                    <div className="flex flex-col gap-4">
                        {['rap', 'ota', 'lbts', 'sw', 'ip'].map(key => (
                            <TestCard 
                                key={key}
                                label={`${key.toUpperCase()} Test`} 
                                testKey={key} 
                                icon={key==='rap'?Activity:key==='ota'?Wifi:key==='lbts'?Box:key==='sw'?Terminal:ShieldCheck} 
                                data={tests[key]} 
                                onUpdate={updateTestStatus}
                                onAddRow={addFailureRow}
                                onRemoveRow={removeFailureRow}
                                onRowChange={updateFailureRow}
                            />
                        ))}
                    </div>
                </div>

                {/* REMARKS */}
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                    <h3 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2"><MessageSquare size={14}/> Technician Description / Remarks</h3>
                    <textarea value={deepTestRemarks} onChange={(e) => setDeepTestRemarks(e.target.value)} rows="3" className="w-full p-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none resize-none" placeholder="Enter notes..."></textarea>
                </div>

                {/* SAVE */}
                <button onClick={handleSubmit} disabled={isLoading} className="w-full py-4 bg-slate-900 text-white font-bold text-lg rounded-xl shadow hover:bg-slate-800 flex items-center justify-center gap-2">
                    <Save className="w-5 h-5"/> {isLoading ? 'Saving...' : 'Save Deep Test Results'}
                </button>

                {/* EXPORT */}
                <div className="border-t pt-4">
                    <button onClick={exportData} disabled={isExporting} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-xs flex items-center gap-2 shadow">
                        <FileSpreadsheet size={14} /> {isExporting ? 'Exporting...' : 'Export Full Report'}
                    </button>
                </div>

            </div>
          )}

        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};