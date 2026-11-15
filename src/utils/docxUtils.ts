import mammoth from 'mammoth';
import { Document, Packer, Paragraph } from 'docx';
import { htmlToContent } from 'docx/html';

const HTML_TAG_DETECTOR = /<\s*(p|h[1-6]|div|table|ul|ol|li|blockquote|hr|br|span|strong|em|u|s|b|i|mark|a|img)\b[^>]*>/i;

const LEGAL_DOCX_STYLESHEET = `
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 12pt;
    line-height: 1.5;
    color: #111827;
  }
  p {
    margin-top: 0pt;
    margin-bottom: 10pt;
    text-align: justify;
    line-height: 1.5;
  }
  h1 {
    font-size: 16pt;
    font-weight: bold;
    margin-top: 14pt;
    margin-bottom: 8pt;
    color: #000000;
  }
  h2 {
    font-size: 14pt;
    font-weight: bold;
    margin-top: 12pt;
    margin-bottom: 6pt;
    color: #000000;
  }
  h3 {
    font-size: 12pt;
    font-weight: bold;
    margin-top: 10pt;
    margin-bottom: 4pt;
    color: #000000;
  }
  blockquote {
    margin-left: 70pt;
    margin-right: 0pt;
    margin-top: 8pt;
    margin-bottom: 10pt;
    font-size: 10.5pt;
    line-height: 1.25;
    text-align: justify;
    color: #1f2937;
  }
  ul, ol {
    margin-top: 4pt;
    margin-bottom: 10pt;
  }
  li {
    margin-bottom: 4pt;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8pt;
    margin-bottom: 12pt;
  }
  th {
    border: 1px solid #94a3b8;
    background-color: #f1f5f9;
    font-weight: bold;
    padding: 6pt 8pt;
    text-align: left;
  }
  td {
    border: 1px solid #cbd5e1;
    padding: 6pt 8pt;
    text-align: left;
  }
`;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatInlineMarkdown(escapedLine: string): string {
  let out = escapedLine;
  // Restore explicit <u>...</u> if present in legacy content
  out = out.replace(/&lt;u&gt;([\s\S]*?)&lt;\/u&gt;/gi, '<u>$1</u>');
  // Links [label](url)
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  // Bold **text**
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic *text*
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  return out;
}

export function isHtmlContent(raw: string): boolean {
  if (!raw || !raw.trim()) return false;
  return HTML_TAG_DETECTOR.test(raw);
}

/**
 * Ensures any document content (whether already rich HTML from the Word editor
 * or legacy plain text / Markdown saved previously) renders cleanly as semantic HTML.
 */
export function normalizeContentToHtml(raw: string): string {
  if (!raw || !raw.trim()) {
    return '<p style="text-align: justify"></p>';
  }

  if (isHtmlContent(raw)) {
    return raw;
  }

  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const htmlBlocks: string[] = [];
  let inBulletList = false;
  let inOrderedList = false;

  const closeLists = () => {
    if (inBulletList) {
      htmlBlocks.push('</ul>');
      inBulletList = false;
    }
    if (inOrderedList) {
      htmlBlocks.push('</ol>');
      inOrderedList = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      closeLists();
      continue;
    }

    // Horizontal rule / page divider
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      closeLists();
      htmlBlocks.push('<hr />');
      continue;
    }

    // Markdown table block
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && i + 1 < lines.length && /^\s*\|[\s\-:|]+\|\s*$/.test(lines[i + 1])) {
      closeLists();
      const headerCells = trimmed
        .slice(1, -1)
        .split('|')
        .map(c => `<th><p>${formatInlineMarkdown(escapeHtml(c.trim()))}</p></th>`)
        .join('');
      i += 2; // skip header separator
      const bodyRows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        const rowCells = lines[i]
          .trim()
          .slice(1, -1)
          .split('|')
          .map(c => `<td><p>${formatInlineMarkdown(escapeHtml(c.trim()))}</p></td>`)
          .join('');
        bodyRows.push(`<tr>${rowCells}</tr>`);
        i++;
      }
      i--; // compensate loop increment
      htmlBlocks.push(`<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows.join('')}</tbody></table>`);
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      closeLists();
      const level = headingMatch[1].length;
      htmlBlocks.push(`<h${level}>${formatInlineMarkdown(escapeHtml(headingMatch[2]))}</h${level}>`);
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      closeLists();
      htmlBlocks.push(`<blockquote><p style="text-align: justify">${formatInlineMarkdown(escapeHtml(trimmed.slice(2)))}</p></blockquote>`);
      continue;
    }

    // Bullet list
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      if (inOrderedList) {
        htmlBlocks.push('</ol>');
        inOrderedList = false;
      }
      if (!inBulletList) {
        htmlBlocks.push('<ul>');
        inBulletList = true;
      }
      htmlBlocks.push(`<li><p>${formatInlineMarkdown(escapeHtml(bulletMatch[1]))}</p></li>`);
      continue;
    }

    // Ordered list
    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      if (inBulletList) {
        htmlBlocks.push('</ul>');
        inBulletList = false;
      }
      if (!inOrderedList) {
        htmlBlocks.push('<ol>');
        inOrderedList = true;
      }
      htmlBlocks.push(`<li><p>${formatInlineMarkdown(escapeHtml(orderedMatch[1]))}</p></li>`);
      continue;
    }

    closeLists();
    htmlBlocks.push(`<p style="text-align: justify">${formatInlineMarkdown(escapeHtml(line))}</p>`);
  }

  closeLists();
  return htmlBlocks.length > 0 ? htmlBlocks.join('') : '<p style="text-align: justify"></p>';
}

export function htmlToPlainText(content: string): string {
  if (!content) return '';
  if (!isHtmlContent(content)) return content;

  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/html');
  // Preserve paragraph breaks cleanly
  doc.querySelectorAll('p, h1, h2, h3, h4, li, tr, blockquote, hr').forEach(el => {
    el.appendChild(doc.createTextNode('\n'));
  });
  return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

export async function importDocxToHtml(file: File): Promise<{ html: string; warnings: string[] }> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      includeDefaultStyleMap: true,
      includeEmbeddedStyleMap: true,
      convertImage: mammoth.images.dataUri,
      styleMap: [
        'u => u',
        'strike => s',
        "p[style-name='Quote'] => blockquote:fresh",
        "p[style-name='Intense Quote'] => blockquote:fresh",
        "p[style-name='Citação'] => blockquote:fresh",
        "p[style-name='Citacao'] => blockquote:fresh",
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Subtitle'] => h2:fresh"
      ]
    }
  );

  const warnings = result.messages
    .filter(m => m.type === 'warning' || m.type === 'error')
    .map(m => m.message);

  const cleanedHtml = result.value && result.value.trim()
    ? result.value
    : '<p style="text-align: justify"></p>';

  return { html: cleanedHtml, warnings };
}

export async function exportHtmlToDocxBlob(content: string, title = 'Documento'): Promise<Blob> {
  const html = normalizeContentToHtml(content);

  // Convert <hr> markers to explicit Word page breaks
  const preparedHtml = html.replace(
    /<hr\s*\/?>/gi,
    '<div style="page-break-after: always;"></div>'
  );

  const children = htmlToContent(preparedHtml, {
    stylesheet: LEGAL_DOCX_STYLESHEET
  });

  const doc = new Document({
    title,
    creator: 'Meu Escritório Jurídico',
    description: title,
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906, // 210mm (A4) in twips
              height: 16838 // 297mm (A4) in twips
            },
            margin: {
              top: 1417, // 2.5cm
              right: 1417, // 2.5cm
              bottom: 1417, // 2.5cm
              left: 1417 // 2.5cm
            }
          }
        },
        children: children.length > 0 ? [...children] : [new Paragraph({ text: '' })]
      }
    ]
  });

  return Packer.toBlob(doc);
}

export async function downloadDocx(content: string, title: string): Promise<void> {
  const blob = await exportHtmlToDocxBlob(content, title);
  const safeName = (title || 'Documento')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_')
    .slice(0, 90);

  const fileName = safeName.toLowerCase().endsWith('.docx') ? safeName : `${safeName}.docx`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Prints rich HTML content inside an isolated hidden iframe so printing works
 * inside iframe-hosted environments without relying on window.open or popups.
 */
export function printHtmlDocument(title: string, content: string): void {
  const htmlBody = normalizeContentToHtml(content);

  const existingFrame = document.getElementById('docx-print-iframe');
  if (existingFrame && existingFrame.parentNode) {
    existingFrame.parentNode.removeChild(existingFrame);
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'docx-print-iframe';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.className = 'fixed -left-[9999px] -top-[9999px] w-0 h-0 border-0 opacity-0 pointer-events-none';
  document.body.appendChild(iframe);

  const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!frameDoc) return;

  frameDoc.open();
  frameDoc.write(`<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(title || 'Documento')}</title>
    <style>
      @page {
        size: A4 portrait;
        margin: 2.5cm;
      }
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #111827;
        font-family: 'Times New Roman', Georgia, serif;
        font-size: 12pt;
        line-height: 1.5;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      p {
        margin: 0 0 0.75em 0;
        text-align: justify;
      }
      h1 {
        font-size: 16pt;
        font-weight: 700;
        margin: 1em 0 0.5em 0;
        color: #000000;
      }
      h2 {
        font-size: 14pt;
        font-weight: 700;
        margin: 0.9em 0 0.45em 0;
        color: #000000;
      }
      h3 {
        font-size: 12pt;
        font-weight: 700;
        margin: 0.8em 0 0.4em 0;
        color: #000000;
      }
      ul, ol {
        padding-left: 1.5em;
        margin: 0.5em 0 0.75em 0;
      }
      li {
        margin-bottom: 0.25em;
      }
      blockquote {
        margin: 0.75em 0 0.75em 2.5cm;
        padding-left: 0.75em;
        border-left: 2px solid #cbd5e1;
        font-size: 10.5pt;
        line-height: 1.25;
        text-align: justify;
        color: #334155;
      }
      hr {
        border: 0;
        page-break-after: always;
        break-after: page;
        margin: 0;
      }
      table {
        border-collapse: collapse;
        width: 100%;
        margin: 0.75em 0;
      }
      th, td {
        border: 1px solid #94a3b8;
        padding: 6px 10px;
        vertical-align: top;
      }
      th {
        background-color: #f8fafc;
        font-weight: 700;
      }
      img {
        max-width: 100%;
        height: auto;
      }
    </style>
  </head>
  <body>
    ${htmlBody}
  </body>
</html>`);
  frameDoc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 3000);
    }
  }, 250);
}
