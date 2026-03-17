import { useEffect, useState, useRef } from 'react';

/**
 * Global RFID listener hook
 * Detects RFID scans by monitoring keyboard input:
 * - If >3 characters are typed in <50ms and end with 'Enter', treat it as a SCAN
 */
export const useRFID = (onScan) => {
  const [isActive, setIsActive] = useState(false);
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const onScanRef = useRef(onScan);

  // Keep onScan ref updated
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    // Prevent hydration errors
    if (typeof window === 'undefined') return;

    setIsActive(true);

    const handleKeyPress = (e) => {
      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;

      // Reset buffer if too much time has passed (>50ms)
      if (timeDiff > 50) {
        bufferRef.current = '';
      }

      // Handle Enter key
      if (e.key === 'Enter') {
        if (bufferRef.current.length > 3) {
          // Treat as RFID scan
          const scannedUID = bufferRef.current.trim();
          if (onScanRef.current) {
            onScanRef.current(scannedUID);
          }
          bufferRef.current = '';
          lastKeyTimeRef.current = 0;
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Add character to buffer (ignore modifier keys)
        bufferRef.current = bufferRef.current + e.key;
        lastKeyTimeRef.current = currentTime;
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  return { isActive };
};

