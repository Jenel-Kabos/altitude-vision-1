import { ImageResponse } from 'next/og';

export const size        = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt         = 'Mila Events — Le meilleur événement de Brazzaville, c\'est le vôtre';

export default function Image() {
  const RED = '#D42B2B';

  return new ImageResponse(
    (
      <div style={{ display:'flex', width:'1200px', height:'630px', background:'#0A0C0F' }}>

        {/* Background gradient — red tint left */}
        <div style={{ display:'flex', position:'absolute', inset:'0', background:'linear-gradient(130deg,#1A0808 0%,#0A0C0F 60%)' }} />

        {/* Top red accent bar */}
        <div style={{ display:'flex', position:'absolute', top:0, left:0, right:0, height:'5px', background:RED }} />

        {/* Left vertical accent */}
        <div style={{ display:'flex', position:'absolute', top:'56px', left:0, width:'4px', height:'518px', background:`linear-gradient(to bottom,${RED},transparent)` }} />

        {/* Decorative ring top-right */}
        <div style={{ display:'flex', position:'absolute', top:'-80px', right:'-80px', width:'300px', height:'300px', borderRadius:'50%', border:'1px solid rgba(212,43,43,0.12)' }} />
        <div style={{ display:'flex', position:'absolute', top:'-20px', right:'-20px', width:'180px', height:'180px', borderRadius:'50%', border:'1px solid rgba(212,43,43,0.07)' }} />

        {/* Content */}
        <div style={{ display:'flex', flexDirection:'column', flex:1, padding:'56px 80px 48px 96px', zIndex:1 }}>

          {/* Brand + pole tag row */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'44px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'44px', height:'44px', borderRadius:'10px', background:'linear-gradient(135deg,#A0671A,#C8960C)' }}>
                <span style={{ color:'#fff', fontSize:'16px', fontWeight:700 }}>AV</span>
              </div>
              <span style={{ color:'rgba(232,228,220,0.5)', fontSize:'13px', fontWeight:400, letterSpacing:'0.20em', textTransform:'uppercase' }}>ALTITUDE-VISION</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'6px 16px', borderRadius:'40px', border:'1px solid rgba(212,43,43,0.25)', background:'rgba(212,43,43,0.08)' }}>
              <span style={{ color:RED, fontSize:'11px', letterSpacing:'0.20em', textTransform:'uppercase', fontWeight:500 }}>Mila Events — Événementiel</span>
            </div>
          </div>

          {/* Eyebrow */}
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px' }}>
            <div style={{ display:'flex', width:'18px', height:'1px', background:RED }} />
            <span style={{ color:RED, fontSize:'11px', letterSpacing:'0.22em', textTransform:'uppercase', fontWeight:500 }}>Mariages · Galas · Séminaires</span>
          </div>

          {/* Main headline */}
          <div style={{ display:'flex', flexDirection:'column', marginBottom:'20px' }}>
            <span style={{ color:'#E8E4DC', fontSize:'58px', fontWeight:300, lineHeight:1.08, letterSpacing:'-0.02em' }}>Le meilleur événement</span>
            <span style={{ color:'#E8E4DC', fontSize:'58px', fontWeight:300, lineHeight:1.08, letterSpacing:'-0.02em' }}>
              {'de Brazzaville, '}<span style={{ color:RED }}>c'est le vôtre</span>
            </span>
          </div>

          {/* Divider */}
          <div style={{ display:'flex', height:'1px', width:'72px', background:'rgba(212,43,43,0.45)', marginBottom:'18px' }} />

          {/* Subtitle */}
          <div style={{ display:'flex', color:'rgba(232,228,220,0.40)', fontSize:'20px', fontWeight:300, lineHeight:1.5, marginBottom:'auto' }}>
            Du premier appel au dernier applaudissement — nous gérons chaque détail.
          </div>

          {/* Bottom bar */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:'18px', borderTop:'1px solid rgba(232,228,220,0.06)' }}>
            <div style={{ display:'flex', gap:'24px' }}>
              {[['80+','Événements livrés'], ['5+','Années au Congo']].map(([n,l]) => (
                <div key={n} style={{ display:'flex', flexDirection:'column' }}>
                  <span style={{ color:RED, fontSize:'26px', fontWeight:700, lineHeight:1 }}>{n}</span>
                  <span style={{ color:'rgba(232,228,220,0.28)', fontSize:'11px', letterSpacing:'0.10em', textTransform:'uppercase' }}>{l}</span>
                </div>
              ))}
            </div>
            <span style={{ color:'rgba(212,43,43,0.45)', fontSize:'13px' }}>altitudevision.agency</span>
          </div>
        </div>
      </div>
    ),
    { width:1200, height:630 }
  );
}
