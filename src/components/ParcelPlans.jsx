import React, { useEffect, useMemo, useState } from 'react';
import * as turf from '@turf/turf';
import { STATUS_COLORS, getParcelBornes, formatMeters, gridDistance } from '../utils/geoUtils';
import { renderSatelliteSnapshot } from '../utils/satelliteSnapshot';

// Vector plans printed on the Relevé Parcellaire:
// - SituationPlan: where the parcel lies inside the concession (north up)
// - BornagePlan: the parcel with its bornes, side lengths and neighbouring lots (morcellement),
//   turned so its longest side is horizontal (north arrow shows the true orientation)

const M_PER_DEG_LAT = 110574;
const M_PER_DEG_LNG = 111320;

const outerRing = (feature) => {
  const g = feature?.geometry || feature;
  if (!g) return null;
  if (g.type === 'Polygon') return g.coordinates?.[0] || null;
  if (g.type === 'MultiPolygon') return g.coordinates?.[0]?.[0] || null;
  return null;
};

const bboxOfPoints = (points) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  points.forEach(([x, y]) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });
  return [minX, minY, maxX, maxY];
};

const bboxIntersects = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

// Local metric frame centred on (lng0, lat0), x east / y north, optionally rotated by -angle (radians)
function makeLocalFrame(lng0, lat0, angle = 0) {
  const k = Math.cos((lat0 * Math.PI) / 180);
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  return ([lng, lat]) => {
    const x = (lng - lng0) * k * M_PER_DEG_LNG;
    const y = (lat - lat0) * M_PER_DEG_LAT;
    return [x * cos - y * sin, x * sin + y * cos];
  };
}

// Fit a local-metre bbox into a width x height frame (screen y points down)
function makeFitter([minX, minY, maxX, maxY], width, height, pad) {
  const pxPerM = Math.min((width - 2 * pad) / Math.max(maxX - minX, 1), (height - 2 * pad) / Math.max(maxY - minY, 1));
  const offX = (width - (maxX - minX) * pxPerM) / 2;
  const offY = (height - (maxY - minY) * pxPerM) / 2;
  return { pxPerM, fit: ([x, y]) => [offX + (x - minX) * pxPerM, offY + (maxY - y) * pxPerM] };
}

const toPath = (screenPoints) =>
  screenPoints.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + ' Z';

function niceLength(maxMeters) {
  const pow = Math.pow(10, Math.floor(Math.log10(maxMeters)));
  return [5, 2, 1].map((f) => f * pow).find((v) => v <= maxMeters) || pow;
}

function ScaleBar({ pxPerM, width, height }) {
  const meters = niceLength((width * 0.22) / pxPerM);
  const len = meters * pxPerM;
  const x = 12;
  const y = height - 12;
  return (
    <g fontFamily="ui-monospace, monospace" fontSize="8" fill="#0f172a">
      <rect x={x - 4} y={y - 17} width={len + 8} height="21" rx="2" fill="#ffffff" fillOpacity="0.85" />
      <rect x={x} y={y - 4} width={len / 2} height="4" fill="#0f172a" />
      <rect x={x + len / 2} y={y - 4} width={len / 2} height="4" fill="#ffffff" stroke="#0f172a" strokeWidth="0.8" />
      <text x={x} y={y - 7}>0</text>
      <text x={x + len} y={y - 7} textAnchor="end">{formatMeters(meters)}</text>
    </g>
  );
}

// Arrow pointing to true north; rotationDeg is clockwise on screen
function NorthArrow({ width, rotationDeg = 0 }) {
  const cx = width - 20;
  const cy = 22;
  return (
    <g>
      <circle cx={cx} cy={cy} r="14" fill="#ffffff" fillOpacity="0.9" stroke="#cbd5e1" />
      <g transform={`rotate(${rotationDeg.toFixed(1)} ${cx} ${cy})`}>
        <path d={`M${cx},${cy - 11} L${cx + 5},${cy + 5} L${cx},${cy + 2} L${cx - 5},${cy + 5} Z`} fill="#0f172a" />
      </g>
      <text x={cx} y={cy + 25} textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#0f172a" fontFamily="ui-sans-serif, system-ui">N</text>
    </g>
  );
}

function Frame({ id, title, width, height, children }) {
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto block" role="img" aria-label={title}>
      <defs>
        <clipPath id={`${id}-clip`}>
          <rect x="0" y="0" width={width} height={height} />
        </clipPath>
      </defs>
      <rect x="0" y="0" width={width} height={height} fill="#f8fafc" />
      <g clipPath={`url(#${id}-clip)`}>{children}</g>
    </svg>
  );
}

const SITUATION_W = 300;
const SITUATION_H = 300;

export function SituationPlan({ parcel, parcels = [], concessionPolygon }) {
  const plan = useMemo(() => {
    const target = outerRing(parcel);
    if (!target) return null;
    const concessionRing = outerRing(concessionPolygon);
    const others = parcels.filter((p) => p && p.id !== parcel.id).map(outerRing).filter(Boolean);
    const [lng0, lat0] = turf.centroid(turf.polygon([target])).geometry.coordinates;
    const local = makeLocalFrame(lng0, lat0);
    const extent = (concessionRing ? [concessionRing] : [target, ...others]).flat().map(local);
    const { fit, pxPerM } = makeFitter(bboxOfPoints(extent), SITUATION_W, SITUATION_H, 16);
    const draw = (ring) => ring.map((pt) => fit(local(pt)));
    return {
      concession: concessionRing ? draw(concessionRing) : null,
      others: others.map(draw),
      target: draw(target),
      center: fit([0, 0]),
      pxPerM
    };
  }, [parcel, parcels, concessionPolygon]);

  if (!plan) return null;
  const { concession, others, target, center, pxPerM } = plan;
  const [cx, cy] = center;
  const lotRef = parcel.properties?.lotNumber || parcel.id;
  const labelW = lotRef.length * 5.6 + 10;
  const labelLeft = cx + 22 + labelW > SITUATION_W - 4;

  return (
    <Frame id="situation-plan" title={`Plan de situation du lot ${lotRef}`} width={SITUATION_W} height={SITUATION_H}>
      {concession && (
        <path d={toPath(concession)} fill="#fef3c7" fillOpacity="0.7" stroke="#d97706" strokeWidth="1.2" strokeDasharray="5 3" />
      )}
      {others.map((ring, i) => (
        <path key={i} d={toPath(ring)} fill="#cbd5e1" stroke="#94a3b8" strokeWidth="0.4" />
      ))}
      <path d={toPath(target)} fill="#dc2626" stroke="#991b1b" strokeWidth="1" />
      <circle cx={cx} cy={cy} r="11" fill="none" stroke="#dc2626" strokeWidth="1.5" />
      {[[-17, 0, -11, 0], [11, 0, 17, 0], [0, -17, 0, -11], [0, 11, 0, 17]].map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={cx + x1} y1={cy + y1} x2={cx + x2} y2={cy + y2} stroke="#dc2626" strokeWidth="1.5" />
      ))}
      <g fontFamily="ui-sans-serif, system-ui" fontSize="9" fontWeight="700">
        <rect x={labelLeft ? cx - 22 - labelW : cx + 22} y={cy - 8} width={labelW} height="15" rx="2" fill="#ffffff" stroke="#dc2626" />
        <text x={labelLeft ? cx - 27 : cx + 27} y={cy + 3} textAnchor={labelLeft ? 'end' : 'start'} fill="#991b1b">
          {lotRef}
        </text>
      </g>
      <NorthArrow width={SITUATION_W} />
      <ScaleBar pxPerM={pxPerM} width={SITUATION_W} height={SITUATION_H} />
    </Frame>
  );
}

const BORNAGE_W = 600;

export function BornagePlan({ parcel, parcels = [], pointPrefix = 'B', color: colorOverride }) {
  const plan = useMemo(() => {
    const bornes = getParcelBornes(parcel);
    if (bornes.length < 3) return null;
    const target = [...bornes, bornes[0]];
    const [lng0, lat0] = turf.centroid(turf.polygon([target])).geometry.coordinates;

    // Orientation: longest side horizontal, never upside down
    const flat = makeLocalFrame(lng0, lat0);
    let angle = 0;
    let longest = -1;
    bornes.forEach((a, i) => {
      const [x1, y1] = flat(a);
      const [x2, y2] = flat(bornes[(i + 1) % bornes.length]);
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (len > longest) {
        longest = len;
        angle = Math.atan2(y2 - y1, x2 - x1);
      }
    });
    if (angle > Math.PI / 2) angle -= Math.PI;
    if (angle <= -Math.PI / 2) angle += Math.PI;
    const local = makeLocalFrame(lng0, lat0, angle);

    // Frame: parcel plus a margin wide enough to show the adjoining lots
    const [minX, minY, maxX, maxY] = bboxOfPoints(target.map(local));
    const marginX = (maxX - minX) * 0.08 + 25;
    // Long strips get room for the neighbouring lots above and below; compact shapes stay large
    const marginY = Math.max(Math.min((maxY - minY) * 1.5, (maxX - minX) * 0.25), 20);
    const view = [minX - marginX, minY - marginY, maxX + marginX, maxY + marginY];
    // Frame height follows the parcel shape (long strips get a shorter frame, less empty space)
    const height = Math.round(Math.min(340, Math.max(170, (BORNAGE_W * (view[3] - view[1])) / (view[2] - view[0]))));
    const { fit, pxPerM } = makeFitter(view, BORNAGE_W, height, 10);
    const draw = (ring) => ring.map((pt) => fit(local(pt)));

    const neighbours = parcels
      .filter((p) => p && p.id !== parcel.id)
      .map((p) => ({ ring: outerRing(p), lot: p.properties?.lotNumber || '' }))
      .filter((n) => n.ring && bboxIntersects(bboxOfPoints(n.ring.map(local)), view))
      .map((n) => {
        // Label each neighbour on the part of it visible in the frame
        const visible = n.ring.map(local).filter(([x, y]) => x >= view[0] && x <= view[2] && y >= view[1] && y <= view[3]);
        const pts = visible.length ? visible : n.ring.map(local);
        const [bx0, by0, bx1, by1] = bboxOfPoints(pts);
        // Off-centre so it never sits on the side-length labels (which are at mid-sides)
        return { path: draw(n.ring), lot: n.lot, label: fit([bx0 + (bx1 - bx0) * 0.22, (by0 + by1) / 2]) };
      });

    const pts = bornes.map((pt) => fit(local(pt)));
    const [cx, cy] = fit([0, 0]);

    // Outward unit normal of edge i (pts[i] -> pts[i + 1])
    const outwardNormal = (i) => {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      const len = Math.hypot(x2 - x1, y2 - y1) || 1;
      let nx = -(y2 - y1) / len;
      let ny = (x2 - x1) / len;
      if (((x1 + x2) / 2 - cx) * nx + ((y1 + y2) / 2 - cy) * ny < 0) {
        nx = -nx;
        ny = -ny;
      }
      return [nx, ny];
    };

    // Borne badges sit just outside their corner so close bornes never overlap
    const badges = pts.map(([x, y], i) => {
      const [ax, ay] = outwardNormal((i - 1 + pts.length) % pts.length);
      const [bx, by] = outwardNormal(i);
      const len = Math.hypot(ax + bx, ay + by) || 1;
      return [x + ((ax + bx) / len) * 13, y + ((ay + by) / len) * 13];
    });
    const sides = bornes.map((a, i) => {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      let deg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
      if (deg > 90) deg -= 180;
      if (deg < -90) deg += 180;
      // Length label just outside the parcel; short sides get a horizontal label further out,
      // clear of the borne badges
      const [nx, ny] = outwardNormal(i);
      const isShort = Math.hypot(x2 - x1, y2 - y1) < 70;
      return {
        x: mx + nx * (isShort ? 36 : 10),
        y: my + ny * (isShort ? 36 : 10),
        deg: isShort ? 0 : deg,
        meters: gridDistance(a, bornes[(i + 1) % bornes.length])
      };
    });

    return { target: draw(target), neighbours, pts, badges, sides, cx, cy, pxPerM, height, northDeg: (angle * 180) / Math.PI };
  }, [parcel, parcels]);

  if (!plan) return null;
  const { target, neighbours, pts, badges, sides, cx, cy, pxPerM, height, northDeg } = plan;
  const color = colorOverride || (STATUS_COLORS[parcel.properties?.status] || STATUS_COLORS.disponible).hex;
  // Parcel bornes are orange everywhere in the app; other plans (measurements) use their own colour
  const pointColor = colorOverride || '#EA580C';
  const lotRef = parcel.properties?.lotNumber || parcel.id;

  return (
    <Frame id="bornage-plan" title={`Plan de bornage du lot ${lotRef}`} width={BORNAGE_W} height={height}>
      {neighbours.map((n, i) => (
        <path key={i} d={toPath(n.path)} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.8" />
      ))}
      {neighbours.map((n, i) =>
        n.lot ? (
          <text key={i} x={n.label[0]} y={n.label[1]} textAnchor="middle" dominantBaseline="middle" fontSize="8.5" fill="#475569" fontFamily="ui-sans-serif, system-ui" fontWeight="700" stroke="#e2e8f0" strokeWidth="2.5" paintOrder="stroke">
            {n.lot}
          </text>
        ) : null
      )}
      <path d={toPath(target)} fill={color} fillOpacity="0.3" stroke={color} strokeWidth="2" />
      <g fontFamily="ui-sans-serif, system-ui" textAnchor="middle" dominantBaseline="middle" stroke="#f8fafc" strokeWidth="3" paintOrder="stroke">
        <text x={cx} y={cy} fontSize="10" fontWeight="800" fill="#0f172a">
          {lotRef} • <tspan fill="#047857">{parcel.properties?.formattedHa || ''}</tspan>
        </text>
      </g>
      {sides.map((s, i) => (
        <text
          key={i}
          x={s.x}
          y={s.y}
          transform={`rotate(${s.deg.toFixed(1)} ${s.x.toFixed(1)} ${s.y.toFixed(1)})`}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="8.5"
          fontWeight="700"
          fill="#1e293b"
          fontFamily="ui-monospace, monospace"
          stroke="#f8fafc"
          strokeWidth="3"
          paintOrder="stroke"
        >
          {formatMeters(s.meters)}
        </text>
      ))}
      {pts.map(([x, y], i) => {
        const [bx, by] = badges[i];
        return (
          <g key={i}>
            <line x1={x} y1={y} x2={bx} y2={by} stroke={pointColor} strokeWidth="1" />
            <circle cx={x} cy={y} r="2.5" fill={pointColor} stroke="#ffffff" strokeWidth="1" />
            <circle cx={bx} cy={by} r="8" fill={pointColor} stroke="#ffffff" strokeWidth="1.5" />
            <text x={bx} y={by + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize="7" fontWeight="800" fill="#ffffff" fontFamily="ui-monospace, monospace">
              {pointPrefix}{i + 1}
            </text>
          </g>
        );
      })}
      <NorthArrow width={BORNAGE_W} rotationDeg={northDeg} />
      <ScaleBar pxPerM={pxPerM} width={BORNAGE_W} height={height} />
    </Frame>
  );
}

// Satellite view of the zone with its outline and points (image generated on the fly)
export function SatelliteFigure({ points, neighbours = [], color, pointPrefix = 'B', pointColor = '#EA580C', title = 'Vue satellite' }) {
  const [state, setState] = useState({ status: 'loading', dataUrl: null });
  const key = JSON.stringify(points);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', dataUrl: null });
    renderSatelliteSnapshot({ points, neighbours, color, pointPrefix, pointColor })
      .then(({ dataUrl, missingTiles }) => {
        if (!cancelled) setState({ status: missingTiles > 0 ? 'partial' : 'ready', dataUrl });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', dataUrl: null });
      });
    return () => {
      cancelled = true;
    };
    // points are compared by value through `key`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, color, pointPrefix, pointColor]);

  return (
    <figure data-pdf-block className="border border-slate-300 rounded overflow-hidden bg-white">
      <figcaption className="px-2.5 py-1.5 bg-slate-100 border-b border-slate-300 text-[10px] font-bold uppercase tracking-wider text-slate-800 flex justify-between">
        <span>{title}</span>
        {state.status === 'partial' && <span className="normal-case font-medium text-amber-700">Imagerie incomplète</span>}
      </figcaption>
      {state.dataUrl ? (
        <img src={state.dataUrl} alt={title} className="w-full h-auto block" />
      ) : (
        <div className="aspect-[9/5] flex items-center justify-center text-[11px] text-slate-500 bg-slate-50">
          {state.status === 'error' ? 'Imagerie satellite indisponible (connexion Internet requise).' : 'Chargement de l’imagerie satellite…'}
        </div>
      )}
    </figure>
  );
}
