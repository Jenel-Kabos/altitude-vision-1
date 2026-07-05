"use client";
import React from "react";

export default function AuthIllustration({ tagline = "Trouvez votre bien idéal" }) {
  return (
    <div
      className="relative w-full h-full flex flex-col overflow-hidden"
      style={{ background: "linear-gradient(170deg,#060404 0%,#1C1008 55%,#2D1A04 100%)" }}
    >
      {/* SVG Scène */}
      <svg
        viewBox="0 0 560 820"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="skyW" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0"   stopColor="#060404" />
            <stop offset="0.5" stopColor="#1C1008" />
            <stop offset="1"   stopColor="#3A2206" />
          </linearGradient>
          <linearGradient id="towerW" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#201508" />
            <stop offset="1" stopColor="#0C0805" />
          </linearGradient>
          <linearGradient id="glowW" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#C8960C" stopOpacity="0.18" />
            <stop offset="1" stopColor="#C8960C" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0"    stopColor="#C8960C" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#C8960C" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ciel */}
        <rect x="0" y="0" width="560" height="820" fill="url(#skyW)" />

        {/* Lune + halo */}
        <circle cx="440" cy="100" r="60" fill="url(#moonGlow)" />
        <circle cx="440" cy="100" r="42" fill="#C8960C" opacity="0.82" />
        <circle cx="460" cy="85"  r="32" fill="#1A0F05" />

        {/* Étoiles */}
        {[
          [30,40,1.8],[60,18,1.2],[100,55,1.5],[150,28,1],[190,15,2],[230,48,1.2],
          [280,22,1.5],[320,38,1],[350,12,1.8],[390,55,1],[480,35,1.5],[510,18,1.2],
          [540,55,1],[20,120,1],[80,90,1.5],[140,110,1],[200,80,1.8],[260,105,1],
          [330,85,1.2],[410,115,1],[490,90,1.5],[545,110,1],
        ].map(([cx,cy,r],i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="#F0EDE8"
            opacity={0.35 + 0.45 * (i % 3) / 2} />
        ))}

        {/* Tour gauche */}
        <rect x="0"  y="80" width="75" height="740" fill="url(#towerW)" />
        <rect x="10" y="60" width="55" height="25"  fill="#150E06" />
        <rect x="34" y="40" width="6"  height="22"  fill="#2A1B08" rx="2" />
        <circle cx="37" cy="39" r="5" fill="#C8960C" opacity="0.95" />
        {Array.from({length:10}, (_,row) =>
          Array.from({length:3}, (_,col) => {
            const ops = [.7,.5,.4,.6,.3,.7,.5,.4,.6,.3];
            return <rect key={`tgl-${row}-${col}`}
              x={8 + col*22} y={100 + row*22} width="13" height="10" rx="1.5"
              fill="#C8960C" opacity={ops[row] * (col%2===0?1:0.7)} />;
          })
        )}

        {/* Immeuble moyen gauche */}
        <rect x="78" y="160" width="68" height="660" fill="#180F06" />
        {Array.from({length:9}, (_,row) =>
          Array.from({length:3}, (_,col) => (
            <rect key={`ml-${row}-${col}`}
              x={86 + col*20} y={175 + row*24} width="13" height="11" rx="1.5"
              fill="#C8960C" opacity={[.6,.8,.4,.5,.7,.3,.6,.5,.4][row]} />
          ))
        )}

        {/* Tour droite principale */}
        <rect x="435" y="60"  width="90" height="760" fill="url(#towerW)" />
        <rect x="445" y="40"  width="70" height="22"  fill="#150E06" />
        <rect x="477" y="18"  width="6"  height="24"  fill="#2A1B08" rx="2" />
        <circle cx="480" cy="17" r="5.5" fill="#C8960C" opacity="0.95" />
        {Array.from({length:12}, (_,row) =>
          Array.from({length:4}, (_,col) => (
            <rect key={`tr-${row}-${col}`}
              x={443 + col*21} y={80 + row*22} width="14" height="11" rx="1.5"
              fill="#C8960C" opacity={[.8,.5,.7,.6,.4,.8,.5,.7,.6,.8,.4,.6][row]} />
          ))
        )}

        {/* Immeuble moyen droit */}
        <rect x="415" y="185" width="55" height="635" fill="#180F06" />
        {Array.from({length:8}, (_,row) =>
          Array.from({length:2}, (_,col) => (
            <rect key={`mr-${row}-${col}`}
              x={423 + col*24} y={200 + row*25} width="16" height="12" rx="1.5"
              fill="#C8960C" opacity={[.5,.7,.4,.6,.8,.3,.5,.6][row]} />
          ))
        )}

        {/* Villa principale */}
        <rect x="168" y="520" width="224" height="300" fill="#1E1309" />
        <polygon points="150,520 280,440 410,520" fill="#2A1904" />
        <path d="M150,520 L280,440 L410,520" fill="none" stroke="#C8960C" strokeWidth="2" opacity="0.35" />
        <rect x="273" y="434" width="14" height="9" rx="2" fill="#C8960C" opacity="0.9" />
        <rect x="183" y="538" width="48" height="38" rx="4" fill="#C8960C" opacity="0.45" />
        <rect x="206" y="538" width="2"  height="38" fill="#110C05" opacity="0.5" />
        <rect x="183" y="557" width="48" height="2"  fill="#110C05" opacity="0.5" />
        <rect x="329" y="538" width="48" height="38" rx="4" fill="#C8960C" opacity="0.6" />
        <rect x="352" y="538" width="2"  height="38" fill="#110C05" opacity="0.5" />
        <rect x="329" y="557" width="48" height="2"  fill="#110C05" opacity="0.5" />
        <rect x="183" y="595" width="48" height="38" rx="4" fill="#C8960C" opacity="0.3" />
        <rect x="329" y="595" width="48" height="38" rx="4" fill="#C8960C" opacity="0.5" />
        <rect x="248" y="642" width="64" height="178" rx="4" fill="#160E06" />
        <path d="M248,668 Q280,642 312,668" fill="#C8960C" opacity="0.2" />
        <circle cx="306" cy="730" r="5" fill="#C8960C" opacity="0.85" />

        {/* Maison gauche */}
        <rect x="112" y="590" width="75" height="230" fill="#160F07" />
        <polygon points="100,590 150,548 200,590" fill="#251705" />
        <rect x="122" y="608" width="20" height="17" rx="2" fill="#C8960C" opacity="0.5" />
        <rect x="152" y="608" width="20" height="17" rx="2" fill="#C8960C" opacity="0.7" />
        <rect x="130" y="640" width="35" height="180" rx="3" fill="#100A04" />

        {/* Maison droite */}
        <rect x="373" y="600" width="70" height="220" fill="#160F07" />
        <polygon points="362,600 408,558 455,600" fill="#251705" />
        <rect x="382" y="618" width="18" height="16" rx="2" fill="#C8960C" opacity="0.6" />
        <rect x="410" y="618" width="18" height="16" rx="2" fill="#C8960C" opacity="0.4" />
        <rect x="390" y="650" width="32" height="170" rx="3" fill="#100A04" />

        {/* Palmier gauche */}
        <path d="M148,820 Q150,760 156,700" stroke="#3A2810" strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d="M156,700 C130,672 112,680 104,664" stroke="#4A3518" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M156,700 C140,678 128,688 120,678" stroke="#4A3518" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M156,700 C170,672 190,678 196,664" stroke="#4A3518" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M156,700 C175,682 185,694 195,683" stroke="#4A3518" strokeWidth="4" fill="none" strokeLinecap="round" />

        {/* Palmier droit */}
        <path d="M412,820 Q410,758 404,695" stroke="#3A2810" strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d="M404,695 C380,667 360,674 352,659" stroke="#4A3518" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M404,695 C386,672 375,683 366,673" stroke="#4A3518" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M404,695 C422,667 442,673 450,659" stroke="#4A3518" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M404,695 C425,677 432,690 445,679" stroke="#4A3518" strokeWidth="4" fill="none" strokeLinecap="round" />

        {/* Sol + lueur */}
        <rect x="0" y="800" width="560" height="20" fill="#0A0704" />
        <rect x="0" y="780" width="560" height="40" fill="url(#glowW)" />

        {/* Icône clé */}
        <g transform="translate(255,390)">
          <circle cx="0" cy="0" r="14"  fill="none" stroke="#C8960C" strokeWidth="3.5" opacity="0.75" />
          <circle cx="0" cy="0" r="6.5" fill="none" stroke="#C8960C" strokeWidth="3"   opacity="0.75" />
          <rect x="12"  y="-2" width="22" height="4" rx="2" fill="#C8960C" opacity="0.75" />
          <rect x="30"  y="2"  width="4"  height="8" rx="2" fill="#C8960C" opacity="0.75" />
          <rect x="22"  y="2"  width="4"  height="5" rx="2" fill="#C8960C" opacity="0.75" />
        </g>
      </svg>

      {/* Overlay : logo + texte */}
      <div className="relative z-10 flex flex-col h-full px-10 py-12 justify-between pointer-events-none">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <img
            src="/Logo_Altitude_transparent.png"
            alt="Altimmo"
            className="w-12 h-12 object-contain"
          />
          <span className="text-white font-bold text-2xl tracking-wide"
                style={{ fontFamily:"'Cormorant Garamond', Georgia, serif" }}>
            Altimmo
          </span>
        </div>

        {/* Texte bas */}
        <div className="pb-8">
          <p className="text-yellow-400 italic text-lg mb-2 opacity-90"
             style={{ fontFamily:"'Cormorant Garamond', Georgia, serif" }}>
            Congo Brazzaville
          </p>
          <h2 className="text-white text-4xl leading-tight mb-4 font-bold"
              style={{ fontFamily:"'Cormorant Garamond', Georgia, serif",
                       textShadow: "0 2px 12px rgba(0,0,0,0.7)" }}>
            {tagline}
          </h2>
          <div className="flex items-center gap-2 mt-4">
            <span className="w-8 h-0.5 bg-yellow-500 opacity-70 block" />
            <span className="text-white/50 text-sm tracking-widest uppercase"
                  style={{ fontFamily:"'DM Sans', sans-serif" }}>
              Immobilier de confiance
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
