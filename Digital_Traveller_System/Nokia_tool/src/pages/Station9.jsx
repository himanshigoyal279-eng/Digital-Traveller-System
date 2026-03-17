import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { Toast } from '../components/Toast';
import { Trash2, AlertTriangle, Scan, RotateCcw, Scissors, CheckCircle, AlertCircle, Box, Truck } from 'lucide-react';

export const Station9 = () => { // Renamed to Station8
  const rawInputRef = useRef(null);

  // Core Data
  const [uid, setUid] = useState('');
  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { rawInputRef.current?.focus(); }, []);

  // --- Handlers ---
  const handleRescan = () => {
    if (rawInputRef.current) { rawInputRef.current.value = ""; rawInputRef.current.focus(); }
    setUid(''); setProduct(null);
    setToast({ message: 'Ready for new scan', type: 'info' });
  };

  const handleExtractAndSearch = async () => {
    const rawText = rawInputRef.current.value;
    if (!rawText) { setToast({ message: 'Scan empty!', type: 'error' }); return; }
    if (rawText.length > 20) {
      const extractedCode = rawText.substring(19, 30);
      setUid(extractedCode);
      await fetchProduct(extractedCode);
    } else { setToast({ message: 'Code too short!', type: 'error' }); }
  };

  const fetchProduct = async (searchId) => {
    setIsLoading(true);
    try {
      const docRef = doc(db, 'products', searchId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProduct(docSnap.data());
        setToast({ message: 'Product found!', type: 'success' });
      } else {
        setProduct(null); setToast({ message: 'Product Not Found', type: 'error' });
      }
    } catch (error) { setToast({ message: 'Error: ' + error.message, type: 'error' }); } 
    finally { setIsLoading(false); }
  };

  const handleDetach = async () => {
    if (!product) return;
    
    // Check Logic: Only allow if QC Passed (or customize as needed)
    if (!product.status?.toLowerCase().includes('passed')) {
        if (!confirm('Warning: This product has NOT passed QC. Do you still want to detach?')) return;
    } else {
        if (!confirm('Are you sure you want to remove this UID? This action cannot be undone.')) return;
    }

    setIsLoading(true);
    try {
      await deleteDoc(doc(db, 'products', uid));
      setToast({ message: 'UID Removed Successfully!', type: 'success' });
      handleRescan();
    } catch (error) { setToast({ message: 'Error: ' + error.message, type: 'error' }); } 
    finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-screen p-6 bg-slate-50 text-slate-800">
      <div className="w-full max-w-[95%] mx-auto">
        <h2 className="text-3xl font-bold mb-6 text-slate-800 flex items-center gap-3 border-b-2 border-red-600 pb-4 w-fit">
          <Truck className="w-8 h-8 text-red-600" /> Station 8: Detach / Reset
        </h2>

        <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200">
          
          {/* Scanner */}
          <div className="flex flex-col md:flex-row gap-6 mb-8 items-stretch">
            <div className="flex-1 bg-slate-900 p-5 rounded-xl border border-slate-700 shadow-inner group cursor-text" onClick={() => rawInputRef.current?.focus()}>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs uppercase font-bold text-blue-400 flex items-center gap-2 tracking-wider"><Scan size={16} /> Step 1: Raw Scanner Input</label>
                <button onClick={handleRescan} className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-full transition-all active:scale-90"><RotateCcw size={16} /></button>
              </div>
              <input ref={rawInputRef} type="text" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleExtractAndSearch()} className="w-full bg-transparent text-green-400 font-mono text-sm focus:outline-none placeholder-slate-600 tracking-widest h-8" placeholder="Click & Scan..." autoComplete="off" />
            </div>
            <div className="flex items-center">
                <button onClick={handleExtractAndSearch} className="h-full bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 rounded-xl shadow-lg border-2 border-white flex flex-col justify-center items-center gap-2 transition-transform active:scale-95 hover:shadow-blue-500/30"><Scissors className="w-6 h-6" /> <span>Search</span></button>
            </div>
          </div>

          {product && (
            <div className="animate-in fade-in space-y-8">
                
                {/* Product History Summary */}
                <div className="bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm">
                    <h3 className="text-xs font-bold text-red-800 uppercase tracking-wide flex items-center gap-2 mb-3"><Box size={14} /> Product Summary (Review Before Delete)</h3>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                        <div><span className="block text-xs text-slate-500">Serial No</span><span className="font-mono font-bold text-slate-900">{uid}</span></div>
                        <div><span className="block text-xs text-slate-500">Product No</span><span className="font-bold">{product.productNo || '-'}</span></div>
                        <div><span className="block text-xs text-slate-500">Visual</span><span className="font-bold">{product.visualInspection?.ipStatus || '-'}</span></div>
                        <div><span className="block text-xs text-slate-500">RAP Status</span><span className="font-bold">{product.rapTest?.status || '-'}</span></div>
                        <div><span className="block text-xs text-slate-500">QC Status</span><span className={`font-bold ${product.qcCheck?.status === 'PASS' ? 'text-green-600' : 'text-red-600'}`}>{product.qcCheck?.status || '-'}</span></div>
                        <div><span className="block text-xs text-slate-500">Final Status</span><span className="font-bold text-blue-600">{product.status || '-'}</span></div>
                    </div>
                </div>

                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-red-200 rounded-2xl bg-red-50/30">
                    <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
                    <h3 className="text-2xl font-bold text-red-700 mb-2">Ready to Detach?</h3>
                    <p className="text-slate-500 mb-8 text-center max-w-md">
                        This action will <strong>permanently delete</strong> this product record from the database. The Serial Number (UID) will be free to register again.
                    </p>

                    <button 
                        onClick={handleDetach} 
                        disabled={isLoading} 
                        className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-red-500/30 transition-all transform hover:-translate-y-1 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Trash2 className="w-6 h-6" /> 
                        {isLoading ? 'Detaching...' : 'CONFIRM DETACH & RESET'}
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