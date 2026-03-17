import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, collection, query, getDocs } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import Barcode from 'react-barcode'; 
import { Toast } from '../components/Toast';
import { 
  Save, Scan, RotateCcw, Box, Search, Activity, Bug, Zap, 
  BatteryCharging, Cpu, CheckCircle, FileSpreadsheet, 
  ChevronDown, ChevronUp, Clock, Calendar, History, 
  AlertTriangle, Shuffle, Globe, UserCog, Plus, Trash2, MessageSquare,
  Tag, Wifi // ✅ Added missing icons to prevent crash
} from 'lucide-react';

// ✅ Import Bharti Logo
import bhartiLogo from '../assets/bharti.png'; 

export const Station4 = () => {
  const mainInputRef = useRef(null);
  
  // Core States
  const [uid, setUid] = useState('');
  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // --- 1. TRX TEST STATES (Multiple Rows) ---
  const [trxStatus, setTrxStatus] = useState('');
  const [bscanFailures, setBscanFailures] = useState([]); 
  const [paFailures, setPaFailures] = useState([]); 

  // --- 2. PSU TEST STATES (Multiple Rows) ---
  const [psuStatus, setPsuStatus] = useState('');
  const [psuFailures, setPsuFailures] = useState([]); 

  // --- 3. MODULE REGISTRATION STATES (Missing states added to prevent crash) ---
  const [trxModuleQr, setTrxModuleQr] = useState('');
  const [psuModuleQr, setPsuModuleQr] = useState('');
  const [afmModuleQr, setAfmModuleQr] = useState('');

  // General Remarks
  const [debugRemarks, setDebugRemarks] = useState('');

  // Dashboard Data
  const [targetDate, setTargetDate] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // --- DATA OPTIONS ---
  const trxBscanOptions = [
    "175 - WriteLutTable(bias tuning)", "19 - BSCAN_infra", "58 - Ethermet BootUp",
    "23 - Bscan_Interconnection", "24 - bscan_madeDDr"
  ];
  const trxPaTesterOptions = [
    "231 - getReadyForTest", "71 - trxReturnLossAllPipetest_2_RXReturnLoss"
  ];
  const psuFaultOptions = [
    "10- Dut Check", "11- PSU ON", "12-PSU ON", "13-PSU ON", "14- PSU ON",
    "15- 12VRoute", "16- Program_12V", "17- Pa2Route", "18-Program_PA2",
    "19- Pa1Route", "20-Program_PA1", "21- CloseNi6501Port0", "22- PSU Off",
    "23-PAEnable", "24- PSU ON", "25- PA1Version", "26-12V Version",
    "27- PA2Version", "28- CalibrationVoltageM", "29-CalibrationVoltageB",
    "30- CalibrationPowerM", "31- CalibrationPowerB", "32- PsuAdm1075Calibration"
  ];

  useEffect(() => { mainInputRef.current?.focus(); }, []);

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
    if (mainInputRef.current) { mainInputRef.current.value = ""; mainInputRef.current.focus(); }
    setUid(''); setProduct(null);
    setTrxStatus(''); setBscanFailures([]); setPaFailures([]);
    setPsuStatus(''); setPsuFailures([]);
    setDebugRemarks(''); 
    setTrxModuleQr(''); setPsuModuleQr(''); setAfmModuleQr('');
    setTargetDate(null); setTimeLeft(null);
    setToast({ message: 'Ready', type: 'info' });
  };

  const handleSearch = async () => {
    const rawText = mainInputRef.current.value;
    if (!rawText) { setToast({ message: 'Empty!', type: 'error' }); return; }
    let searchId = rawText.length > 20 ? rawText.substring(19, 30) : rawText;
    setUid(searchId);
    setIsLoading(true);

    try {
      const docRef = doc(db, 'products', searchId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setProduct(data);
        
        if (data.debugValidation) {
            const d = data.debugValidation;
            if (d.trx) { 
                setTrxStatus(d.trx.status || ''); 
                setBscanFailures(d.trx.bscanFailures || []);
                setPaFailures(d.trx.paFailures || []);
            }
            if (d.psu) { 
                setPsuStatus(d.psu.status || ''); 
                setPsuFailures(d.psu.failures || []);
            }
        }
        if (data.moduleRegistration) {
            setTrxModuleQr(data.moduleRegistration.trx || '');
            setPsuModuleQr(data.moduleRegistration.psu || '');
            setAfmModuleQr(data.moduleRegistration.afm || '');
        }
        if (data.debugRemarks) setDebugRemarks(data.debugRemarks);
        setToast({ message: 'Found!', type: 'success' });
      } else {
        setToast({ message: 'Not Found', type: 'error' });
        setProduct(null);
      }
    } catch (error) { setToast({ message: 'Error: ' + error.message, type: 'error' }); } 
    finally { setIsLoading(false); }
  };

  const addRow = (type, value = null) => {
      const newRow = value ? (() => {
          const parts = value.split('-');
          return { id: parts[0].trim(), desc: parts.slice(1).join('-').trim(), loc: '', pn: '' };
      })() : { id: '', desc: '', loc: '', pn: '' };

      if (type === 'BSCAN') setBscanFailures([...bscanFailures, newRow]);
      else if (type === 'PA') setPaFailures([...paFailures, newRow]);
      else setPsuFailures([...psuFailures, newRow]);
  };

  const updateRow = (type, index, field, val) => {
      let rows = (type === 'BSCAN') ? [...bscanFailures] : (type === 'PA') ? [...paFailures] : [...psuFailures];
      rows[index][field] = val;
      if (type === 'BSCAN') setBscanFailures(rows);
      else if (type === 'PA') setPaFailures(rows);
      else setPsuFailures(rows);
  };

  const removeRow = (type, index) => {
      let rows = (type === 'BSCAN') ? [...bscanFailures] : (type === 'PA') ? [...paFailures] : [...psuFailures];
      rows.splice(index, 1);
      if (type === 'BSCAN') setBscanFailures(rows);
      else if (type === 'PA') setPaFailures(rows);
      else setPsuFailures(rows);
  };

  const handleSubmit = async () => {
    if (!product) return;
    if (!trxStatus || !psuStatus) { setToast({ message: 'Select Status', type: 'warning' }); return; }
    if (!trxModuleQr) { setToast({ message: 'Scan TRX Module', type: 'error' }); return; }

    setIsLoading(true);
    try {
      const overallStatus = (trxStatus === 'PASS' && psuStatus === 'PASS') ? 'Debug PASS' : 'Debug FAIL';
      
      await updateDoc(doc(db, 'products', uid), {
        status: `Disassembled (${overallStatus})`, 
        debugValidation: {
            trx: { status: trxStatus, bscanFailures, paFailures },
            psu: { status: psuStatus, failures: psuFailures },
            timestamp: new Date().toISOString()
        },
        moduleRegistration: { trx: trxModuleQr, psu: psuModuleQr, afm: afmModuleQr },
        debugRemarks: debugRemarks,
        searchableModuleIds: [trxModuleQr, psuModuleQr, afmModuleQr].filter(id => id !== ''), 
        logs: [...(product.logs || []), { action: `Debug: ${overallStatus}`, timestamp: new Date() }]
      });
      setToast({ message: 'Saved!', type: 'success' });
      setTimeout(() => handleRescan(), 1000);
    } catch (error) { setToast({ message: 'Save Failed', type: 'error' }); } 
    finally { setIsLoading(false); }
  };

  const formatFailures = (failures) => {
      if (!failures || failures.length === 0) return 'None';
      return failures.map(f => `[${f.id}:${f.desc} (${f.loc}/${f.pn})]`).join(' | ');
  };
  
  const formatList = (obj) => {
    if (!obj) return 'None';
    const active = Object.keys(obj).filter(k => obj[k] === 'FAIL' || obj[k] === true);
    return active.length > 0 ? active.join(', ') : 'None';
  };

  const exportData = async (filterType) => {
    setIsExporting(true);
    try {
      const now = new Date();
      let startTime;
      if (filterType === 'lastHour') startTime = new Date(now.getTime() - 3600000);
      else if (filterType === 'today') startTime = new Date(now.setHours(0, 0, 0, 0));
      else startTime = new Date(now.getTime() - 604800000);

      const q = query(collection(db, 'products'));
      const snap = await getDocs(q);
      const data = [];
      snap.forEach(doc => {
        const p = doc.data();
        if (p.debugValidation?.timestamp) {
            const date = new Date(p.debugValidation.timestamp);
            if (date >= startTime) {
                data.push({
                    'SN': p.uid, 'Product': p.productNo, 
                    'TRX Status': p.debugValidation.trx?.status, 
                    'BSCAN Failures': formatFailures(p.debugValidation.trx?.bscanFailures),
                    'PA Failures': formatFailures(p.debugValidation.trx?.paFailures),
                    'PSU Status': p.debugValidation.psu?.status,
                    'PSU Failures': formatFailures(p.debugValidation.psu?.failures),
                    'Remarks': p.debugRemarks || '-',
                    'Date': date.toLocaleDateString(), 'Time': date.toLocaleTimeString()
                });
            }
        }
      });
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data");
      XLSX.writeFile(wb, `Debug_Data_${now.getTime()}.xlsx`);
      setToast({ message: 'Downloaded', type: 'success' }); setShowExportMenu(false);
    } catch (e) { setToast({ message: 'Error', type: 'error' }); } finally { setIsExporting(false); }
  };

  const isOverseas = product?.regionType === 'Overseas';
  const bgColor = isOverseas ? 'bg-sky-50' : 'bg-slate-50';
  const cardColor = isOverseas ? 'bg-white border-sky-200' : 'bg-white border-slate-200';

  return (
    <div className={`min-h-screen p-4 text-slate-800 text-sm transition-colors duration-500 ${bgColor}`}>
      <div className="w-full max-w-[98%] mx-auto">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 border-b-2 border-blue-600 pb-2 w-fit">
          <Bug className="w-6 h-6 text-blue-600" /> Station 4: Debug & Module Registry
        </h2>
        
        <div className={`rounded-xl p-4 shadow-lg border ${cardColor}`}>
          
          {/* SCANNER */}
          <div className="flex gap-4 mb-4 bg-slate-100 p-3 rounded-lg border border-slate-300">
             <div className="flex-1 bg-slate-900 p-3 rounded-lg flex items-center gap-3 cursor-text shadow-inner" onClick={() => mainInputRef.current?.focus()}>
                <Scan className="text-blue-400 animate-pulse w-5 h-5" />
                <input ref={mainInputRef} className="w-full bg-transparent text-green-400 font-mono outline-none text-base font-bold" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder="Scan..." autoComplete="off" />
             </div>
             <button onClick={handleSearch} className="bg-blue-600 text-white px-6 rounded-lg font-bold shadow hover:bg-blue-700">Search</button>
             <button onClick={handleRescan} className="bg-slate-700 text-white px-4 rounded-lg shadow hover:bg-slate-600"><RotateCcw size={18} /></button>
          </div>

          {product && (
            <div className="animate-in fade-in duration-300 space-y-6">
              
              {/* HEADER */}
              <div className={`rounded-xl p-4 shadow-xl border-l-4 ${isOverseas ? 'bg-sky-900 border-sky-400' : 'bg-slate-900 border-blue-500'}`}>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center text-white">
                      <div className="flex flex-col items-center bg-white p-2 rounded-lg"><Barcode value={uid} width={1.5} height={40} fontSize={14} marginTop={0} marginBottom={0} /></div>
                      <div className="text-center border-r px-4 border-slate-600"><span className="text-xs block text-slate-400">Target</span><span className="text-xl font-bold">{targetDate || 'N/A'}</span></div>
                      <div className="text-center border-r px-4 border-slate-600"><span className="text-xs block text-slate-400">Time Left</span><span className="text-xl font-bold text-green-400">{timeLeft || '--'}</span></div>
                      <div className="text-center border-r px-4 border-slate-600"><span className="text-xs block text-slate-400">Type</span><span className="text-xl font-bold text-yellow-400">{product.productStatus || 'SCRAP'}</span></div>
                      <div className="text-center"><span className="text-xs block text-slate-400">Region</span><span className="text-xl font-bold text-cyan-400">{product.regionType || 'National'}</span></div>
                  </div>
              </div>

              {product.customerName === 'BHARTI' && (
                  <div className="flex justify-center -mt-4 mb-2 animate-in slide-in-from-top-2 fade-in relative z-10">
                      <div className="bg-white px-6 py-2 rounded-b-xl shadow-md border-x border-b border-slate-200">
                          <img src={bhartiLogo} alt="Airtel/Bharti" className="h-8 object-contain" />
                      </div>
                  </div>
              )}

              {/* --- DETAILED HISTORY --- */}
              <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide border-b pb-1">Detailed Unit History</h3>
                  
                  {/* Station 1 Row */}
                  <div className={`p-3 rounded-lg border grid grid-cols-2 md:grid-cols-6 gap-3 text-xs ${isOverseas ? 'bg-sky-50 border-sky-200' : 'bg-blue-50 border-blue-100'}`}>
                      <div><span className="text-slate-500 block">Product</span><span className="font-bold">{product.productNo}</span></div>
                      <div><span className="text-slate-500 block">Family</span><span className="font-bold">{product.familyName}</span></div>
                      <div><span className="text-slate-500 block">Customer</span><span className="font-bold">{product.customerName}</span></div>
                      <div><span className="text-slate-500 block">Entry Date</span><span className="font-bold">{product.rcInDate}</span></div>
                      <div><span className="text-slate-500 block">Engineer</span><span className="font-bold flex items-center gap-1"><UserCog size={12}/>{product.engineerName || '-'}</span></div>
                      <div><span className="text-slate-500 block">Status</span><span className="font-bold text-blue-600">{product.status}</span></div>
                  </div>

                  {/* Station 2 Row */}
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-2 p-3 bg-purple-50 border-l-4 border-purple-500 rounded-r shadow-sm text-xs items-center">
                      <div className="font-bold text-purple-800 flex items-center gap-2"><Search size={14}/> STATION 2</div>
                      <div><span className="text-slate-400 block">Visual Status</span><span className={`font-bold ${product.visualInspection?.ipStatus === 'FAIL' ? 'text-red-600' : 'text-green-600'}`}>{product.visualInspection?.ipStatus || 'Pending'}</span></div>
                      <div><span className="text-slate-400 block">Date</span><span className="font-bold">{product.visualInspection?.timestamp ? new Date(product.visualInspection.timestamp).toLocaleString('en-GB') : '-'}</span></div>
                      <div className="col-span-1"><span className="text-slate-400 block">Missing Items</span><span className="font-bold text-red-600 truncate">{formatList(product.visualInspection?.missingItems)}</span></div>
                      <div className="col-span-1"><span className="text-slate-400 block">Mech Defects</span><span className="font-bold text-red-600 truncate">{formatList(product.visualInspection?.mechanicalStatus)}</span></div>
                  </div>

                  {/* Station 3 Row */}
                  <div className="p-3 bg-orange-50 border-l-4 border-orange-500 rounded-r shadow-sm text-xs space-y-2">
                      <div className="flex items-center gap-2 font-bold text-orange-800 border-b border-orange-200 pb-1 mb-1"><Activity size={14}/> STATION 3 (RAP/UNIT)</div>
                      
                      {/* RAP Details */}
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                          <div className="md:col-span-1"><span className="text-slate-400 block">RAP Status</span><span className={`font-bold ${product.rapTest?.status==='FAIL'?'text-red-600':'text-green-600'}`}>{product.rapTest?.status || '-'}</span></div>
                          <div className="md:col-span-5 bg-white p-1 rounded border border-slate-200">
                             <span className="text-[10px] text-slate-400 block">Failures:</span>
                             <span className="font-mono font-bold text-red-600">{formatFailures(product.rapTest?.failures)}</span>
                          </div>
                      </div>

                      {/* UNIT Details */}
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                          <div className="md:col-span-1"><span className="text-slate-400 block">UNIT Status</span><span className={`font-bold ${product.unitTest?.status==='FAIL'?'text-red-600':'text-green-600'}`}>{product.unitTest?.status || '-'}</span></div>
                          <div className="md:col-span-5 bg-white p-1 rounded border border-slate-200">
                             <span className="text-[10px] text-slate-400 block">Failures:</span>
                             <span className="font-mono font-bold text-red-600">{formatFailures(product.unitTest?.failures)}</span>
                          </div>
                      </div>

                      {product.technicianRemarks && (
                          <div className="bg-yellow-50 p-2 rounded border border-yellow-200 mt-1">
                              <span className="text-slate-500 font-bold text-[10px] uppercase">Technician Remarks:</span>
                              <p className="italic text-slate-700">{product.technicianRemarks}</p>
                          </div>
                      )}
                  </div>
              </div>

              <hr className="border-slate-200" />

              {/* --- DEBUG SECTION --- */}
              <div className="flex flex-col gap-6">
                  
                  {/* TRX Test */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div className="flex justify-between items-center mb-3">
                          <h3 className="font-bold text-slate-800 flex items-center gap-2"><Zap className="text-yellow-600 w-5 h-5" /> TRX Test</h3>
                          <div className="flex gap-2">
                              <button onClick={() => setTrxStatus('PASS')} className={`px-4 py-1 rounded font-bold text-xs border ${trxStatus === 'PASS' ? 'bg-green-100 border-green-500 text-green-700' : 'bg-white'}`}>PASS</button>
                              <button onClick={() => setTrxStatus('FAIL')} className={`px-4 py-1 rounded font-bold text-xs border ${trxStatus === 'FAIL' ? 'bg-red-100 border-red-500 text-red-700' : 'bg-white'}`}>FAIL</button>
                          </div>
                      </div>
                      
                      {trxStatus === 'FAIL' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in">
                              <div className="bg-white p-3 rounded border border-slate-300">
                                  <div className="flex justify-between items-center mb-2">
                                      <h4 className="font-bold text-slate-700">BSCAN Failures</h4>
                                      <div className="flex gap-2">
                                          <select onChange={(e) => {addRow('BSCAN', e.target.value); e.target.value="";}} className="p-1 border rounded text-xs"><option value="">+ Add...</option>{trxBscanOptions.map(o=><option key={o}>{o}</option>)}</select>
                                          <button onClick={() => addRow('BSCAN')} className="bg-blue-100 text-blue-700 px-2 rounded text-xs flex items-center"><Plus size={12}/> Manual</button>
                                      </div>
                                  </div>
                                  <div className="space-y-2 max-h-40 overflow-y-auto">
                                      {bscanFailures.map((f, i) => (
                                          <div key={i} className="flex gap-1 items-center bg-slate-50 p-1 rounded border">
                                              <input value={f.id} onChange={(e)=>updateRow('BSCAN',i,'id',e.target.value)} className="w-12 p-1 border text-xs text-center" placeholder="ID"/>
                                              <input value={f.desc} onChange={(e)=>updateRow('BSCAN',i,'desc',e.target.value)} className="flex-1 p-1 border text-xs" placeholder="Desc"/>
                                              <input value={f.loc} onChange={(e)=>updateRow('BSCAN',i,'loc',e.target.value)} className="w-12 p-1 border text-xs text-center" placeholder="Loc"/>
                                              <input value={f.pn} onChange={(e)=>updateRow('BSCAN',i,'pn',e.target.value)} className="w-16 p-1 border text-xs text-center" placeholder="P/N"/>
                                              <button onClick={()=>removeRow('BSCAN',i)} className="text-red-500"><Trash2 size={14}/></button>
                                          </div>
                                      ))}
                                  </div>
                              </div>

                              <div className="bg-white p-3 rounded border border-slate-300">
                                  <div className="flex justify-between items-center mb-2">
                                      <h4 className="font-bold text-slate-700">PA Tester Failures</h4>
                                      <div className="flex gap-2">
                                          <select onChange={(e) => {addRow('PA', e.target.value); e.target.value="";}} className="p-1 border rounded text-xs"><option value="">+ Add...</option>{trxPaTesterOptions.map(o=><option key={o}>{o}</option>)}</select>
                                          <button onClick={() => addRow('PA')} className="bg-blue-100 text-blue-700 px-2 rounded text-xs flex items-center"><Plus size={12}/> Manual</button>
                                      </div>
                                  </div>
                                  <div className="space-y-2 max-h-40 overflow-y-auto">
                                      {paFailures.map((f, i) => (
                                          <div key={i} className="flex gap-1 items-center bg-slate-50 p-1 rounded border">
                                              <input value={f.id} onChange={(e)=>updateRow('PA',i,'id',e.target.value)} className="w-12 p-1 border text-xs text-center" placeholder="ID"/>
                                              <input value={f.desc} onChange={(e)=>updateRow('PA',i,'desc',e.target.value)} className="flex-1 p-1 border text-xs" placeholder="Desc"/>
                                              <input value={f.loc} onChange={(e)=>updateRow('PA',i,'loc',e.target.value)} className="w-12 p-1 border text-xs text-center" placeholder="Loc"/>
                                              <input value={f.pn} onChange={(e)=>updateRow('PA',i,'pn',e.target.value)} className="w-16 p-1 border text-xs text-center" placeholder="P/N"/>
                                              <button onClick={()=>removeRow('PA',i)} className="text-red-500"><Trash2 size={14}/></button>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>

                  {/* 2. PSU Test */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div className="flex justify-between items-center mb-3">
                          <h3 className="font-bold text-slate-800 flex items-center gap-2"><BatteryCharging className="text-blue-600 w-5 h-5" /> PSU Test</h3>
                          <div className="flex gap-2">
                              <button onClick={() => setPsuStatus('PASS')} className={`px-4 py-1 rounded font-bold text-xs border ${psuStatus === 'PASS' ? 'bg-green-100 border-green-500 text-green-700' : 'bg-white'}`}>PASS</button>
                              <button onClick={() => setPsuStatus('FAIL')} className={`px-4 py-1 rounded font-bold text-xs border ${psuStatus === 'FAIL' ? 'bg-red-100 border-red-500 text-red-700' : 'bg-white'}`}>FAIL</button>
                          </div>
                      </div>
                      
                      {psuStatus === 'FAIL' && (
                          <div className="bg-white p-3 rounded border border-red-100 animate-in fade-in">
                              <div className="flex justify-between items-center mb-2">
                                  <h4 className="font-bold text-slate-700">PSU Failures</h4>
                                  <div className="flex gap-2">
                                      <select onChange={(e) => {addRow('PSU', e.target.value); e.target.value="";}} className="p-1 border rounded text-xs"><option value="">+ Add...</option>{psuFaultOptions.map(o=><option key={o}>{o}</option>)}</select>
                                      <button onClick={() => addRow('PSU')} className="bg-blue-100 text-blue-700 px-2 rounded text-xs flex items-center"><Plus size={12}/> Manual</button>
                                  </div>
                              </div>
                              <div className="space-y-2 max-h-40 overflow-y-auto">
                                  {psuFailures.map((f, i) => (
                                      <div key={i} className="flex gap-1 items-center bg-slate-50 p-1 rounded border">
                                          <input value={f.id} onChange={(e)=>updateRow('PSU',i,'id',e.target.value)} className="w-12 p-1 border text-xs text-center" placeholder="ID"/>
                                          <input value={f.desc} onChange={(e)=>updateRow('PSU',i,'desc',e.target.value)} className="flex-1 p-1 border text-xs" placeholder="Desc"/>
                                          <input value={f.loc} onChange={(e)=>updateRow('PSU',i,'loc',e.target.value)} className="w-12 p-1 border text-xs text-center" placeholder="Loc"/>
                                          <input value={f.pn} onChange={(e)=>updateRow('PSU',i,'pn',e.target.value)} className="w-16 p-1 border text-xs text-center" placeholder="P/N"/>
                                          <button onClick={()=>removeRow('PSU',i)} className="text-red-500"><Trash2 size={14}/></button>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>

              </div>

              {/* 5. TECHNICIAN REMARKS */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                  <h3 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2"><MessageSquare size={14}/> Debug Technician Remarks</h3>
                  <textarea 
                      value={debugRemarks} 
                      onChange={(e) => setDebugRemarks(e.target.value)} 
                      rows="3" 
                      className="w-full p-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none resize-none" 
                      placeholder="Repair notes..."
                  ></textarea>
              </div>

              {/* MODULE REGISTRATION */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-300 shadow-inner space-y-3">
                  <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight"><Cpu className="text-green-600 w-5 h-5" /> Module ID Registration</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><Tag size={12}/> TRX Module ID</label>
                          <div className="flex items-center bg-white border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-all p-1">
                              <Scan size={18} className="text-slate-400 mx-2" />
                              <input type="text" value={trxModuleQr} onChange={(e) => setTrxModuleQr(e.target.value)} className="w-full px-2 py-2 outline-none text-slate-800 font-mono text-sm font-bold" placeholder="Scan TRX..." />
                              {trxModuleQr && <CheckCircle size={18} className="text-green-500 mr-2" />}
                          </div>
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><BatteryCharging size={12}/> PSU Module ID</label>
                          <div className="flex items-center bg-white border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-all p-1">
                              <Scan size={18} className="text-slate-400 mx-2" />
                              <input type="text" value={psuModuleQr} onChange={(e) => setPsuModuleQr(e.target.value)} className="w-full px-2 py-2 outline-none text-slate-800 font-mono text-sm font-bold" placeholder="Scan PSU..." />
                              {psuModuleQr && <CheckCircle size={18} className="text-green-500 mr-2" />}
                          </div>
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1"><Wifi size={12}/> AFM Module ID</label>
                          <div className="flex items-center bg-white border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 transition-all p-1">
                              <Scan size={18} className="text-slate-400 mx-2" />
                              <input type="text" value={afmModuleQr} onChange={(e) => setAfmModuleQr(e.target.value)} className="w-full px-2 py-2 outline-none text-slate-800 font-mono text-sm font-bold" placeholder="Scan AFM..." />
                              {afmModuleQr && <CheckCircle size={18} className="text-green-500 mr-2" />}
                          </div>
                      </div>
                  </div>
              </div>

              {/* SAVE BUTTON */}
              <button onClick={handleSubmit} disabled={isLoading || !trxStatus || !psuStatus} className="w-full py-4 bg-slate-900 text-white font-bold text-lg rounded-xl shadow hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                 <Save className="w-5 h-5" /> {isLoading ? 'Saving...' : 'Save Data'}
              </button>

              {/* EXPORT BUTTON */}
              <div className="border-t pt-4">
                <div className="relative inline-block w-full md:w-auto">
                    <button onClick={() => setShowExportMenu(!showExportMenu)} className="w-full md:w-auto px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow flex items-center justify-center gap-2 text-sm">
                        <FileSpreadsheet size={16} /> Download Debug Data (Excel) {showExportMenu ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                    </button>
                    {showExportMenu && (
                        <div className="absolute bottom-full left-0 mb-2 w-48 bg-white border rounded-lg shadow-xl p-1 z-20">
                            <button onClick={() => exportData('lastHour')} className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded flex gap-2 text-xs"><Clock size={14}/> Last Hour</button>
                            <button onClick={() => exportData('today')} className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded flex gap-2 text-xs"><Calendar size={14}/> Today</button>
                            <button onClick={() => exportData('last7Days')} className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded flex gap-2 text-xs"><History size={14}/> Last 7 Days</button>
                        </div>
                    )}
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};