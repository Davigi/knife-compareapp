import { useState, useEffect, useRef } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import * as ZXingLib from "@zxing/library";

export default function ScanModal({ onResult, onClose }) {
  const videoRef    = useRef(null);
  const controlsRef = useRef(null);
  const streamRef   = useRef(null);
  const frameRef    = useRef(null);
  const [status, setStatus] = useState("starting");
  const [found,  setFound]  = useState("");

  const stopAll = () => {
    try { controlsRef.current?.stop(); } catch (e) {}
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  };

  const close   = () => { stopAll(); onClose(); };
  const confirm = () => { stopAll(); onResult(found); };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if ("BarcodeDetector" in window) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
          });
          if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
          streamRef.current = stream;
          videoRef.current.srcObject = stream;
          await new Promise((resolve, reject) => {
            videoRef.current.onloadedmetadata = resolve;
            videoRef.current.onerror = reject;
            videoRef.current.play().catch(reject);
          });
          await new Promise((resolve) => {
            const check = () => {
              if (videoRef.current?.videoWidth > 0) resolve();
              else setTimeout(check, 100);
            };
            check();
          });
          let formats;
          try { formats = await BarcodeDetector.getSupportedFormats(); }
          catch (e) { formats = ["ean_13", "ean_8", "code_128", "code_39", "qr_code", "upc_a"]; }
          const detector = new BarcodeDetector({ formats });
          setStatus("scanning");
          const scan = async () => {
            if (cancelled) return;
            try {
              if (videoRef.current?.readyState >= 2) {
                const codes = await detector.detect(videoRef.current);
                if (codes.length > 0 && !cancelled) {
                  setFound(codes[0].rawValue);
                  setStatus("found");
                  return;
                }
              }
            } catch (e) {}
            frameRef.current = requestAnimationFrame(scan);
          };
          scan();
        } else {
          const hints = new Map();
          hints.set(ZXingLib.DecodeHintType.POSSIBLE_FORMATS, [
            ZXingLib.BarcodeFormat.EAN_13, ZXingLib.BarcodeFormat.EAN_8,
            ZXingLib.BarcodeFormat.CODE_128, ZXingLib.BarcodeFormat.CODE_39,
            ZXingLib.BarcodeFormat.QR_CODE, ZXingLib.BarcodeFormat.UPC_A,
          ]);
          const reader = new BrowserMultiFormatReader(hints);
          setStatus("scanning");
          const controls = await reader.decodeFromConstraints(
            { video: { facingMode: "environment" } },
            videoRef.current,
            (result) => {
              if (cancelled || !result) return;
              setFound(result.getText());
              setStatus("found");
            }
          );
          if (!cancelled) controlsRef.current = controls;
        }
      } catch (e) {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => { cancelled = true; stopAll(); };
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
      zIndex: 200, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        position: "relative", width: "100%", maxWidth: 480,
        overflow: "hidden", marginBottom: 20, borderRadius: 2, backgroundColor: "#000",
      }}>
        <video ref={videoRef} playsInline muted autoPlay style={{ width: "100%", display: "block" }} />
        {status === "scanning" && (
          <div style={{
            position: "absolute", inset: 0, display: "flex",
            alignItems: "center", justifyContent: "center", pointerEvents: "none",
          }}>
            <div style={{
              width: "70%", height: 56, border: "2px solid #ffffff",
              borderRadius: 2, boxShadow: "0 0 0 2000px rgba(0,0,0,0.4)",
            }} />
          </div>
        )}
      </div>

      <div style={{ fontSize: 13, color: "#ffffff", marginBottom: 20, textAlign: "center", letterSpacing: "0.04em", lineHeight: 1.7 }}>
        {status === "starting" && "Starting camera…"}
        {status === "scanning" && "Point the barcode at the frame"}
        {status === "error"    && "Camera not available. Check permissions in Settings."}
        {status === "found"    && (
          <div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.12em" }}>
              Reference found
            </div>
            <div style={{ fontSize: 22, color: "#ffffff", fontWeight: 500, letterSpacing: "0.08em" }}>
              {found}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        {status === "found" && (
          <>
            <button onClick={confirm} style={{
              background: "#ffffff", border: "none", color: "#111111",
              fontSize: 12, fontWeight: 500, letterSpacing: "0.1em",
              padding: "12px 28px", cursor: "pointer", textTransform: "uppercase",
            }}>
              Search "{found}"
            </button>
            <button onClick={() => { setFound(""); setStatus("scanning"); }} style={{
              background: "none", border: "1px solid rgba(255,255,255,0.4)",
              color: "rgba(255,255,255,0.8)", fontSize: 12,
              padding: "12px 20px", cursor: "pointer", textTransform: "uppercase",
            }}>
              Retry
            </button>
          </>
        )}
        <button onClick={close} style={{
          background: "none", border: "1px solid rgba(255,255,255,0.25)",
          color: "rgba(255,255,255,0.5)", fontSize: 12,
          padding: "12px 20px", cursor: "pointer", textTransform: "uppercase",
        }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
