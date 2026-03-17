import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Toast } from '../components/Toast';
import { 
  Save, Scan, RotateCcw, CheckCircle, XCircle, 
  User, ClipboardCheck, LayoutGrid, Clock, Calendar, 
  ShieldCheck, AlertOctagon
} from 'lucide-react';

export const Station7 = () => {
  // --- STATE ---
  const [lotUnits, setLotUnits] = useState(
    Array(10).fill(null).map(() => ({ uid: '', status: '', data: null, isLoading: false }))
  );
  const [inspectorName, setInspectorName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Refs for the 10 input boxes to handle auto-focus
  const inputRefs = useRef([]);

  useEffect(() => {
    // Focus the first empty row on mount
    inputRefs.current[0]?.focus();
  }, []);

  // --- LOGIC: SCAN & FETCH ---
  const handleScan = async (index, rawValue) => {
    if (!rawValue) return;
    
    // Clean ID logic (same as your other stations)
    let searchId = rawValue.length > 20 ? rawValue.substring(19, 30) : rawValue;

    // Update row state to loading
    const newLot = [...lotUnits];
    newLot[index] = { ...newLot[index], uid: searchId, isLoading: true };
    setLotUnits(newLot);

    try {
      const docSnap = await getDoc(doc(db, 'products', searchId));
      if (docSnap.exists()) {
        const productData = docSnap.data();
        newLot[index] = { 
          ...newLot[index], 
          data: productData, 
          status: 'PASS', // Default to pass on successful scan
          isLoading: false 
        };
        setLotUnits(newLot);
        
        // Auto-focus next input if not at the end
        if (index < 9) {
          inputRefs.current[index + 1]?.focus();
        }
      } else {
        newLot[index] = { ...newLot[index], uid: searchId, data: null, status: 'FAIL', isLoading: false };
        setLotUnits(newLot);
        setToast({ message: `Unit ${searchId} not found in database!`, type: 'error' });
      }
    } catch (e) {
      setToast({ message: 'Error fetching unit', type: 'error' });
    }
  };

  const updateStatus = (index, newStatus) => {
    const newLot = [...lotUnits];
    newLot[index].status = newStatus;
    setLotUnits(newLot);
  };

  const handleReset = () => {
    setLotUnits(Array(10).fill(null).map(() => ({ uid: '', status: '', data: null, isLoading: false })));
    setInspectorName('');
    inputRefs.current[0]?.focus();
  };

  // --- BATCH CALCULATIONS ---
  const scannedCount = lotUnits.filter(u => u.uid !== '').length;
  const allPass = scannedCount === 10 && lotUnits.every(u => u.status === 'PASS');
  const anyFail = lotUnits.some(u => u.status === 'FAIL' && u.uid !== '');

  // --- SAVE TO FIREBASE ---
  const handleSaveBatch = async () => {
    if (scannedCount < 10) {
      setToast({ message: 'Please scan all 10 units first!', type: 'warning' });
      return;
    }
    if (!inspectorName) {
      setToast({ message: 'Please enter your name (Signature)', type: 'warning' });
      return;
    }

    setIsSaving(true);
    try {
      const lotRef = collection(db, 'lots');
      const batchTimestamp = new Date().toISOString();

      // 1. Create a Lot Entry
      await addDoc(lotRef, {
        units: lotUnits.map(u => ({ uid: u.uid, status: u.status })),
        inspector: inspectorName,
        timestamp: serverTimestamp(),
        result: allPass ? 'LOT_PASS' : 'LOT_FAIL'
      });

      // 2. Update individual product logs (Optional but recommended)
      for (const unit of lotUnits) {
        if (unit.uid) {
           await updateDoc(doc(db, 'products', unit.uid), {
             lastLotUpdate: batchTimestamp,
             status: unit.status === 'PASS' ? 'Lot QC Passed' : 'Lot QC Failed'
           });
        }
      }

      setToast({ message: 'Batch Results Saved to Cloud!', type: 'success' });
      setTimeout(handleReset, 1500);
    } catch (e) {
      setToast({ message: 'Save Failed!', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen p-4 bg-slate-100 text-slate-800 font-sans">
      <div className="max-w-5xl mx-auto space-y-4">
        
        {/* HEADER */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black flex items-center gap-2 text-blue-600">
              <LayoutGrid /> STATION 7: Final Lot QC Inspection
            </h2>
            <div className="flex gap-4 mt-2 text-xs font-bold text-slate-500">
               <span className="flex items-center gap-1"><Calendar size={14}/> {new Date().toLocaleDateString()}</span>
               <span className="flex items-center gap-1"><Clock size={14}/> {new Date().toLocaleTimeString()}</span>
            </div>
          </div>
          <button onClick={handleReset} className="p-3 bg-slate-200 rounded-full hover:bg-slate-300 transition-all text-slate-600">
            <RotateCcw size={20} />
          </button>
        </div>

        {/* 10-UNIT GRID TABLE */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-900 text-white text-[10px] uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4 w-16">No.</th>
                <th className="px-6 py-4">Scanner Input</th>
                <th className="px-6 py-4">Serial Number</th>
                <th className="px-6 py-4 text-center">Status Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lotUnits.map((unit, index) => (
                <tr key={index} className={`transition-colors ${unit.uid ? 'bg-blue-50/30' : ''}`}>
                  <td className="px-6 py-3 font-black text-slate-400">{index + 1}</td>
                  <td className="px-6 py-3">
                    <div className="relative">
                      <Scan className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        ref={(el) => (inputRefs.current[index] = el)}
                        type="text"
                        placeholder="Ready for scan..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        onKeyDown={(e) => e.key === 'Enter' && handleScan(index, e.target.value)}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    {unit.isLoading ? (
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <span className="font-mono font-bold text-blue-700 text-base">{unit.uid || '--'}</span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex justify-center gap-2">
                      <button 
                        disabled={!unit.uid}
                        onClick={() => updateStatus(index, 'PASS')}
                        className={`flex items-center gap-1 px-4 py-1.5 rounded-full font-bold text-[10px] transition-all border ${unit.status === 'PASS' ? 'bg-green-600 border-green-600 text-white shadow-lg' : 'bg-white text-slate-300 border-slate-100 hover:border-green-200'}`}
                      >
                        <CheckCircle size={14}/> PASS
                      </button>
                      <button 
                        disabled={!unit.uid}
                        onClick={() => updateStatus(index, 'FAIL')}
                        className={`flex items-center gap-1 px-4 py-1.5 rounded-full font-bold text-[10px] transition-all border ${unit.status === 'FAIL' ? 'bg-red-600 border-red-600 text-white shadow-lg' : 'bg-white text-slate-300 border-slate-100 hover:border-red-200'}`}
                      >
                        <XCircle size={14}/> FAIL
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* BATCH VERDICT & SIGNATURE SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Progress / Status */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
             <div className="flex justify-between items-end mb-2">
                <span className="text-xs font-black text-slate-400 uppercase">Lot Progress</span>
                <span className="text-xl font-black text-blue-600">{scannedCount}/10</span>
             </div>
             <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${scannedCount * 10}%` }}></div>
             </div>

             {allPass && (
               <div className="mt-4 bg-green-100 border-2 border-green-500 p-3 rounded-xl flex items-center gap-3 animate-bounce">
                  <ShieldCheck className="text-green-600 w-8 h-8" />
                  <b className="text-green-700 text-lg uppercase">Lot Verdict: Batch Passed</b>
               </div>
             )}
             {anyFail && (
                <div className="mt-4 bg-red-100 border-2 border-red-500 p-3 rounded-xl flex items-center gap-3">
                  <AlertOctagon className="text-red-600 w-8 h-8" />
                  <b className="text-red-700 text-lg uppercase">Lot Verdict: Batch Contains Fails</b>
                </div>
             )}
          </div>

          {/* Signature & Save */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Inspector Name (Digital Signature)</label>
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-3 gap-2 focus-within:ring-2 focus-within:ring-blue-500">
                <User className="text-slate-400" size={18} />
                <input 
                  type="text" 
                  value={inspectorName}
                  onChange={(e) => setInspectorName(e.target.value)}
                  placeholder="Type your full name..." 
                  className="bg-transparent w-full outline-none font-bold text-slate-700"
                />
              </div>
            </div>

            <button 
              onClick={handleSaveBatch}
              disabled={isSaving || scannedCount < 10}
              className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isSaving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Save />} 
              SAVE COMPLETE LOT RESULTS
            </button>
          </div>

        </div>

      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};