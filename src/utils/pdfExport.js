import { toCanvas } from 'html-to-image';
import { jsPDF } from 'jspdf';

// Downloads an on-screen sheet (relevé, fiche de mesure) as an A4 PDF file.
// The sheet is laid out at A4 width, captured as an image, then split into pages at the
// boundaries of its [data-pdf-block] sections so no block is cut in half when it fits on a page.
// Elements marked [data-pdf-ignore] (toolbars) are left out.

const A4 = { width: 210, height: 297 };
const MARGIN_MM = 8;
const SHEET_WIDTH_PX = 794; // A4 width at 96 dpi

export async function downloadSheetAsPdf(element, filename) {
  const previous = { width: element.style.width, maxWidth: element.style.maxWidth };
  element.style.width = `${SHEET_WIDTH_PX}px`;
  element.style.maxWidth = 'none';

  try {
    // Let the browser lay the sheet out at A4 width before measuring it (a timer rather than
    // requestAnimationFrame, which never fires while the tab is in the background)
    await new Promise((resolve) => setTimeout(resolve, 60));

    const origin = element.getBoundingClientRect().top;
    const blockTops = [...element.querySelectorAll('[data-pdf-block]')]
      .filter((el) => !el.closest('[data-pdf-ignore]'))
      .map((el) => el.getBoundingClientRect().top - origin);

    const canvas = await toCanvas(element, {
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      width: SHEET_WIDTH_PX,
      height: element.scrollHeight,
      style: { margin: '0', borderRadius: '0', boxShadow: 'none', border: '0' },
      filter: (node) => !(node.dataset && 'pdfIgnore' in node.dataset)
    });

    const ignored = [...element.querySelectorAll('[data-pdf-ignore]')].reduce((h, el) => h + el.offsetHeight, 0);
    const scale = canvas.width / SHEET_WIDTH_PX;
    // Toolbars are removed from the capture, so the sections move up by their height
    const breaks = blockTops.map((top) => Math.max(0, (top - ignored) * scale)).sort((a, b) => a - b);

    const contentWidthMm = A4.width - 2 * MARGIN_MM;
    const pxPerMm = canvas.width / contentWidthMm;
    const pageHeightPx = Math.floor((A4.height - 2 * MARGIN_MM) * pxPerMm);

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    let y = 0;
    let first = true;
    while (y < canvas.height - 1) {
      let end = Math.min(y + pageHeightPx, canvas.height);
      if (end < canvas.height) {
        // Break before the last section that starts on this page (but keep pages reasonably full)
        const candidate = breaks.filter((b) => b > y + pageHeightPx * 0.35 && b <= end).pop();
        if (candidate) end = Math.floor(candidate);
      }

      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = end - y;
      const ctx = slice.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, y, canvas.width, end - y, 0, 0, canvas.width, end - y);

      if (!first) pdf.addPage();
      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN_MM, MARGIN_MM, contentWidthMm, (end - y) / pxPerMm);
      first = false;
      y = end;
    }

    pdf.save(filename);
  } finally {
    element.style.width = previous.width;
    element.style.maxWidth = previous.maxWidth;
  }
}
