'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface QrScannerProps {
  onScan: (token: string) => void
  isActive: boolean
}

export default function QrScanner({ onScan, isActive }: QrScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  const lastScanRef = useRef<string>('')
  const lastScanTimeRef = useRef<number>(0)

  const startScanner = useCallback(async () => {
    if (!containerRef.current || scannerRef.current) return

    try {
      const scanner = new Html5Qrcode('qr-reader')
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decodedText) => {
          const now = Date.now()
          // Debounce: prevent duplicate scans within 3 seconds
          if (decodedText === lastScanRef.current && now - lastScanTimeRef.current < 3000) return
          lastScanRef.current = decodedText
          lastScanTimeRef.current = now
          onScan(decodedText)
        },
        () => {} // ignore failure (continuous scanning)
      )
      setCameraError(null)
    } catch (err) {
      console.error('Camera error:', err)
      setCameraError(
        'Kamera tidak tersedia. Pastikan izin kamera diaktifkan dan tidak digunakan aplikasi lain.'
      )
    }
  }, [onScan])

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
        scannerRef.current.clear()
      } catch {
        // ignore
      }
      scannerRef.current = null
    }
  }, [])

  useEffect(() => {
    setIsMounted(true)
    return () => {
      setIsMounted(false)
      stopScanner()
    }
  }, [stopScanner])

  useEffect(() => {
    if (!isMounted) return
    if (isActive) {
      startScanner()
    } else {
      stopScanner()
    }
  }, [isActive, isMounted, startScanner, stopScanner])

  if (cameraError) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-red-500/30 bg-red-950/20 p-8 text-center">
        <p className="text-red-400 text-sm mb-2">⚠️ Kamera Tidak Tersedia</p>
        <p className="text-slate-500 text-xs">{cameraError}</p>
        <button
          onClick={() => { setCameraError(null); startScanner() }}
          className="mt-4 text-xs text-blue-400 hover:text-blue-300 underline"
        >
          Coba Lagi
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-2xl border border-slate-700 bg-black">
      <div id="qr-reader" className="w-full" />
      <style jsx global>{`
        #qr-reader video { border-radius: 1rem !important; }
        #qr-reader__scan_region { border-radius: 0.5rem; }
        #qr-reader__dashboard { display: none !important; }
        #qr-reader img[alt="Info icon"] { display: none !important; }
        #qr-reader__dashboard_section_csr { display: none !important; }
        #qr-reader__dashboard_section_swaplink { display: none !important; }
      `}</style>
    </div>
  )
}
