import type { NestingResult, SheetSize } from './nesting'

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function toNestingSvg(nesting: NestingResult, sheet: SheetSize): string {
  const sheetMarkup = nesting.sheets
    .map(
      (current) =>
        `<g data-sheet-index="${current.index}" transform="translate(0 ${current.index * sheet.heightMm})"><rect class="sheet" x="0" y="0" width="${sheet.widthMm}" height="${sheet.heightMm}" fill="white" stroke="black"/>${current.panels
          .map(
            (panel) =>
              `<g data-panel-id="${escapeXml(panel.panelId)}"><rect x="${panel.xMm}" y="${panel.yMm}" width="${panel.widthMm}" height="${panel.heightMm}" fill="#d9eaff" stroke="#2266aa"/><text x="${panel.xMm + 4}" y="${panel.yMm + 14}" font-size="12">${escapeXml(panel.panelId)}</text></g>`,
          )
          .join('')}</g>`,
    )
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sheet.widthMm}" height="${sheet.heightMm * Math.max(1, nesting.sheetCount)}" viewBox="0 0 ${sheet.widthMm} ${sheet.heightMm * Math.max(1, nesting.sheetCount)}">${sheetMarkup}</svg>`
}
