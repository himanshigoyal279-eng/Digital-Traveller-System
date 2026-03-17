import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JsBarcode from 'jsbarcode'; // Import JsBarcode
import { Toast } from '../components/Toast';
import { 
  Save, Scan, RotateCcw, ClipboardCheck, CheckCircle, XCircle, 
  FileText, FileSpreadsheet, Box, Search, Activity, Bug, Microscope, 
  Factory, AlertTriangle, RefreshCw
} from 'lucide-react';

export const Station6 = () => {
  const rawInputRef = useRef(null);
  const canvasRef = useRef(null); // Ref for barcode canvas

  // Core Data
  const [uid, setUid] = useState('');
  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // QC States
  const [qcStatus, setQcStatus] = useState('');
  const [qcFailReason, setQcFailReason] = useState('');
  const [qcRemarks, setQcRemarks] = useState('');

  // Derived State: Check if this unit was already QC checked
  const isUpdateMode = !!product?.qcCheck?.status;

  useEffect(() => { rawInputRef.current?.focus(); }, []);

  // Generate barcode on screen when uid changes
  useEffect(() => {
    if (uid && canvasRef.current) {
        try {
            JsBarcode(canvasRef.current, uid, {
                format: "CODE128",
                displayValue: true,
                fontSize: 14,
                height: 40,
                width: 1.5,
                margin: 0
            });
        } catch (error) {
            console.error("Barcode generation failed", error);
        }
    }
  }, [uid, product]);


  // --- ⏱️ ROBUST TIME CALCULATION HELPER ---
  const calculateTimeTaken = () => {
    // 1. Basic Data Integrity Checks
    if (!product || !product.rcInDate || !product.rcInTime) return '-';
    
    // 2. Determine End Time 
    // If we have a stored QC timestamp, use it.
    const endTimeStr = product.qcCheck?.timestamp;
    if (!endTimeStr) return '-'; // QC not done yet

    // 3. Robust Start Time Parser
    const parseStartDateTime = (dateStr, timeStr) => {
        try {
            // A. Clean the Date (Handle DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD)
            let cleanDate = dateStr.replace(/\//g, '-'); // Turn 28/12/2025 -> 28-12-2025
            const dateParts = cleanDate.split('-');
            
            let yyyy, mm, dd;
            if (dateParts[0].length === 4) {
                // Format: YYYY-MM-DD
                [yyyy, mm, dd] = dateParts;
            } else {
                // Format: DD-MM-YYYY
                [dd, mm, yyyy] = dateParts;
            }

            // B. Clean the Time (Handle "14:30" vs "2:30 PM")
            let [time, modifier] = timeStr.split(' ');
            let [hours, minutes] = time.split(':');
            
            if (hours === '12') hours = '00';
            if (modifier === 'PM' || modifier === 'pm') hours = parseInt(hours, 10) + 12;
            
            // C. Create Date Object
            const d = new Date(yyyy, mm - 1, dd, hours, minutes); // Month is 0-indexed
            return isNaN(d.getTime()) ? null : d;
        } catch (e) {
            console.error("Date Parse Error:", e);
            return null;
        }
    };

    const startTime = parseStartDateTime(product.rcInDate, product.rcInTime);
    const endTime = new Date(endTimeStr);

    // 4. Calculate Difference
    if (!startTime || isNaN(endTime.getTime())) return 'Date Error';

    const diffMs = endTime - startTime;
    if (diffMs < 0) return '0 Hrs 0 Mins'; // QC happened before entry (logic error but handle gracefully)

    const diffHrs = Math.floor(diffMs / 3600000);
    const diffMins = Math.round((diffMs % 3600000) / 60000);

    return `${diffHrs} Hrs ${diffMins} Mins`;
  };

  // --- HANDLERS ---
  const handleRescan = () => {
    if (rawInputRef.current) { rawInputRef.current.value = ""; rawInputRef.current.focus(); }
    setUid(''); setProduct(null); setQcStatus(''); setQcFailReason(''); setQcRemarks('');
    setToast({ message: 'Ready for new unit', type: 'info' });
  };

  const handleSearch = async () => {
    const rawText = rawInputRef.current.value.trim();
    if (!rawText) { setToast({ message: 'Scanner Empty!', type: 'error' }); return; }
    
    let searchId = rawText.length > 20 ? rawText.substring(19, 30) : rawText;
    
    setIsLoading(true);
    try {
      const docSnap = await getDoc(doc(db, 'products', searchId));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProduct(data);
        setUid(searchId);
        
        // Pre-fill QC data if exists
        if (data.qcCheck) {
            setQcStatus(data.qcCheck.status || '');
            setQcFailReason(data.qcCheck.failReason || '');
            setQcRemarks(data.qcCheck.remarks || '');
            setToast({ message: 'Previous QC Found (Update Mode)', type: 'info' });
        } else {
            setToast({ message: 'Digital Traveller Loaded', type: 'success' });
        }
      } else {
        setProduct(null); setToast({ message: 'Unit Not Found', type: 'error' });
      }
    } catch (e) { setToast({ message: e.message, type: 'error' }); } 
    finally { setIsLoading(false); }
  };

  // --- HELPERS ---
  const getVal = (val) => val || '-';
  const getList = (obj) => obj ? Object.keys(obj).join(', ') : 'None';
  
  const formatFailures = (failures) => {
      if (!failures || !Array.isArray(failures) || failures.length === 0) return 'None';
      return failures.map(f => `[${f.id}:${f.desc}]`).join('\n');
  };

  // Detailed Formatter for Station 4 (Loc and PN)
  const formatFailuresDetailed = (failures) => {
    if (!failures || !Array.isArray(failures) || failures.length === 0) return 'None';
    return failures.map(f => `[ID:${f.id} | ${f.desc} | Loc:${f.loc || '-'} | PN:${f.pn || '-'}]`).join('\n');
  };

  const formatTrxFailures = (trx) => {
      if (!trx) return 'None';
      let lines = [];
      if (trx.bscanFailures?.length) lines.push(`BSCAN: ${formatFailuresDetailed(trx.bscanFailures)}`);
      if (trx.paFailures?.length) lines.push(`PA: ${formatFailuresDetailed(trx.paFailures)}`);
      if (trx.faultDesc) lines.push(`Legacy: ${trx.faultDesc}`);
      return lines.length ? lines.join('\n') : 'None';
  };

  const formatDeepFailures = (test) => {
      if (!test) return '-';
      if (test.status === 'PASS') return 'PASS';
      return `FAIL\n${formatFailures(test.failures)}`;
  };

  // --- 📄 PDF GENERATOR ---
  const generatePDF = () => {
    if (!product) return;
    const doc = new jsPDF();

    // Create a canvas to generate barcode image for PDF
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, uid, { format: "CODE128", displayValue: false });
    const barcodeDataUrl = canvas.toDataURL("image/png");


    // Header
    doc.setFillColor(220, 38, 38); 
    doc.rect(0, 0, 210, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("DIGITAL TRAVELLER SHEET", 14, 16);
    doc.setFontSize(10);
    doc.text(`SN: ${uid} | Generated: ${new Date().toLocaleString()}`, 100, 16);

    // Add Barcode to Header
    doc.addImage(barcodeDataUrl, 'PNG', 150, 5, 40, 15);

    const bodyData = [
        // STATION 1
        [{ content: '1. REGISTRATION (RC IN)', colSpan: 4, styles: { fillColor: [230, 240, 255], fontStyle: 'bold' } }],
        ['Product', getVal(product.productNo), 'Family', getVal(product.familyName)],
        ['Customer', getVal(product.customerName), 'Region', getVal(product.regionType)],
        ['Entry Date', getVal(product.rcInDate), 'Entry Time', getVal(product.rcInTime)],
        // Added Time Taken
        ['Engineer', getVal(product.engineerName), 'Time Taken', calculateTimeTaken()],

        // STATION 2
        [{ content: '2. VISUAL INSPECTION', colSpan: 4, styles: { fillColor: [245, 235, 255], fontStyle: 'bold' } }],
        ['Visual Status', getVal(product.visualInspection?.ipStatus), 'Insp Date', getVal(product.visualInspection?.timestamp ? new Date(product.visualInspection.timestamp).toLocaleString() : '-')],
        ['Missing Items', getList(product.visualInspection?.missingItems), 'Mechanical Defects', getList(product.visualInspection?.mechanicalStatus)],

        // STATION 3
        [{ content: '3. RAP & UNIT TEST', colSpan: 4, styles: { fillColor: [255, 245, 230], fontStyle: 'bold' } }],
        ['RAP Status', getVal(product.rapTest?.status), 'RAP Failures', formatFailures(product.rapTest?.failures)],
        ['UNIT Status', getVal(product.unitTest?.status), 'UNIT Failures', formatFailures(product.unitTest?.failures)],
        ['Technician Remarks', { content: getVal(product.technicianRemarks), colSpan: 3 }],

        // STATION 4
        [{ content: '4. DEBUG & MODULES', colSpan: 4, styles: { fillColor: [255, 235, 235], fontStyle: 'bold' } }],
        ['TRX Status', getVal(product.debugValidation?.trx?.status), 'TRX Failures', formatTrxFailures(product.debugValidation?.trx)],
        ['PSU Status', getVal(product.debugValidation?.psu?.status), 'PSU Failures', formatFailuresDetailed(product.debugValidation?.psu?.failures)],
        ['Module QR', getVal(product.moduleQr), 'Debug Remarks', getVal(product.debugRemarks)],

        // STATION 5
        [{ content: '5. DEEP TESTS', colSpan: 4, styles: { fillColor: [235, 255, 255], fontStyle: 'bold' } }],
        ['RAP Test', formatDeepFailures(product.deepTests?.rap), 'OTA Test', formatDeepFailures(product.deepTests?.ota)],
        ['LBTS Test', formatDeepFailures(product.deepTests?.lbts), 'SW Test', formatDeepFailures(product.deepTests?.sw)],
        ['IP Test', formatDeepFailures(product.deepTests?.ip), 'Deep Test Remarks', getVal(product.deepTestRemarks)],

        // STATION 6 (QC)
        [{ content: '6. FINAL QC VERDICT', colSpan: 4, styles: { fillColor: [220, 255, 220], fontStyle: 'bold', halign: 'center' } }],
        ['QC STATUS', { content: qcStatus, styles: { fontStyle: 'bold', textColor: qcStatus === 'PASS' ? [0,128,0] : [255,0,0] } }, 'QC Date', new Date().toLocaleDateString()],
        ['Failure Reason', getVal(qcFailReason), 'QC Remarks', getVal(qcRemarks)],
    ];

    autoTable(doc, {
        startY: 30,
        head: [['Field', 'Value', 'Field', 'Value']],
        body: bodyData,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [60, 60, 60], textColor: 255 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 }, 2: { fontStyle: 'bold', cellWidth: 40 } }
    });

    doc.save(`Traveller_${uid}.pdf`);
    setToast({ message: 'PDF Downloaded!', type: 'success' });
  };

  // --- EXCEL GENERATOR ---
  const generateExcel = () => {
    if (!product) return;
    const joinFailures = (arr) => arr ? arr.map(f => `${f.id}:${f.desc}`).join(' | ') : '';
    const joinFailuresDetailed = (arr) => arr ? arr.map(f => `${f.id}:${f.desc}(Loc:${f.loc || '-'}, PN:${f.pn || '-'})`).join(' | ') : '';

    const flatData = [{
        'UID': uid, 'Product': product.productNo, 'Family': product.familyName, 'Customer': product.customerName,
        'Region': product.regionType, 'Entry Date': product.rcInDate, 'Entry Time': product.rcInTime, 'Engineer': product.engineerName,
        // Time Taken included here
        'Time Taken': calculateTimeTaken(),
        
        'STN2_Status': product.visualInspection?.ipStatus,
        'STN2_Missing': getList(product.visualInspection?.missingItems),
        'STN2_Mech': getList(product.visualInspection?.mechanicalStatus),
        
        'STN3_RAP_Status': product.rapTest?.status, 'STN3_RAP_Fails': joinFailures(product.rapTest?.failures),
        'STN3_UNIT_Status': product.unitTest?.status, 'STN3_UNIT_Fails': joinFailures(product.unitTest?.failures),
        'STN3_Remarks': product.technicianRemarks,

        'STN4_TRX_Status': product.debugValidation?.trx?.status, 
        'STN4_BSCAN_Fails': joinFailuresDetailed(product.debugValidation?.trx?.bscanFailures),
        'STN4_PA_Fails': joinFailuresDetailed(product.debugValidation?.trx?.paFailures),
        'STN4_PSU_Status': product.debugValidation?.psu?.status, 
        'STN4_PSU_Fails': joinFailuresDetailed(product.debugValidation?.psu?.failures),
        'STN4_Module': product.moduleQr, 'STN4_Remarks': product.debugRemarks,

        'STN5_RAP': product.deepTests?.rap?.status, 'STN5_RAP_Fails': joinFailures(product.deepTests?.rap?.failures),
        'STN5_OTA': product.deepTests?.ota?.status, 'STN5_OTA_Fails': joinFailures(product.deepTests?.ota?.failures),
        'STN5_LBTS': product.deepTests?.lbts?.status, 'STN5_LBTS_Fails': joinFailures(product.deepTests?.lbts?.failures),
        'STN5_SW': product.deepTests?.sw?.status, 'STN5_SW_Fails': joinFailures(product.deepTests?.sw?.failures),
        'STN5_IP': product.deepTests?.ip?.status, 'STN5_IP_Fails': joinFailures(product.deepTests?.ip?.failures),
        'STN5_Remarks': product.deepTestRemarks,

        'STN6_QC_Status': qcStatus, 'STN6_FailReason': qcFailReason, 'STN6_Remarks': qcRemarks
    }];

    const ws = XLSX.utils.json_to_sheet(flatData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "FullHistory");
    XLSX.writeFile(wb, `Traveller_${uid}.xlsx`);
    setToast({ message: 'Excel Downloaded!', type: 'success' });
  };

  const handleSubmit = async () => {
    if (!product || !qcStatus) return;
    if (qcStatus === 'FAIL' && !qcFailReason) { setToast({message:'Reason required for Fail', type:'error'}); return; }
    
    setIsLoading(true);
    try {
      const finalStatus = qcStatus === 'PASS' ? 'QC Passed' : 'QC Failed';
      const timestamp = new Date().toISOString(); // Capture exact time

      await updateDoc(doc(db, 'products', uid), {
        status: finalStatus,
        qcCheck: { status: qcStatus, failReason: qcFailReason, remarks: qcRemarks, timestamp: timestamp },
        logs: [...(product.logs || []), { action: `QC ${isUpdateMode ? 'Updated' : 'Set'}: ${qcStatus}`, timestamp: new Date() }]
      });

      // Update local state IMMEDIATELY so time shows up
      setProduct(prev => ({
        ...prev,
        status: finalStatus,
        qcCheck: { status: qcStatus, failReason: qcFailReason, remarks: qcRemarks, timestamp: timestamp }
      }));

      setToast({ message: isUpdateMode ? 'QC Updated Successfully!' : 'QC Saved Successfully!', type: 'success' });
    } catch (e) { setToast({ message: 'Save Error', type: 'error' }); } 
    finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-screen p-4 bg-slate-50 text-slate-800 text-xs">
      <div className="w-full max-w-[98%] mx-auto">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b-2 border-green-600 pb-2 w-fit">
          <Factory className="w-6 h-6 text-green-600" /> Station 6: Final QC & Traveller
        </h2>

        <div className="bg-white rounded-xl p-4 shadow-lg border border-slate-200">
          
          {/* 1. SCANNER BAR */}
          <div className="flex gap-4 mb-6 bg-slate-100 p-3 rounded-lg border border-slate-300">
             <div className="flex-1 bg-slate-900 p-2 rounded-lg flex items-center gap-3 cursor-text" onClick={() => rawInputRef.current?.focus()}>
                <Scan className="text-green-400 animate-pulse w-5 h-5" />
                <input ref={rawInputRef} className="w-full bg-transparent text-green-400 font-mono outline-none text-base font-bold" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder="Scan Final Unit..." autoComplete="off" />
             </div>
             <button onClick={handleSearch} className="bg-blue-600 text-white px-6 rounded-lg font-bold shadow">Search</button>
             <button onClick={handleRescan} className="bg-slate-700 text-white px-4 rounded-lg shadow"><RotateCcw size={18} /></button>
          </div>

          {product && (
            <div className="animate-in fade-in duration-300">
                
                {/* --- 2. DIGITAL TRAVELLER GRID (ULTRA DETAILED) --- */}
                <div className="mb-6 space-y-4">
                    <h3 className="text-sm font-bold text-slate-700 uppercase flex items-center gap-2 border-b pb-2">
                        <FileText size={16}/> Full Lifecycle History
                    </h3>
                    
                    {/* Station 1: Registration */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <h4 className="text-blue-800 font-bold mb-2 flex items-center gap-2"><Box size={14}/> 1. REGISTRATION</h4>
                        {/* Expanded grid to 8 cols to fit Barcode and Time Taken */}
                        <div className="grid grid-cols-2 md:grid-cols-8 gap-4 text-xs">
                            <div><span className="text-slate-400 block">Serial No</span><span className="font-mono font-bold">{uid}</span></div>
                            <div><span className="text-slate-400 block">Product</span><span className="font-bold">{product.productNo}</span></div>
                            <div><span className="text-slate-400 block">Family</span><span className="font-bold">{product.familyName}</span></div>
                            <div><span className="text-slate-400 block">Customer</span><span className="font-bold">{product.customerName}</span></div>
                            <div><span className="text-slate-400 block">Region</span><span className="font-bold">{product.regionType}</span></div>
                            <div><span className="text-slate-400 block">Entry Date</span><span className="font-bold">{product.rcInDate}</span></div>
                            
                            {/* Time Taken Column (Now with Logic) */}
                            <div>
                                <span className="text-slate-400 block">Time Taken</span>
                                <span className="font-bold text-blue-700 font-mono">
                                    {calculateTimeTaken()}
                                </span>
                            </div>

                            {/* Barcode Display */}
                            <div className="flex flex-col items-center justify-center bg-white p-1 rounded border">
                                <canvas ref={canvasRef} className="max-w-full h-8"></canvas>
                            </div>
                        </div>
                    </div>

                    {/* Station 2: Visual */}
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                        <h4 className="text-purple-800 font-bold mb-2 flex items-center gap-2"><Search size={14}/> 2. VISUAL INSPECTION</h4>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                            <div>
                                <span className="text-slate-400 block">Verdict</span>
                                <span className={`font-bold ${product.visualInspection?.ipStatus==='FAIL'?'text-red-600':'text-green-700'}`}>
                                    {product.visualInspection?.ipStatus || 'Pending'}
                                </span>
                            </div>
                            <div><span className="text-slate-400 block">Date</span><span className="font-bold">{product.visualInspection?.timestamp ? new Date(product.visualInspection.timestamp).toLocaleString() : '-'}</span></div>
                            <div className="md:col-span-2">
                                <span className="text-slate-400 block">Defects Found:</span>
                                <span className="font-mono text-red-600">
                                    {[getList(product.visualInspection?.missingItems), getList(product.visualInspection?.mechanicalStatus)].filter(s=>s!=='None').join(', ') || 'None'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Station 3: RAP & Unit */}
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                        <h4 className="text-orange-800 font-bold mb-2 flex items-center gap-2"><Activity size={14}/> 3. RAP & UNIT TEST</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div className="bg-white p-2 rounded border border-orange-100">
                                <div className="flex justify-between mb-1"><span>RAP Status:</span><b className={product.rapTest?.status==='FAIL'?'text-red-600':'text-green-700'}>{product.rapTest?.status}</b></div>
                                {product.rapTest?.status==='FAIL' && <pre className="text-[10px] text-red-600 bg-red-50 p-1 rounded whitespace-pre-wrap">{formatFailures(product.rapTest?.failures)}</pre>}
                            </div>
                            <div className="bg-white p-2 rounded border border-orange-100">
                                <div className="flex justify-between mb-1"><span>UNIT Status:</span><b className={product.unitTest?.status==='FAIL'?'text-red-600':'text-green-700'}>{product.unitTest?.status}</b></div>
                                {product.unitTest?.status==='FAIL' && <pre className="text-[10px] text-red-600 bg-red-50 p-1 rounded whitespace-pre-wrap">{formatFailures(product.unitTest?.failures)}</pre>}
                            </div>
                        </div>
                        {product.technicianRemarks && <div className="mt-2 text-xs italic text-slate-600 border-t border-orange-200 pt-1">Note: {product.technicianRemarks}</div>}
                    </div>

                    {/* Station 4: Debug */}
                    <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                        <h4 className="text-rose-800 font-bold mb-2 flex items-center gap-2"><Bug size={14}/> 4. DEBUG & MODULES</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div className="bg-white p-2 rounded border border-rose-100">
                                <div className="flex justify-between mb-1"><span>TRX Status:</span><b className={product.debugValidation?.trx?.status==='FAIL'?'text-red-600':'text-green-700'}>{product.debugValidation?.trx?.status}</b></div>
                                {product.debugValidation?.trx?.status==='FAIL' && <pre className="text-[10px] text-red-600 bg-red-50 p-1 rounded whitespace-pre-wrap">{formatTrxFailures(product.debugValidation?.trx)}</pre>}
                            </div>
                            <div className="bg-white p-2 rounded border border-rose-100">
                                <div className="flex justify-between mb-1"><span>PSU Status:</span><b className={product.debugValidation?.psu?.status==='FAIL'?'text-red-600':'text-green-700'}>{product.debugValidation?.psu?.status}</b></div>
                                {product.debugValidation?.psu?.status==='FAIL' && <pre className="text-[10px] text-red-600 bg-red-50 p-1 rounded whitespace-pre-wrap">{formatFailuresDetailed(product.debugValidation?.psu?.failures)}</pre>}
                            </div>
                        </div>
                        <div className="mt-2 flex gap-4 text-xs">
                            <span>Module QR: <b className="font-mono">{product.moduleQr || '-'}</b></span>
                            <span>Remarks: <i>{product.debugRemarks || '-'}</i></span>
                        </div>
                    </div>

                    {/* Station 5: Deep Tests */}
                    <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3">
                        <h4 className="text-cyan-800 font-bold mb-2 flex items-center gap-2"><Microscope size={14}/> 5. DEEP TESTS</h4>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center text-xs mb-2">
                            {['rap','ota','lbts','sw','ip'].map(k => (
                                <div key={k} className={`p-1 rounded border ${product.deepTests?.[k]?.status==='FAIL'?'bg-red-100 border-red-300 text-red-700':'bg-white border-cyan-100 text-green-700'}`}>
                                    {k.toUpperCase()}: <b>{product.deepTests?.[k]?.status || '-'}</b>
                                </div>
                            ))}
                        </div>
                        {/* Show Deep Test Failures */}
                        <div className="bg-white p-2 rounded border border-cyan-100 max-h-24 overflow-y-auto text-[10px]">
                            {Object.entries(product.deepTests || {}).map(([k,v]) => (
                                v.status === 'FAIL' ? (
                                    <div key={k} className="mb-1 border-b border-slate-100 pb-1">
                                        <b className="text-red-600">{k.toUpperCase()} FAILS:</b>
                                        <pre className="text-slate-600 ml-2 whitespace-pre-wrap">{formatFailures(v.failures)}</pre>
                                    </div>
                                ) : null
                            ))}
                            {product.deepTestStatus === 'Deep Test Passed' && <div className="text-green-600 text-center font-bold">ALL DEEP TESTS PASSED SUCCESS</div>}
                        </div>
                        {product.deepTestRemarks && <div className="mt-2 text-xs italic text-slate-600 border-t border-cyan-200 pt-1">Note: {product.deepTestRemarks}</div>}
                    </div>

                </div>

                {/* --- 3. QC ACTION AREA --- */}
                <div className={`p-4 rounded-xl border shadow-sm transition-colors ${isUpdateMode ? 'bg-amber-50 border-amber-300' : 'bg-green-50 border-green-200'}`}>
                    <h3 className={`text-sm font-bold uppercase mb-3 flex items-center gap-2 ${isUpdateMode ? 'text-amber-800' : 'text-green-800'}`}>
                        {isUpdateMode ? <><AlertTriangle size={16}/> Update Quality Decision</> : <><ClipboardCheck size={16}/> Final Quality Decision</>}
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        <div className="space-y-3">
                            <div className="flex gap-4">
                                <button onClick={() => setQcStatus('PASS')} className={`flex-1 py-3 rounded-lg font-bold border-2 transition-all ${qcStatus === 'PASS' ? 'bg-green-600 border-green-700 text-white shadow-lg scale-105' : 'bg-white text-slate-400 hover:border-green-300'}`}>
                                    <CheckCircle className="inline mr-2 w-4 h-4"/> PASS
                                </button>
                                <button onClick={() => setQcStatus('FAIL')} className={`flex-1 py-3 rounded-lg font-bold border-2 transition-all ${qcStatus === 'FAIL' ? 'bg-red-600 border-red-700 text-white shadow-lg scale-105' : 'bg-white text-slate-400 hover:border-red-300'}`}>
                                    <XCircle className="inline mr-2 w-4 h-4"/> FAIL
                                </button>
                            </div>
                            
                            {/* Update Button */}
                            <button onClick={handleSubmit} disabled={isLoading || !qcStatus} className={`w-full py-2.5 font-bold rounded-xl shadow text-white flex justify-center items-center gap-2 disabled:opacity-50 transition-colors ${isUpdateMode ? 'bg-amber-600 hover:bg-amber-700' : 'bg-slate-900 hover:bg-slate-800'}`}>
                                {isLoading ? 'Processing...' : (
                                    isUpdateMode ? <><RefreshCw size={16}/> Update QC Decision</> : <><Save size={16}/> Confirm QC Decision</>
                                )}
                            </button>
                            
                            {isUpdateMode && <p className="text-[10px] text-center text-amber-700 font-bold">⚠ Note: This unit was already QC checked. You are updating the status.</p>}
                        </div>

                        <div className="space-y-2">
                            {qcStatus === 'FAIL' && (
                                <div className="animate-in fade-in">
                                    <label className="text-red-700 font-bold text-[10px] uppercase">Failure Reason</label>
                                    <select value={qcFailReason} onChange={(e) => setQcFailReason(e.target.value)} className="w-full p-2 rounded border border-red-300 bg-white mb-2 text-xs">
                                        <option value="">-- Select Reason --</option>
                                        <option>Cosmetic Damage</option><option>Missing Labels</option><option>Functional Failure</option><option>Loose Parts</option>
                                    </select>
                                </div>
                            )}
                            <label className="text-slate-500 font-bold text-[10px] uppercase">Remarks</label>
                            <textarea rows="2" value={qcRemarks} onChange={(e) => setQcRemarks(e.target.value)} className="w-full p-2 rounded border border-slate-300 text-xs" placeholder="Optional notes..."></textarea>
                        </div>
                    </div>

                    {/* --- 4. DOWNLOAD BUTTONS --- */}
                    {(product.qcCheck?.status || qcStatus) && (
                        <div className="mt-4 pt-3 border-t border-slate-200 flex gap-4 animate-in slide-in-from-bottom-2">
                            <button onClick={generateExcel} className="flex-1 py-2.5 bg-white border-2 border-green-600 text-green-700 font-bold rounded-xl hover:bg-green-50 flex justify-center items-center gap-2 text-xs">
                                <FileSpreadsheet size={16}/> Download Excel Data
                            </button>
                            <button onClick={generatePDF} className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 flex justify-center items-center gap-2 shadow-lg text-xs">
                                <FileText size={16}/> Download PDF Traveller
                            </button>
                        </div>
                    )}
                </div>

            </div>
          )}

        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};