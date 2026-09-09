import React from 'react';
import { HOTEL_SERVICES } from '../constants/hotel';

export const getHotelHighlightLabels = (hotelServices) => HOTEL_SERVICES
  .filter(({ key }) => Boolean(hotelServices?.[key]))
  .map(({ label }) => label);

export default function HotelHighlights({ hotelServices, max = 3, className = '' }) {
  const labels = getHotelHighlightLabels(hotelServices);
  if (labels.length === 0) return null;
  const visible = labels.slice(0, max);
  const remaining = labels.length - visible.length;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`.trim()} aria-label="Points forts de l’hôtel">
      {visible.map((label) => <span key={label} className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-stone-700">{label}</span>)}
      {remaining > 0 && <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-1 text-xs font-medium text-stone-600">+{remaining}</span>}
    </div>
  );
}
