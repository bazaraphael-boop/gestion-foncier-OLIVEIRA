import * as turf from '@turf/turf';
import { formatMeters, gridDistance } from './geoUtils';

// Builds a north-up satellite image (PNG data URL) of a parcel or measured zone, for the
// printable / downloadable sheets: Esri World Imagery tiles (served with CORS) stitched on a
// canvas, then the outline, numbered points, side lengths, scale bar and north arrow on top.

const TILE_SIZE = 256;
const TILE_URL = (z, x, y) => `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
const MAX_ZOOM = 19;
const MIN_ZOOM = 10;

// Web Mercator world pixel coordinates at zoom z
function project([lng, lat], z) {
  const scale = TILE_SIZE * 2 ** z;
  const sin = Math.sin((lat * Math.PI) / 180);
  return [((lng + 180) / 360) * scale, (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale];
}

function loadTile(z, x, y) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = TILE_URL(z, x, y);
  });
}

function niceLength(maxMeters) {
  const pow = 10 ** Math.floor(Math.log10(maxMeters));
  return [5, 2, 1].map((f) => f * pow).find((v) => v <= maxMeters) || pow;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * @param {Object} options
 * @param {Array<[number, number]>} options.points  Points of the zone as [lng, lat], without closing point
 * @param {Array<Array<[number, number]>>} [options.neighbours]  Outer rings of neighbouring lots ([lng, lat])
 * @param {string} [options.color]  Outline colour of the zone
 * @param {string} [options.pointPrefix]  Label prefix of the points (B for bornes, M for measurements)
 * @param {string} [options.pointColor]
 * @param {number} [options.width]  Output width in CSS pixels (rendered at 2x)
 * @param {number} [options.height]
 * @returns {Promise<{ dataUrl: string, zoom: number, missingTiles: number }>}
 */
export async function renderSatelliteSnapshot({
  points,
  neighbours = [],
  color = '#ffffff',
  pointPrefix = 'B',
  pointColor = '#EA580C',
  width = 720,
  height = 400
}) {
  if (!points || points.length < 3) throw new Error('Au moins 3 points sont nécessaires.');
  const ratio = 2;
  const pad = 56;

  // Zoom: the largest at which the zone fits the frame with margins
  const ring = [...points, points[0]];
  let zoom = MAX_ZOOM;
  for (; zoom > MIN_ZOOM; zoom--) {
    const px = ring.map((p) => project(p, zoom));
    const w = Math.max(...px.map((p) => p[0])) - Math.min(...px.map((p) => p[0]));
    const h = Math.max(...px.map((p) => p[1])) - Math.min(...px.map((p) => p[1]));
    if (w <= width - 2 * pad && h <= height - 2 * pad) break;
  }

  const [cLng, cLat] = turf.centroid(turf.polygon([ring])).geometry.coordinates;
  const [cx, cy] = project([cLng, cLat], zoom);
  const originX = cx - width / 2;
  const originY = cy - height / 2;
  const toCanvas = (p) => {
    const [x, y] = project(p, zoom);
    return [x - originX, y - originY];
  };

  const canvas = document.createElement('canvas');
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, width, height);

  // Imagery tiles
  const minTx = Math.floor(originX / TILE_SIZE);
  const maxTx = Math.floor((originX + width) / TILE_SIZE);
  const minTy = Math.floor(originY / TILE_SIZE);
  const maxTy = Math.floor((originY + height) / TILE_SIZE);
  const jobs = [];
  for (let tx = minTx; tx <= maxTx; tx++) {
    for (let ty = minTy; ty <= maxTy; ty++) {
      jobs.push(loadTile(zoom, tx, ty).then((img) => ({ img, tx, ty })));
    }
  }
  const tiles = await Promise.all(jobs);
  let missingTiles = 0;
  tiles.forEach(({ img, tx, ty }) => {
    if (img) ctx.drawImage(img, tx * TILE_SIZE - originX, ty * TILE_SIZE - originY, TILE_SIZE, TILE_SIZE);
    else missingTiles += 1;
  });

  const path = (pts) => {
    ctx.beginPath();
    pts.forEach((p, i) => {
      const [x, y] = toCanvas(p);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  };

  // Neighbouring lots: thin white outlines
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  neighbours.forEach((n) => {
    path(n);
    ctx.stroke();
  });

  // Zone: light fill + strong outline with a dark halo for contrast on any imagery
  path(points);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(15,23,42,0.85)';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Side lengths
  const screen = points.map(toCanvas);
  const [ccx, ccy] = toCanvas([cLng, cLat]);
  ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length];
    const [x1, y1] = screen[i];
    const [x2, y2] = screen[(i + 1) % screen.length];
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 40) return;
    let nx = -(y2 - y1) / len;
    let ny = (x2 - x1) / len;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    if ((mx - ccx) * nx + (my - ccy) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    const text = formatMeters(gridDistance(a, b));
    const tw = ctx.measureText(text).width + 10;
    const lx = mx + nx * 14;
    const ly = my + ny * 14;
    roundRect(ctx, lx - tw / 2, ly - 9, tw, 18, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.fillText(text, lx, ly + 0.5);
  });

  // Numbered points: badge pushed just outside its corner (bisector of the two outward
  // edge normals) so close points never overlap, with a leader line to the exact corner
  const outwardNormal = (i) => {
    const [x1, y1] = screen[i];
    const [x2, y2] = screen[(i + 1) % screen.length];
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    let nx = -(y2 - y1) / len;
    let ny = (x2 - x1) / len;
    if (((x1 + x2) / 2 - ccx) * nx + ((y1 + y2) / 2 - ccy) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    return [nx, ny];
  };
  ctx.font = '800 9px ui-monospace, SFMono-Regular, Menlo, monospace';
  screen.forEach(([cornerX, cornerY], i) => {
    const [ax, ay] = outwardNormal((i - 1 + screen.length) % screen.length);
    const [bx, by] = outwardNormal(i);
    const n = Math.hypot(ax + bx, ay + by) || 1;
    const x = cornerX + ((ax + bx) / n) * 16;
    const y = cornerY + ((ay + by) / n) * 16;
    ctx.beginPath();
    ctx.moveTo(cornerX, cornerY);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cornerX, cornerY, 3, 0, Math.PI * 2);
    ctx.fillStyle = pointColor;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fillStyle = pointColor;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${pointPrefix}${i + 1}`, x, y + 0.5);
  });

  // Scale bar (metres per pixel at the zone latitude)
  const metersPerPx = (156543.03392 * Math.cos((cLat * Math.PI) / 180)) / 2 ** zoom;
  const barMeters = niceLength((width * 0.22) * metersPerPx);
  const barPx = barMeters / metersPerPx;
  roundRect(ctx, 10, height - 34, barPx + 20, 24, 4);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(20, height - 17, barPx / 2, 4);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1;
  ctx.strokeRect(20 + barPx / 2, height - 17, barPx / 2, 4);
  ctx.font = '600 9px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('0', 20, height - 24);
  ctx.textAlign = 'right';
  ctx.fillText(formatMeters(barMeters), 20 + barPx, height - 24);

  // North arrow
  ctx.beginPath();
  ctx.arc(width - 24, 26, 15, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(width - 24, 14);
  ctx.lineTo(width - 19, 31);
  ctx.lineTo(width - 24, 27);
  ctx.lineTo(width - 29, 31);
  ctx.closePath();
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.font = '800 8px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', width - 24, 49);

  // Attribution (required by the imagery provider)
  ctx.font = '500 8px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText('Imagerie © Esri, Maxar, Earthstar Geographics', width - 8, height - 8);

  return { dataUrl: canvas.toDataURL('image/jpeg', 0.9), zoom, missingTiles };
}
