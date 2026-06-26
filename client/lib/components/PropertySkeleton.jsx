'use client';

const shimmerStyle = (delay = 0) => ({
  background: 'linear-gradient(90deg, #EDE9E3 0%, #E4DFD8 50%, #EDE9E3 100%)',
  backgroundSize: '200% 100%',
  animation: `skeletonShimmer 1.6s ease-in-out infinite ${delay}s`,
});

const SHIMMER_CSS = `
  @keyframes skeletonShimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`;

export const PropertySkeletonGrid = () => (
  <div style={{
    background: '#FDFCFA',
    border: '1px solid rgba(200,150,12,0.15)',
    borderRadius: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  }}>
    <style>{SHIMMER_CSS}</style>
    <div style={{ height: 'clamp(200px, 20vw, 280px)', flexShrink: 0, ...shimmerStyle() }} />
    <div style={{ padding: 'clamp(16px, 2vw, 24px)', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
      <div style={{ height: 10, width: 60, ...shimmerStyle() }} />
      <div style={{ height: 14, width: '85%', ...shimmerStyle(0.1) }} />
      <div style={{ height: 14, width: '60%', ...shimmerStyle(0.15) }} />
      <div style={{ height: 10, width: '50%', ...shimmerStyle(0.2) }} />
      <div style={{ height: 1, width: 32, background: 'rgba(200,150,12,0.25)' }} />
      <div style={{ height: 10, width: '100%', ...shimmerStyle(0.25) }} />
      <div style={{ height: 10, width: '75%', ...shimmerStyle(0.3) }} />
      <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
        {[48, 52, 56].map((w, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 28, height: 28, background: 'rgba(200,150,12,0.08)', border: '1px solid rgba(200,150,12,0.1)', flexShrink: 0 }} />
            <div style={{ height: 10, width: w, ...shimmerStyle(i * 0.05) }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 14, borderTop: '1px solid #F0EDE8' }}>
        <div style={{ height: 10, width: 80, ...shimmerStyle(0.35) }} />
        <div style={{ height: 10, width: 40, background: 'rgba(200,150,12,0.15)', backgroundSize: '200% 100%', animation: 'skeletonShimmer 1.6s ease-in-out infinite 0.4s' }} />
      </div>
    </div>
  </div>
);

export const PropertySkeletonList = () => (
  <div style={{
    background: '#FDFCFA',
    border: '1px solid rgba(200,150,12,0.15)',
    borderRadius: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'row',
  }}>
    <style>{SHIMMER_CSS}</style>
    <div style={{ width: 280, minHeight: 200, flexShrink: 0, ...shimmerStyle() }} />
    <div style={{ padding: '24px 28px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ height: 10, width: 50, ...shimmerStyle() }} />
      <div style={{ height: 20, width: '70%', ...shimmerStyle(0.1) }} />
      <div style={{ height: 10, width: '40%', ...shimmerStyle(0.15) }} />
      <div style={{ height: 1, width: 32, background: 'rgba(200,150,12,0.25)', marginTop: 4 }} />
      <div style={{ height: 10, width: '90%', ...shimmerStyle(0.2) }} />
      <div style={{ height: 10, width: '65%', ...shimmerStyle(0.25) }} />
      <div style={{ marginTop: 'auto' }}>
        <div style={{ height: 18, width: 140, ...shimmerStyle(0.3), marginBottom: 12 }} />
        <div style={{ display: 'flex', gap: 12 }}>
          {[48, 52, 56].map((w, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 28, height: 28, background: 'rgba(200,150,12,0.08)', border: '1px solid rgba(200,150,12,0.1)', flexShrink: 0 }} />
              <div style={{ height: 10, width: w, ...shimmerStyle(i * 0.05) }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default PropertySkeletonGrid;