import type { UserBookWordDetail } from '../types';

const WORDS_PER_PAGE = 42;
const ROWS_PER_TABLE = 21;
/** 释义列最多显示字数（约 2 行：列宽约 155px / 12px ≈ 12 字/行，2 行留出省略号 3 字 → 12*2-3=21，取 22 字） */
const MEAN_MAX_CHARS = 22;

function escapeHtml(text: string): string {
  const el = document.createElement('div');
  el.textContent = text;
  return el.innerHTML;
}

function buildTableRows(
  rows: (UserBookWordDetail | null)[],
  startNo: number
): string {
  return rows
    .map((item, i) => {
      const no = startNo + i + 1;
      if (!item) {
        return `<tr><td class="pdf-col-no"></td><td class="pdf-col-word"></td><td class="pdf-col-meaning"><span class="pdf-col-meaning-inner"></span></td><td class="pdf-col-check"><div class="pdf-check-box"></div></td></tr>`;
      }
      const word = escapeHtml(item.word);
      const meanRaw = item.mean.length > MEAN_MAX_CHARS ? item.mean.slice(0, MEAN_MAX_CHARS) + '...' : item.mean;
      const mean = escapeHtml(meanRaw);
      return `<tr><td class="pdf-col-no">${no}</td><td class="pdf-col-word" title="${word}">${word}</td><td class="pdf-col-meaning" title="${escapeHtml(item.mean)}"><span class="pdf-col-meaning-inner">${mean}</span></td><td class="pdf-col-check"><div class="pdf-check-box"></div></td></tr>`;
    })
    .join('');
}

function buildPdfHtml(
  bookTitle: string,
  words: UserBookWordDetail[],
  pdfStyles: string
): string {
  const titleEscaped = escapeHtml(bookTitle);
  const pages: string[] = [];

  for (let i = 0; i < words.length; i += WORDS_PER_PAGE) {
    const chunk = words.slice(i, i + WORDS_PER_PAGE);
    const leftRows: (UserBookWordDetail | null)[] = chunk.slice(0, ROWS_PER_TABLE);
    const rightRows: (UserBookWordDetail | null)[] = chunk.slice(
      ROWS_PER_TABLE,
      WORDS_PER_PAGE
    );
    while (leftRows.length < ROWS_PER_TABLE) leftRows.push(null);
    while (rightRows.length < ROWS_PER_TABLE) rightRows.push(null);

    const leftStartNo = i;
    const rightStartNo = i + ROWS_PER_TABLE;

    const headerHtml = `
    <div class="pdf-header">
      <h1>Classic Vocabulary List</h1>
      <div class="pdf-meta-info">
        <span>Title: ${titleEscaped}</span>
        <span>Date: &nbsp;&nbsp;&nbsp; / &nbsp;&nbsp;&nbsp; / &nbsp;&nbsp;&nbsp;</span>
      </div>
    </div>`;

    const leftTableHtml = `
      <table class="pdf-table pdf-left-table">
        <thead>
          <tr>
            <th class="pdf-col-no">No.</th>
            <th class="pdf-col-word">Word</th>
            <th class="pdf-col-meaning">Meaning</th>
            <th class="pdf-col-check"></th>
          </tr>
        </thead>
        <tbody>
          ${buildTableRows(leftRows, leftStartNo)}
        </tbody>
      </table>`;

    const rightTableHtml = `
      <table class="pdf-table">
        <thead>
          <tr>
            <th class="pdf-col-no">No.</th>
            <th class="pdf-col-word">Word</th>
            <th class="pdf-col-meaning">Meaning</th>
            <th class="pdf-col-check"></th>
          </tr>
        </thead>
        <tbody>
          ${buildTableRows(rightRows, rightStartNo)}
        </tbody>
      </table>`;

    const pageNo = Math.floor(i / WORDS_PER_PAGE) + 1;
    pages.push(`
  <div class="pdf-page">
    ${headerHtml}
    <div class="pdf-main-container">
      ${leftTableHtml}
      ${rightTableHtml}
    </div>
    <div class="pdf-footer-row">
      <span class="pdf-brand">百词斩</span>
      <span class="pdf-footer">- ${pageNo} -</span>
    </div>
  </div>`);
  }

  return `<div id="pdf-root" style="background: white; font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;">
<style>${pdfStyles}</style>
${pages.join('')}
</div>`;
}

/**
 * 将当前单词本导出为 PDF 文件（双栏、A4、每页 21 行×2 列，仅首页页头、每页页脚）。
 * @param pdfStyles - PDF 样式字符串，由调用方通过 raw 导入 wordBookPdf.css 传入。
 */
export async function exportWordBookToPdf(
  bookTitle: string,
  words: UserBookWordDetail[],
  pdfStyles: string
): Promise<void> {
  if (!words.length) {
    return;
  }
  const html = buildPdfHtml(bookTitle, words, pdfStyles);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('style', 'position:fixed;left:-9999px;width:210mm;height:297mm;border:0;visibility:hidden');
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head></head><body>${html}</body></html>`);
  doc.close();

  try {
    const pageElements = Array.from(doc.body.querySelectorAll('.pdf-page')) as HTMLElement[];
    if (pageElements.length === 0) return;
    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', hotfixes: ['px_scaling'] });
    const pageWidth = 210;
    const pageHeight = 297;
    for (let i = 0; i < pageElements.length; i++) {
      if (i > 0) pdf.addPage();
      const canvas = await html2canvas(pageElements[i], { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
    }
    pdf.save(`${bookTitle}-单词表.pdf`);
  } finally {
    if (iframe.parentNode) iframe.remove();
  }
}
