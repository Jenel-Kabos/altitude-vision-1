"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Bath, Bed, MapPin, Maximize2, Users } from "lucide-react";

const FALLBACK = "https://placehold.co/600x400/3B82F6/FFFFFF/png?text=Altimmo";

export default function PropertyManagementCard({ property, badges = [], priceLabel, description, capacity, actions, footer }) {
  const [image, setImage] = useState(property?.images?.[0] || FALLBACK);
  const address = [property?.address?.arrondissement, property?.address?.city].filter(Boolean).join(", ");
  return <article className="group flex h-full flex-col overflow-hidden rounded-xl bg-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl focus-within:ring-2 focus-within:ring-blue-600 dark:bg-slate-900 dark:shadow-black/30">
    <div className="relative h-48 overflow-hidden">
      <Image src={image} alt={property?.title || "Hébergement"} fill sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw" className="object-cover transition duration-300 group-hover:scale-110" onError={() => setImage(FALLBACK)} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      <div className="absolute left-2 top-2 flex max-w-[70%] flex-wrap gap-1.5">{badges.map((badge) => <span key={badge.label} className={`rounded-full px-3 py-1 text-xs font-bold text-white shadow-lg ${badge.className || "bg-gradient-to-r from-blue-600 to-cyan-600"}`}>{badge.label}</span>)}</div>
      {priceLabel && <span className="absolute bottom-2 left-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-3 py-1 text-xs font-bold text-white shadow-lg">{priceLabel}</span>}
    </div>
    <div className="flex flex-1 flex-col p-4">
      <h2 className="mb-2 line-clamp-1 text-lg font-bold text-gray-800 dark:text-slate-100" title={property?.title}>{property?.title || "Sans titre"}</h2>
      {description && <p className="mb-3 line-clamp-2 min-h-10 text-sm text-gray-600 dark:text-slate-300">{description}</p>}
      <div className="mb-4 space-y-1 text-sm text-gray-500 dark:text-slate-400">
        {address && <div className="flex items-center"><MapPin className="mr-2 h-4 w-4 shrink-0 text-red-500"/><span className="line-clamp-1">{address}</span></div>}
        <div className="flex min-h-5 flex-wrap items-center gap-4">
          {Number(property?.surface) > 0 && <span className="flex items-center"><Maximize2 className="mr-1 h-4 w-4 text-blue-500"/>{property.surface} m²</span>}
          {Number(property?.bedrooms) > 0 && <span className="flex items-center"><Bed className="mr-1 h-4 w-4 text-indigo-500"/>{property.bedrooms}</span>}
          {Number(property?.bathrooms) > 0 && <span className="flex items-center"><Bath className="mr-1 h-4 w-4 text-cyan-500"/>{property.bathrooms}</span>}
          {Number(capacity) > 0 && <span className="flex items-center"><Users className="mr-1 h-4 w-4 text-emerald-500"/>{capacity} pers.</span>}
        </div>
      </div>
      {footer}
      <div className="mt-auto flex flex-wrap gap-2">{actions}</div>
    </div>
  </article>;
}
