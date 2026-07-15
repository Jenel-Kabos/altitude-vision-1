export default function DashboardBadge({ count }) {
  if (!count || count < 1) return null;
  const label = count > 99 ? '99+' : count;
  return (
    <span
      className="ml-auto min-w-5 px-1.5 py-0.5 rounded-full text-center text-xs font-bold text-white"
      style={{ background: '#DC2626', fontSize: '0.65rem' }}
      aria-label={`${count} élément${count > 1 ? 's' : ''} nécessitant une attention`}
    >
      {label}
    </span>
  );
}
