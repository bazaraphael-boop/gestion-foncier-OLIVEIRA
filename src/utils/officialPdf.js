import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

// Official A4 documents (relevé parcellaire, fiche de mesure) drawn directly as vector PDF:
// sharp text, exact margins, and print security features that a retouch or an AI-generated
// copy reproduces badly: guilloche border, rosette, watermark, micro-text, digital fingerprint
// repeated in a QR code on every page.

const PAGE = { w: 210, h: 297 };
const M = 14; // content margin (mm)
const CONTENT_W = PAGE.w - 2 * M;
const NAVY = [15, 37, 64];
const BRAND = [26, 58, 92];
const GREEN = [21, 128, 61];
const ORANGE = [234, 88, 12];
const INK = [15, 23, 42];
const MUTED = [100, 116, 139];
const RULE = [203, 213, 225];
const TINT = [246, 248, 251];

// Standard PDF fonts only cover Latin-1: normalise the few typographic characters we use
// (narrow / non-breaking / thin spaces, en and em dashes, bullet, curly quotes, ellipsis, arrow)
export const pdfText = (value) =>
  String(value ?? '')
    .replace(/[   ]/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/•/g, '·')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/→/g, '>')
    .replace(/[^\x20-\x7e\xa0-\xff]/g, '');

/* ─────────────── Assets ─────────────── */

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Image indisponible : ${src.slice(0, 60)}`));
    img.src = src;
  });
}

async function imageToDataUrl(src, type = 'image/jpeg') {
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  return { dataUrl: canvas.toDataURL(type, 0.92), width: img.naturalWidth, height: img.naturalHeight };
}

// On-screen SVG plan -> high resolution PNG
export async function svgToPng(svgEl, scale = 4) {
  if (!svgEl) return null;
  const vb = svgEl.viewBox?.baseVal;
  const w = vb?.width || svgEl.clientWidth;
  const h = vb?.height || svgEl.clientHeight;
  const clone = svgEl.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', w);
  clone.setAttribute('height', h);
  clone.removeAttribute('class');
  const xml = new XMLSerializer().serializeToString(clone);
  const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`);
  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { dataUrl: canvas.toDataURL('image/png'), width: w, height: h };
}

// SHA-256 of the document's key data, shown as XXXX-XXXX-XXXX-XXXX
export async function computeFingerprint(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return hex.slice(0, 16).match(/.{4}/g).join('-');
}

/* ─────────────── Security layer ─────────────── */

function polyline(doc, points) {
  const deltas = [];
  for (let i = 1; i < points.length; i++) deltas.push([points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]]);
  doc.lines(deltas, points[0][0], points[0][1], [1, 1], 'S', false);
}

function withOpacity(doc, opacity, draw) {
  doc.saveGraphicsState();
  doc.setGState(new doc.GState({ opacity, 'stroke-opacity': opacity }));
  draw();
  doc.restoreGraphicsState();
}

// Interlaced sine waves running around the page between two thin rules
function drawGuillocheFrame(doc) {
  const outer = 6;
  const inner = 10.5;
  const mid = (outer + inner) / 2;
  const amp = (inner - outer) / 2 - 0.25;
  const x0 = mid;
  const y0 = mid;
  const x1 = PAGE.w - mid;
  const y1 = PAGE.h - mid;
  const perimeter = 2 * (x1 - x0 + y1 - y0);
  const wavelength = 4.2;

  const pointAt = (s) => {
    const top = x1 - x0;
    const right = y1 - y0;
    if (s < top) return { x: x0 + s, y: y0, nx: 0, ny: 1 };
    s -= top;
    if (s < right) return { x: x1, y: y0 + s, nx: -1, ny: 0 };
    s -= right;
    if (s < top) return { x: x1 - s, y: y1, nx: 0, ny: -1 };
    s -= top;
    return { x: x0, y: y1 - s, nx: 1, ny: 0 };
  };

  const wave = (phase, color, width) => {
    const pts = [];
    for (let s = 0; s <= perimeter; s += 0.35) {
      const p = pointAt(s);
      const d = amp * Math.sin((2 * Math.PI * s) / wavelength + phase);
      pts.push([p.x + p.nx * d, p.y + p.ny * d]);
    }
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    polyline(doc, pts);
  };

  wave(0, BRAND, 0.12);
  wave(Math.PI, GREEN, 0.12);
  wave(Math.PI / 2, [148, 163, 184], 0.08);
  wave((3 * Math.PI) / 2, [148, 163, 184], 0.08);

  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.35);
  doc.rect(outer, outer, PAGE.w - 2 * outer, PAGE.h - 2 * outer);
  doc.setLineWidth(0.2);
  doc.rect(inner, inner, PAGE.w - 2 * inner, PAGE.h - 2 * inner);
}

// Spirograph-like rosette and diagonal "ORIGINAL" watermark behind the content
function drawBackgroundSecurity(doc, watermark) {
  withOpacity(doc, 0.1, () => {
    const cx = PAGE.w / 2;
    const cy = PAGE.h / 2 + 8;
    doc.setLineWidth(0.1);
    for (let k = 0; k < 12; k++) {
      const phase = (k * Math.PI) / 6;
      const pts = [];
      for (let t = 0; t <= Math.PI * 2 + 0.01; t += 0.012) {
        const r = 46 + 9 * Math.sin(9 * t + phase) + 3 * Math.cos(23 * t - phase);
        pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
      }
      doc.setDrawColor(...(k % 2 ? GREEN : BRAND));
      polyline(doc, pts);
    }
  });
  withOpacity(doc, 0.05, () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(64);
    doc.setTextColor(...NAVY);
    doc.text(pdfText(watermark), 38, 225, { angle: 38 });
  });
}

// Line of micro-text (about 1 mm high): readable with a magnifier, lost in a photocopy or an AI redraw
function drawMicroText(doc, text, y, width = CONTENT_W, x = M) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(3.2);
  doc.setTextColor(...MUTED);
  const unit = `${pdfText(text)}  ·  `;
  let line = unit;
  while (doc.getTextWidth(line + unit) < width) line += unit;
  doc.text(line, x, y);
}

/* ─────────────── Building blocks ─────────────── */

function sectionTitle(doc, number, title, y) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text(pdfText(`${number}. ${title.toUpperCase()}`), M, y);
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.5);
  doc.line(M, y + 1.6, M + 22, y + 1.6);
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.15);
  doc.line(M + 22, y + 1.6, M + CONTENT_W, y + 1.6);
  return y + 5;
}

// Grid of label / value cells
function keyValueGrid(doc, items, y, { columns = 2, cellH = 12 } = {}) {
  const colW = CONTENT_W / columns;
  items.forEach((item, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = M + col * colW;
    const top = y + row * cellH;
    doc.setFillColor(...TINT);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.15);
    doc.rect(x, top, colW, cellH, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text(pdfText(item.label.toUpperCase()), x + 2.5, top + 4.2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(item.size || 10);
    doc.setTextColor(...(item.color || INK));
    const value = doc.splitTextToSize(pdfText(item.value), colW - 5);
    doc.text(value[0], x + 2.5, top + 9.3);
  });
  return y + Math.ceil(items.length / columns) * cellH;
}

function figure(doc, { title, image, x, y, w, h, format = 'PNG', note }) {
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.2);
  doc.setFillColor(...TINT);
  doc.rect(x, y, w, 6, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(...NAVY);
  doc.text(pdfText(title.toUpperCase()), x + 2.5, y + 4.1);
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y + 6, w, h, 'FD');
  if (image) {
    // Contain the image in the box, centred
    const ratio = Math.min((w - 2) / image.width, (h - 2) / image.height);
    const iw = image.width * ratio;
    const ih = image.height * ratio;
    doc.addImage(image.dataUrl, format, x + (w - iw) / 2, y + 6 + (h - ih) / 2, iw, ih, undefined, 'FAST');
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(pdfText(note || 'Image indisponible'), x + w / 2, y + 6 + h / 2, { align: 'center' });
  }
  return y + 6 + h;
}

function table(doc, { columns, rows, y, rowH = 6.4, mono = [] }) {
  const totalWeight = columns.reduce((s, c) => s + c.weight, 0);
  const widths = columns.map((c) => (c.weight / totalWeight) * CONTENT_W);
  const xs = widths.map((_, i) => M + widths.slice(0, i).reduce((a, b) => a + b, 0));

  doc.setFillColor(...NAVY);
  doc.rect(M, y, CONTENT_W, rowH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  columns.forEach((c, i) => {
    const tx = c.align === 'right' ? xs[i] + widths[i] - 2 : xs[i] + 2;
    doc.text(pdfText(c.label), tx, y + rowH - 2.1, { align: c.align === 'right' ? 'right' : 'left' });
  });

  rows.forEach((row, r) => {
    const top = y + rowH * (r + 1);
    if (r % 2 === 0) {
      doc.setFillColor(...TINT);
      doc.rect(M, top, CONTENT_W, rowH, 'F');
    }
    row.forEach((cell, i) => {
      const c = columns[i];
      const isMono = mono.includes(i);
      doc.setFont(isMono ? 'courier' : 'helvetica', c.bold || (row.bold && i === 0) ? 'bold' : 'normal');
      doc.setFontSize(isMono ? 7.4 : 7.6);
      doc.setTextColor(...(c.color && !row.plain ? c.color : INK));
      const tx = c.align === 'right' ? xs[i] + widths[i] - 2 : xs[i] + 2;
      doc.text(pdfText(cell), tx, top + rowH - 2.1, { align: c.align === 'right' ? 'right' : 'left' });
    });
  });

  const bottom = y + rowH * (rows.length + 1);
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.2);
  doc.rect(M, y, CONTENT_W, bottom - y);
  return bottom;
}

function header(doc, { banner, qr, docTitle, subject, reference, issuedOn, fingerprint, compact }) {
  const top = 13;
  const bannerH = compact ? 20 : 31;
  const bannerW = banner ? bannerH * (banner.width / banner.height) : 0;
  if (banner) doc.addImage(banner.dataUrl, 'JPEG', M, top, bannerW, bannerH, undefined, 'FAST');

  // QR code, top right
  const qrSize = compact ? 20 : 31;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.3);
  doc.rect(PAGE.w - M - qrSize - 1, top - 1, qrSize + 2, qrSize + 2);
  doc.addImage(qr, 'PNG', PAGE.w - M - qrSize, top, qrSize, qrSize);

  // Document identification between the letterhead and the QR code
  const infoRight = PAGE.w - M - qrSize - 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(compact ? 6.5 : 7);
  doc.setTextColor(...MUTED);
  const lines = [
    ['N° DE RÉFÉRENCE', reference],
    ['ÉMIS LE', issuedOn],
    ['EMPREINTE NUMÉRIQUE', fingerprint]
  ];
  lines.forEach(([label, value], i) => {
    const ly = top + (compact ? 4 : 6) + i * (compact ? 6 : 8.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(compact ? 5.5 : 6);
    doc.setTextColor(...MUTED);
    doc.text(pdfText(label), infoRight, ly, { align: 'right' });
    doc.setFont('courier', 'bold');
    doc.setFontSize(compact ? 7 : 8);
    doc.setTextColor(...INK);
    doc.text(pdfText(value), infoRight, ly + (compact ? 2.8 : 3.4), { align: 'right' });
  });
  const bandY = top + bannerH + 3;
  drawMicroText(doc, `CONCESSION MANUEL JOAQUIM D'OLIVEIRA · ${docTitle} · ${reference} · ${fingerprint}`, bandY);

  // Title band
  const bandTop = bandY + 1.8;
  const bandH = compact ? 9 : 12;
  doc.setFillColor(...NAVY);
  doc.rect(M, bandTop, CONTENT_W, bandH, 'F');
  doc.setFillColor(...GREEN);
  doc.rect(M, bandTop + bandH, CONTENT_W, 0.9, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(compact ? 10 : 13);
  doc.text(pdfText(docTitle), M + 4, bandTop + bandH / 2 + (compact ? 1.3 : 1.7));
  doc.setFontSize(compact ? 9 : 11.5);
  doc.text(pdfText(subject), PAGE.w - M - 4, bandTop + bandH / 2 + (compact ? 1.2 : 1.5), { align: 'right' });

  return bandTop + bandH + 7;
}

function footer(doc, { page, pages, reference, fingerprint }) {
  drawMicroText(doc, `DOCUMENT ORIGINAL · TOUTE RETOUCHE OU GÉNÉRATION PAR IA LE REND NUL · ${reference} · ${fingerprint}`, PAGE.h - 17.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED);
  doc.text(pdfText("Concession Manuel Joaquim d'Oliveira · Avenue Makakidi N°1, Quartier Océan, Muanda · Kongo Central · RDC"), M, PAGE.h - 13.5);
  doc.text(pdfText(`Page ${page} / ${pages}`), PAGE.w - M, PAGE.h - 13.5, { align: 'right' });
}

function authenticationBlock(doc, { y, qr, reference, fingerprint, issuedOn, checks }) {
  const h = 50;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.4);
  doc.setFillColor(...TINT);
  doc.rect(M, y, CONTENT_W, h, 'FD');
  doc.addImage(qr, 'PNG', M + 3, y + 3, h - 6, h - 6);

  const tx = M + h + 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text(pdfText('Vérification anti-fraude / anti-IA'), tx, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(...INK);
  const intro = doc.splitTextToSize(
    pdfText(
      "Scannez le QR code avec l'appareil photo d'un téléphone : le message affiché doit reprendre exactement les informations imprimées ci-dessous " +
        checks +
        '. Toute différence signifie que le document a été modifié (retouche, montage ou génération par intelligence artificielle) : il est alors NUL.'
    ),
    CONTENT_W - h - 6
  );
  doc.text(intro, tx, y + 12);

  const rows = [
    ['Référence', reference],
    ['Empreinte numérique (SHA-256)', fingerprint],
    ['Date d\'émission', issuedOn]
  ];
  rows.forEach(([label, value], i) => {
    const ry = y + 28 + i * 5.2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(pdfText(label), tx, ry);
    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    doc.text(pdfText(value), tx + 48, ry);
  });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.4);
  doc.setTextColor(...MUTED);
  const note = doc.splitTextToSize(
    pdfText('Sécurités : cadre guilloché, rosace et filigrane de fond, micro-texte, empreinte numérique reprise dans le QR code de chaque page.'),
    CONTENT_W - h - 6
  );
  doc.text(note, tx, y + h - 3 - (note.length - 1) * 2.6);
  return y + h;
}

function observations(doc, y, bottom, text) {
  const h = bottom - y;
  if (h < 14) return y;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.25);
  doc.rect(M, y, CONTENT_W, h);
  let lineY = y + 6;
  if (text) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(pdfText(text), CONTENT_W - 8);
    doc.text(lines, M + 4, lineY);
    lineY += lines.length * 3.6 + 3;
  }
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.15);
  for (; lineY < y + h - 3; lineY += 7) doc.line(M + 4, lineY, M + CONTENT_W - 4, lineY);
  return bottom;
}

function signatures(doc, y, { leftTitle, rightTitle, height = 36 }) {
  const w = (CONTENT_W - 8) / 2;
  const h = height;
  [[M, leftTitle], [M + w + 8, rightTitle]].forEach(([x, title]) => {
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.25);
    doc.rect(x, y, w, h);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(...NAVY);
    doc.text(pdfText(title.toUpperCase()), x + w / 2, y + 5.5, { align: 'center' });
    doc.setDrawColor(...MUTED);
    doc.setLineDashPattern([0.8, 0.8], 0);
    doc.circle(x + w - 15, y + h / 2 + 3, Math.min(10, h / 2 - 6));
    doc.setLineDashPattern([], 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...MUTED);
    doc.text('Cachet', x + w - 15, y + h / 2 + 4, { align: 'center' });
    doc.setDrawColor(...RULE);
    doc.line(x + 5, y + h - 6, x + w - 30, y + h - 6);
    doc.text(pdfText('Nom, date et signature'), x + 5, y + h - 2.5);
  });
  return y + h;
}

async function makeQr(text) {
  return QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 1, width: 600, color: { dark: '#0f2540', light: '#ffffff' } });
}

async function loadBanner() {
  try {
    return await imageToDataUrl('/header_banner.jpg');
  } catch {
    return null;
  }
}

/* ─────────────── Documents ─────────────── */

/**
 * Relevé parcellaire officiel (2 pages).
 * data: { lotRef, owner, statusLabel, statusColor, areaHa, areaM2, perimeter, coastal, coastalDetail,
 *         bornes: [{ name, lat, lng, latDms, lngDms, side }], qrText, reference, issuedOn, fingerprint,
 *         situationPlan, bornagePlan, satellite }
 */
export async function buildRelevePdf(data) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const [banner, qr] = await Promise.all([loadBanner(), makeQr(data.qrText)]);
  const docTitle = 'RELEVÉ PARCELLAIRE OFFICIEL';
  const subject = `Lot ${data.lotRef}`;
  const common = { banner, qr, docTitle, subject, reference: data.reference, issuedOn: data.issuedOn, fingerprint: data.fingerprint };
  const pages = 2;

  // Page 1: identification, plans, satellite view
  drawBackgroundSecurity(doc, 'ORIGINAL');
  drawGuillocheFrame(doc);
  let y = header(doc, common);
  y = sectionTitle(doc, 1, 'Identification du lot', y);
  y = keyValueGrid(doc, [
    { label: 'Numéro de lot', value: data.lotRef, size: 11 },
    { label: "Statut d'occupation", value: data.statusLabel, color: data.statusColor },
    { label: 'Propriétaire / affectataire', value: data.owner },
    { label: 'Zonage littoral', value: data.coastal },
    { label: 'Superficie', value: `${data.areaHa}  (${data.areaM2})`, color: GREEN, size: 11 },
    { label: 'Périmètre', value: data.perimeter }
  ], y);

  y = sectionTitle(doc, 2, 'Plans', y + 6);
  const planH = 58;
  figure(doc, { title: 'Plan de situation', image: data.situationPlan, x: M, y, w: 60, h: planH });
  figure(doc, { title: 'Plan de bornage', image: data.bornagePlan, x: M + 64, y, w: CONTENT_W - 64, h: planH });
  y += planH + 6 + 6;

  y = sectionTitle(doc, 3, 'Vue satellite', y);
  const satH = Math.min(PAGE.h - 24 - y - 6, 96);
  figure(doc, { title: 'Imagerie satellite du lot', image: data.satellite, format: 'JPEG', x: M, y, w: CONTENT_W, h: satH, note: 'Imagerie satellite indisponible (connexion Internet requise)' });
  footer(doc, { page: 1, pages, reference: data.reference, fingerprint: data.fingerprint });

  // Page 2: coordinates, authentication, visas
  doc.addPage();
  drawBackgroundSecurity(doc, 'ORIGINAL');
  drawGuillocheFrame(doc);
  y = header(doc, { ...common, compact: true });
  y = sectionTitle(doc, 4, 'Coordonnées géodésiques des bornes (WGS84)', y);
  y = table(doc, {
    columns: [
      { label: 'Borne', weight: 9, bold: true, color: ORANGE },
      { label: 'Latitude', weight: 15 },
      { label: 'Longitude', weight: 15 },
      { label: 'Latitude (DMS)', weight: 20 },
      { label: 'Longitude (DMS)', weight: 20 },
      { label: 'Côté suivant', weight: 21, align: 'right' }
    ],
    rows: [
      ...data.bornes.map((b) => [b.name, b.lat, b.lng, b.latDms, b.lngDms, b.side]),
      Object.assign(['', '', '', '', 'Périmètre total', data.perimeter], { plain: true })
    ],
    y,
    mono: [1, 2, 3, 4, 5]
  });

  y = sectionTitle(doc, 5, 'Authentification', y + 8);
  y = authenticationBlock(doc, { y, qr, reference: data.reference, fingerprint: data.fingerprint, issuedOn: data.issuedOn, checks: '(lot, propriétaire, superficie, côtés, référence et empreinte)' });

  y = sectionTitle(doc, 6, 'Visas', y + 8);
  y = signatures(doc, y, { leftTitle: 'Le Géomètre-Arpenteur agréé', rightTitle: "La Direction de la Concession" });
  y = sectionTitle(doc, 7, 'Observations', y + 8);
  observations(doc, y, PAGE.h - 24, data.notes);
  footer(doc, { page: 2, pages, reference: data.reference, fingerprint: data.fingerprint });

  return doc;
}

/**
 * Fiche de mesure & quota de lotissement (2 pages).
 * data: { areaHa, areaM2, perimeter, pointsCount, results: [[label, value]], points: [{ name, lat, lng, latDms, lngDms, side }],
 *         qrText, reference, issuedOn, fingerprint, author, situationPlan, zonePlan, satellite, lots, usable }
 */
export async function buildMeasurePdf(data) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const [banner, qr] = await Promise.all([loadBanner(), makeQr(data.qrText)]);
  const docTitle = 'FICHE DE MESURE & QUOTA';
  const subject = data.areaHa;
  const common = { banner, qr, docTitle, subject, reference: data.reference, issuedOn: data.issuedOn, fingerprint: data.fingerprint };
  const pages = 2;

  drawBackgroundSecurity(doc, 'ORIGINAL');
  drawGuillocheFrame(doc);
  let y = header(doc, common);
  y = sectionTitle(doc, 1, 'Synthèse de la mesure', y);
  y = keyValueGrid(doc, [
    { label: 'Superficie mesurée', value: `${data.areaHa}  (${data.areaM2})`, color: GREEN, size: 11 },
    { label: 'Périmètre', value: data.perimeter },
    { label: 'Lots possibles', value: data.lots, size: 11, color: BRAND },
    { label: 'Surface lotissable', value: data.usable },
    { label: 'Points mesurés', value: String(data.pointsCount) },
    { label: 'Établi par', value: data.author || '-' }
  ], y);

  y = sectionTitle(doc, 2, 'Plans', y + 6);
  const planH = 58;
  figure(doc, { title: 'Plan de situation', image: data.situationPlan, x: M, y, w: 60, h: planH });
  figure(doc, { title: 'Plan de la zone mesurée', image: data.zonePlan, x: M + 64, y, w: CONTENT_W - 64, h: planH });
  y += planH + 6 + 6;

  y = sectionTitle(doc, 3, 'Vue satellite', y);
  const satH = Math.min(PAGE.h - 24 - y - 6, 96);
  figure(doc, { title: 'Imagerie satellite de la zone', image: data.satellite, format: 'JPEG', x: M, y, w: CONTENT_W, h: satH, note: 'Imagerie satellite indisponible (connexion Internet requise)' });
  footer(doc, { page: 1, pages, reference: data.reference, fingerprint: data.fingerprint });

  doc.addPage();
  drawBackgroundSecurity(doc, 'ORIGINAL');
  drawGuillocheFrame(doc);
  y = header(doc, { ...common, compact: true });
  y = sectionTitle(doc, 4, 'Quota de lotissement & estimation', y);
  y = table(doc, {
    columns: [
      { label: 'Élément', weight: 62 },
      { label: 'Valeur', weight: 38, align: 'right', bold: true }
    ],
    rows: data.results,
    y,
    rowH: 5.6
  });

  y = sectionTitle(doc, 5, 'Points mesurés (WGS84)', y + 7);
  y = table(doc, {
    columns: [
      { label: 'Point', weight: 9, bold: true, color: BRAND },
      { label: 'Latitude', weight: 15 },
      { label: 'Longitude', weight: 15 },
      { label: 'Latitude (DMS)', weight: 20 },
      { label: 'Longitude (DMS)', weight: 20 },
      { label: 'Côté suivant', weight: 21, align: 'right' }
    ],
    rows: data.points.map((p) => [p.name, p.lat, p.lng, p.latDms, p.lngDms, p.side]),
    y,
    mono: [1, 2, 3, 4, 5],
    rowH: 6
  });

  y = sectionTitle(doc, 6, 'Authentification', y + 7);
  y = authenticationBlock(doc, { y, qr, reference: data.reference, fingerprint: data.fingerprint, issuedOn: data.issuedOn, checks: '(superficie, périmètre, nombre de lots, référence et empreinte)' });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.6);
  doc.setTextColor(...MUTED);
  doc.text(
    doc.splitTextToSize(pdfText('Estimation indicative calculée sur la superficie : la forme du terrain, les servitudes et le tracé définitif des voies peuvent modifier le nombre réel de lots. Ce document ne vaut pas titre foncier.'), CONTENT_W),
    M,
    y + 5
  );

  y = sectionTitle(doc, 7, 'Visas', y + 13);
  // Signature boxes take the room left above the footer (at least 24 mm)
  signatures(doc, y, { leftTitle: 'Le Géomètre-Arpenteur', rightTitle: 'La Direction de la Concession', height: Math.max(24, Math.min(40, PAGE.h - 24 - y)) });
  footer(doc, { page: 2, pages, reference: data.reference, fingerprint: data.fingerprint });

  return doc;
}
