"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import logo from "@/public/yoton_logo.png";

export const SPLASH_STORAGE_KEY = "yoton_splash";

const PARTICLES = [
  { size: 5, x: 12, y: 18, delay: 0,    dur: 6  },
  { size: 3, x: 80, y: 12, delay: 0.8,  dur: 7  },
  { size: 7, x: 88, y: 72, delay: 1.4,  dur: 5  },
  { size: 4, x: 6,  y: 68, delay: 0.3,  dur: 8  },
  { size: 3, x: 50, y: 8,  delay: 2,    dur: 6  },
  { size: 6, x: 92, y: 38, delay: 0.6,  dur: 7  },
  { size: 4, x: 20, y: 85, delay: 1.8,  dur: 6  },
  { size: 3, x: 68, y: 90, delay: 1.1,  dur: 9  },
  { size: 5, x: 38, y: 5,  delay: 2.3,  dur: 7  },
  { size: 3, x: 75, y: 55, delay: 0.4,  dur: 8  },
];

// Simple ECG path: flat → spike up → spike down → flat → blip → flat
const ECG_PATH = "M0,30 L60,30 L70,30 L80,5 L90,55 L100,30 L115,30 L125,22 L130,30 L300,30";

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    let alreadyShown = false;
    try { alreadyShown = !!sessionStorage.getItem(SPLASH_STORAGE_KEY); } catch {}

    if (alreadyShown) { setVisible(false); return; }

    const fadeTimer = setTimeout(() => setFading(true), 2400);
    const hideTimer = setTimeout(() => {
      setVisible(false);
      try { sessionStorage.setItem(SPLASH_STORAGE_KEY, "1"); } catch {}
    }, 3000);

    return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer); };
  }, []);

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes splashBg {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes splashLogoIn {
          0%   { opacity: 0; transform: scale(0.5) rotate(-8deg); }
          60%  { opacity: 1; transform: scale(1.1) rotate(3deg); }
          80%  { transform: scale(0.95) rotate(-1deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes splashTitleIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes splashSubIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 0.7; transform: translateY(0); }
        }
        @keyframes splashRing {
          0%   { transform: scale(0.8); opacity: 0.5; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes splashFloat {
          0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0.25; }
          33%       { transform: translateY(-18px) translateX(8px); opacity: 0.5; }
          66%       { transform: translateY(-8px) translateX(-12px); opacity: 0.3; }
        }
        @keyframes splashEcg {
          0%   { stroke-dashoffset: 400; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes splashEcgFade {
          0%, 60% { opacity: 1; }
          100%    { opacity: 0; }
        }
        @keyframes splashFadeOut {
          to { opacity: 0; transform: scale(1.05); }
        }
      `}</style>

      <div
        id="yoton-splash"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1e3a8a, #2563eb, #1d4ed8, #3b82f6, #1e40af)",
          backgroundSize: "300% 300%",
          animation: fading
            ? "splashFadeOut 0.6s ease forwards"
            : "splashBg 8s ease infinite",
          overflow: "hidden",
        }}
      >
        {/* Floating particles */}
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.4)",
              animation: `splashFloat ${p.dur}s ${p.delay}s ease-in-out infinite`,
            }}
          />
        ))}

        {/* Logo area with pulse rings */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "24px" }}>
          {/* Rings */}
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                position: "absolute",
                width: 120,
                height: 120,
                borderRadius: "36px",
                border: "2px solid rgba(255,255,255,0.3)",
                animation: `splashRing 2.4s ${i * 0.8}s ease-out infinite`,
              }}
            />
          ))}

          {/* Logo box */}
          <div
            style={{
              background: "rgba(255,255,255,0.18)",
              borderRadius: "28px",
              padding: "22px",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.3)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
              animation: "splashLogoIn 0.7s cubic-bezier(0.34,1.56,0.64,1) both",
              position: "relative",
              zIndex: 1,
            }}
          >
            <Image src={logo} alt="Yoton" width={80} height={80} style={{ objectFit: "contain", display: "block" }} priority />
          </div>
        </div>

        {/* App name */}
        <p
          style={{
            color: "#fff",
            fontSize: "36px",
            fontWeight: 800,
            letterSpacing: "-0.5px",
            margin: 0,
            animation: "splashTitleIn 0.5s 0.55s ease both",
            textShadow: "0 2px 12px rgba(0,0,0,0.2)",
          }}
        >
          Yoton
        </p>

        {/* Subtitle */}
        <p
          style={{
            color: "rgba(255,255,255,0.7)",
            fontSize: "13px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginTop: "6px",
            animation: "splashSubIn 0.5s 0.85s ease both",
          }}
        >
          Electronic Health Record
        </p>

        {/* ECG strip */}
        <div
          style={{
            position: "absolute",
            bottom: "48px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "260px",
            animation: "splashEcgFade 2.4s 0.3s ease forwards",
          }}
        >
          <svg viewBox="0 0 300 60" width="260" height="60" fill="none">
            <path
              d={ECG_PATH}
              stroke="rgba(255,255,255,0.65)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="400"
              style={{ animation: "splashEcg 1.4s 0.3s ease both" }}
            />
          </svg>
        </div>

      </div>
    </>
  );
}
