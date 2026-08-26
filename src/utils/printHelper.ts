import { PaperSize, PrintFontSizes } from '../types';

/**
 * Universal & Reliable Print Helper
 * Supports direct iframe isolated printing to bypass iframe sandbox/container restrictions.
 * Supports all thermal and sheet sizes: 58mm, 80mm, 57mm, 76mm, A4, A5, and custom mm.
 */

export interface PrintOptions {
  title?: string;
  paperSize?: PaperSize;
  customWidthMm?: number;
  customHeightMm?: number;
  fontSizes?: PrintFontSizes;
  onComplete?: () => void;
}

export function getPageSizeCss(
  paperSize: PaperSize = '80mm',
  customWidthMm?: number,
  customHeightMm?: number,
  fontSizes?: PrintFontSizes
): string {
  const headerFs = fontSizes?.header ?? (paperSize === '58mm' || paperSize === '57mm' ? 14 : paperSize === '80mm' || paperSize === '76mm' ? 16 : 20);
  const metaFs = fontSizes?.meta ?? (paperSize === '58mm' || paperSize === '57mm' ? 10 : paperSize === '80mm' || paperSize === '76mm' ? 11 : 13);
  const thFs = fontSizes?.tableHeader ?? (paperSize === '58mm' || paperSize === '57mm' ? 10 : paperSize === '80mm' || paperSize === '76mm' ? 11 : 13);
  const trFs = fontSizes?.tableRows ?? (paperSize === '58mm' || paperSize === '57mm' ? 10 : paperSize === '80mm' || paperSize === '76mm' ? 11 : 12);
  const sumFs = fontSizes?.summary ?? (paperSize === '58mm' || paperSize === '57mm' ? 11 : paperSize === '80mm' || paperSize === '76mm' ? 12 : 14);
  const footFs = fontSizes?.footer ?? (paperSize === '58mm' || paperSize === '57mm' ? 9 : paperSize === '80mm' || paperSize === '76mm' ? 10 : 11);

  let sizeRule = '';
  let bodyWidth = '';

  switch (paperSize) {
    case '58mm':
    case '57mm':
      sizeRule = `@page { size: 58mm auto; margin: 1.5mm; }`;
      bodyWidth = `width: 54mm; margin: 0 auto; font-size: ${metaFs}px;`;
      break;
    case '76mm':
      sizeRule = `@page { size: 76mm auto; margin: 2mm; }`;
      bodyWidth = `width: 71mm; margin: 0 auto; font-size: ${metaFs}px;`;
      break;
    case '80mm':
      sizeRule = `@page { size: 80mm auto; margin: 2.5mm; }`;
      bodyWidth = `width: 75mm; margin: 0 auto; font-size: ${metaFs}px;`;
      break;
    case 'A5':
      sizeRule = `@page { size: A5 portrait; margin: 6mm; }`;
      bodyWidth = `width: 100%; font-size: ${metaFs}px;`;
      break;
    case 'custom':
      const w = customWidthMm && customWidthMm > 30 ? customWidthMm : 80;
      const h = customHeightMm && customHeightMm > 30 ? `${customHeightMm}mm` : 'auto';
      sizeRule = `@page { size: ${w}mm ${h}; margin: 2mm; }`;
      bodyWidth = `width: ${w - 5}mm; margin: 0 auto; font-size: ${metaFs}px;`;
      break;
    case 'A4':
    default:
      sizeRule = `@page { size: A4 portrait; margin: 8mm; }`;
      bodyWidth = `width: 100%; font-size: ${metaFs}px;`;
      break;
  }

  return `
    ${sizeRule}
    body { ${bodyWidth} }
    .print-header-title { font-size: ${headerFs}px !important; }
    .print-meta-text { font-size: ${metaFs}px !important; }
    .print-th-text { font-size: ${thFs}px !important; }
    .print-tr-text { font-size: ${trFs}px !important; }
    .print-summary-text { font-size: ${sumFs}px !important; }
    .print-footer-text { font-size: ${footFs}px !important; }
  `;
}

export function printHtmlContent(htmlContent: string, options: PrintOptions = {}): boolean {
  const {
    title = 'طباعة الفاتورة',
    paperSize = '80mm',
    customWidthMm,
    customHeightMm,
    fontSizes,
  } = options;

  try {
    // 1. Remove any previous print iframe
    const oldIframe = document.getElementById('__halim_print_iframe__');
    if (oldIframe) {
      oldIframe.remove();
    }

    // 2. Create a hidden iframe for isolated document printing
    const iframe = document.createElement('iframe');
    iframe.id = '__halim_print_iframe__';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      window.print();
      return false;
    }

    const pageSizeCss = getPageSizeCss(paperSize, customWidthMm, customHeightMm, fontSizes);

    const fullDoc = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=JetBrains+Mono:wght@500;700;800&display=swap" rel="stylesheet">
          <style>
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-family: 'Cairo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              color: #0f172a;
              background: #ffffff;
              line-height: 1.35;
              padding: 2px 4px;
            }
            .font-mono {
              font-family: 'JetBrains Mono', 'Courier New', monospace;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 4px 6px;
              text-align: right;
            }
            th {
              background-color: #f1f5f9 !important;
              font-weight: 800;
            }
            .text-center { text-align: center; }
            .text-left { text-align: left; }
            .text-right { text-align: right; }
            .font-bold { font-weight: 700; }
            .font-black { font-weight: 900; }
            .badge-debit { color: #dc2626; font-weight: 700; }
            .badge-credit { color: #047857; font-weight: 700; }
            .header-banner {
              text-align: center;
              border-bottom: 2px dashed #0f172a;
              padding-bottom: 6px;
              margin-bottom: 8px;
            }
            .divider-dashed {
              border-top: 1px dashed #64748b;
              margin: 6px 0;
            }
            .divider-double {
              border-top: 3px double #0f172a;
              margin: 6px 0;
            }
            ${pageSizeCss}
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
      </html>
    `;

    doc.open();
    doc.write(fullDoc);
    doc.close();

    // Trigger printing once content is ready
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        options.onComplete?.();
      } catch (e) {
        console.warn('Iframe print failed, falling back to window.print():', e);
        window.print();
      }
    }, 280);

    return true;
  } catch (err) {
    console.error('Print error:', err);
    window.print();
    return false;
  }
}
