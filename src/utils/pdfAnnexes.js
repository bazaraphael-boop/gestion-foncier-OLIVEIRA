import { getDocumentUrl, documentTypeLabel, DOCUMENT_TYPES } from '../services/documentService';

// Annexes of the relevé PDF: every document attached to the parcel, the acte de cession first,
// then in the order of the document types (a file filed under another type is not left out).
// Photos / scans become pages of the relevé (utils/officialPdf.js); PDF pages are appended to it
// with pdf-lib, loaded only when a PDF annex exists.

const ANNEX_ORDER = ['contrat', ...DOCUMENT_TYPES.map((t) => t.id).filter((id) => id !== 'contrat')];
const annexRank = (doc) => {
  const i = ANNEX_ORDER.indexOf(doc.type);
  return i === -1 ? ANNEX_ORDER.length : i;
};
const MAX_SIDE = 2000; // px: sharp once printed on A4, light enough for the PDF

const isPdf = (doc) => /\.pdf$/i.test(doc.name || doc.path);
const isImage = (doc) => /\.(jpe?g|png|webp)$/i.test(doc.name || doc.path);

function blobToJpeg(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.85), width: canvas.width, height: canvas.height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image illisible'));
    };
    img.src = url;
  });
}

/**
 * Downloads the parcel's documents and prepares them for the relevé.
 * @returns {Promise<Array<{ title, name, image?, pdfBytes?, pdfPages?, note? }>>}
 */
export async function loadParcelAnnexes(parcel) {
  const documents = [...(parcel.properties?.documents || [])].sort((a, b) => annexRank(a) - annexRank(b));
  const annexes = [];
  for (const doc of documents) {
    const title = documentTypeLabel(doc.type);
    if (!isPdf(doc) && !isImage(doc)) {
      annexes.push({ title, name: doc.name, note: 'Document Word / Excel : consultable dans la fiche du lot' });
      continue;
    }
    try {
      const response = await fetch(await getDocumentUrl(doc));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      if (isImage(doc)) {
        annexes.push({ title, name: doc.name, image: await blobToJpeg(blob) });
      } else {
        const pdfBytes = new Uint8Array(await blob.arrayBuffer());
        const { PDFDocument } = await import('pdf-lib');
        const source = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        annexes.push({ title, name: doc.name, pdfBytes, pdfPages: source.getPageCount() });
      }
    } catch (err) {
      console.warn('Annexe indisponible :', doc.name, err);
      annexes.push({ title, name: doc.name, note: 'Document indisponible (connexion Internet requise)' });
    }
  }
  return annexes;
}

/**
 * Appends the PDF annexes to the relevé, each page labelled "Annexe n – …" with the relevé's
 * reference and page number. Returns the bytes of the complete PDF.
 */
export async function appendPdfAnnexes(relevePdfBytes, annexes, { reference }) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const out = await PDFDocument.load(relevePdfBytes);
  const font = await out.embedFont(StandardFonts.Helvetica);
  const bold = await out.embedFont(StandardFonts.HelveticaBold);
  const total = out.getPageCount() + annexes.reduce((n, a) => n + (a.pdfBytes ? a.pdfPages : 0), 0);
  const latin1 = (text) => String(text).replace(/[–—]/g, '-').replace(/[’‘]/g, "'").replace(/[^\x20-\x7e\xa0-\xff]/g, '');

  for (const [i, annex] of annexes.entries()) {
    if (!annex.pdfBytes) continue;
    const source = await PDFDocument.load(annex.pdfBytes, { ignoreEncryption: true });
    const copied = await out.copyPages(source, source.getPageIndices());
    copied.forEach((page, k) => {
      out.addPage(page);
      const { width } = page.getSize();
      const label = latin1(`ANNEXE ${i + 1} - ${annex.title.toUpperCase()} - ${annex.name} (${k + 1}/${copied.length})`);
      page.drawRectangle({ x: 0, y: page.getHeight() - 18, width, height: 18, color: rgb(15 / 255, 37 / 255, 64 / 255) });
      page.drawText(label, { x: 10, y: page.getHeight() - 12.5, size: 8, font: bold, color: rgb(1, 1, 1) });
      page.drawText(latin1(`${reference} - Page ${out.getPageCount()} / ${total}`), { x: 10, y: 8, size: 7, font, color: rgb(0.39, 0.45, 0.55) });
    });
  }
  return out.save();
}
