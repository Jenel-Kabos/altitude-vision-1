import { ImageResponse } from 'next/og';

export const size        = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt         = 'Altitude-Vision — Immobilier, Événements & Communication à Brazzaville';

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ display:'flex', width:'1200px', height:'630px', background:'#0A0C0F' }}>

        {/* Background gradient */}
        <div style={{ display:'flex', position:'absolute', inset:'0', background:'linear-gradient(130deg,#0F1D2E 0%,#0A0C0F 55%)' }} />

        {/* Top 3-pole accent bar */}
        <div style={{ display:'flex', position:'absolute', top:0, left:0, right:0, height:'5px' }}>
          <div style={{ display:'flex', flex:1, background:'#2E7BB5' }} />
          <div style={{ display:'flex', flex:1, background:'#D42B2B' }} />
          <div style={{ display:'flex', flex:1, background:'#C8960C' }} />
        </div>

        {/* Decorative ring top-right */}
        <div style={{ display:'flex', position:'absolute', top:'-80px', right:'-80px', width:'320px', height:'320px', borderRadius:'50%', border:'1px solid rgba(200,135,42,0.10)' }} />
        <div style={{ display:'flex', position:'absolute', top:'-30px', right:'-30px', width:'200px', height:'200px', borderRadius:'50%', border:'1px solid rgba(200,135,42,0.06)' }} />

        {/* Content */}
        <div style={{ display:'flex', flexDirection:'column', flex:1, padding:'56px 80px 48px 80px', zIndex:1 }}>

          {/* Brand row */}
          <div style={{ display:'flex', alignItems:'center', gap:'14px', marginBottom:'44px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'48px', height:'48px', borderRadius:'12px', background:'linear-gradient(135deg,#A0671A,#C8960C)' }}>
              <span style={{ color:'#fff', fontSize:'18px', fontWeight:700, letterSpacing:'-0.02em' }}>AV</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column' }}>
              <span style={{ color:'rgba(232,228,220,0.9)', fontSize:'15px', fontWeight:500, letterSpacing:'0.22em', textTransform:'uppercase' }}>ALTITUDE-VISION</span>
              <span style={{ color:'rgba(232,228,220,0.28)', fontSize:'11px', letterSpacing:'0.16em', textTransform:'uppercase' }}>Brazzaville · Congo</span>
            </div>
          </div>

          {/* Main headline */}
          <div style={{ display:'flex', flexDirection:'column', marginBottom:'18px' }}>
            <span style={{ color:'#E8E4DC', fontSize:'60px', fontWeight:300, lineHeight:1.1, letterSpacing:'-0.02em' }}>Immobilier, Événements</span>
            <span style={{ color:'#E8E4DC', fontSize:'60px', fontWeight:300, lineHeight:1.1, letterSpacing:'-0.02em' }}>
              {'& '}<span style={{ color:'#C8960C' }}>Communication</span>
            </span>
          </div>

          {/* Divider */}
          <div style={{ display:'flex', height:'1px', width:'72px', background:'rgba(200,135,42,0.45)', marginBottom:'18px' }} />

          {/* Subtitle */}
          <div style={{ display:'flex', color:'rgba(232,228,220,0.42)', fontSize:'20px', fontWeight:300, lineHeight:1.5, marginBottom:'auto' }}>
            La seule agence à Brazzaville qui réunit 3 expertises sous un même toit.
          </div>

          {/* Stats */}
          <div style={{ display:'flex', gap:'0', marginBottom:'28px' }}>
            {[
              { num:'200+', label:'Familles logées',     color:'#2E7BB5', sep:true  },
              { num:'80+',  label:'Événements réussis',   color:'#D42B2B', sep:true  },
              { num:'80+',  label:'Marques accompagnées', color:'#C8960C', sep:false },
            ].map((s, i) => (
              <div key={i} style={{ display:'flex', flexDirection:'column', paddingRight:'36px', marginRight:'36px', borderRight: s.sep ? '1px solid rgba(232,228,220,0.07)' : 'none' }}>
                <span style={{ color:s.color, fontSize:'36px', fontWeight:700, lineHeight:1, marginBottom:'4px' }}>{s.num}</span>
                <span style={{ color:'rgba(232,228,220,0.32)', fontSize:'11px', letterSpacing:'0.10em', textTransform:'uppercase' }}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:'18px', borderTop:'1px solid rgba(232,228,220,0.06)' }}>
            <span style={{ color:'rgba(232,228,220,0.18)', fontSize:'12px', letterSpacing:'0.12em', textTransform:'uppercase' }}>Immobilier · Événementiel · Communication</span>
            <span style={{ color:'rgba(200,135,42,0.45)', fontSize:'13px', letterSpacing:'0.04em' }}>altitudevision.agency</span>
          </div>
        </div>
      </div>
    ),
    { width:1200, height:630 }
  );
}
