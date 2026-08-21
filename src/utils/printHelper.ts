/**
 * Universal & Reliable Print Helper
 * Supports direct iframe isolated printing to bypass iframe sandbox/container restrictions.
 */

export interface PrintOptions {
  title?: string;
  paperSize?: 'A4' | '80mm';
  onComplete?: () => void;
}

export function printHtmlContent(htmlContent: string, options: PrintOptions = {}): boolean {
  const { title = 'طباعة كشف الحساب', paperSize = 'A4' } = options;

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
      // Fallback
      window.print();
      return false;
    }

    const pageSizeCss =
      paperSize === '80mm'
        ? '@page { size: 80mm auto; margin: 3mm; } body { width: 74mm; margin: 0 auto; font-size: 11px; }'
        : '@page { size: A4 portrait; margin: 8mm; } body { width: 100%; font-size: 12px; }';

    const fullDoc = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
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
              line-height: 1.4;
              padding: 6px;
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
              padding: 6px 8px;
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
              border-bottom: 2px solid #0f172a;
              padding-bottom: 8px;
              margin-bottom: 10px;
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
    }, 250);

    return true;
  } catch (err) {
    console.error('Print error:', err);
    window.print();
    return false;
  }
}
