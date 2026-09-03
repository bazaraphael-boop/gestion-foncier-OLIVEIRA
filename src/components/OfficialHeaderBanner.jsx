import React from 'react';

export default function OfficialHeaderBanner({ className = '' }) {
  return (
    <div className={`w-full overflow-hidden rounded-t-xl bg-white shadow-sm border-b border-slate-200 ${className}`}>
      <img
        src="/header_banner.jpg"
        alt="En-tête Officiel Concession Manuel Joaquim d'Oliveira"
        className="w-full h-auto block object-cover min-h-[100px]"
      />
    </div>
  );
}
