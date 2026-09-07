import type { CutListReport } from './index'
import type { NestingResult } from './nesting'

const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const MARGIN = 40
const LINE_HEIGHT = 14

function pdfText(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')
}

function ascii(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^\x20-\x7E]/gu, '?')
}

function reportLines(report: CutListReport, nesting?: NestingResult): string[] {
  const lines = [
    'PLANO DE CORTE',
    '',
    'PAINEIS',
    'Gabinete | Descricao | Largura | Altura | Espessura | Qtd',
  ]
  for (const panel of report.panels) {
    lines.push(
      `${panel.cabinetId} | ${ascii(panel.label)} | ${panel.widthMm} mm | ${panel.heightMm} mm | ${panel.thicknessMm} mm | ${panel.quantity}`,
    )
  }
  lines.push('', 'FERRAGENS', 'Gabinete | Item | Qtd')
  for (const item of report.hardware)
    lines.push(`${item.cabinetId} | ${item.item} | ${item.quantity}`)
  lines.push('', 'FITA DE BORDA', 'Gabinete | Painel | Aresta | Comprimento')
  for (const item of report.edgeBanding) {
    lines.push(
      `${item.cabinetId} | ${ascii(item.panel)} | ${item.edge ?? 'perimetro'} | ${item.lengthMm} mm`,
    )
  }
  if (nesting) {
    lines.push('', `CHAPAS: ${nesting.sheetCount}`, 'Chapa | Painel | X | Y | Largura | Altura')
    for (const sheet of nesting.sheets) {
      for (const panel of sheet.panels) {
        lines.push(
          `${sheet.index + 1} | ${ascii(panel.panelId)} | ${panel.xMm ?? 0} mm | ${panel.yMm ?? 0} mm | ${panel.widthMm} mm | ${panel.heightMm} mm`,
        )
      }
    }
  }
  return lines
}

function pageStream(lines: string[]): string {
  const commands = ['BT', `/F1 10 Tf`, `${MARGIN} ${PAGE_HEIGHT - MARGIN} Td`]
  for (const line of lines) {
    commands.push(`(${pdfText(ascii(line))}) Tj`, `0 -${LINE_HEIGHT} Td`)
  }
  commands.push('ET')
  return commands.join('\n')
}

/** Creates a small, dependency-free printable PDF report. */
export function toPdf(report: CutListReport, nesting?: NestingResult): Buffer {
  const lines = reportLines(report, nesting)
  const linesPerPage = Math.floor((PAGE_HEIGHT - MARGIN * 2) / LINE_HEIGHT)
  const pages = Array.from(
    { length: Math.max(1, Math.ceil(lines.length / linesPerPage)) },
    (_, index) => lines.slice(index * linesPerPage, (index + 1) * linesPerPage),
  )
  const objects: string[] = []
  objects.push('<< /Type /Catalog /Pages 2 0 R >>')
  objects.push(
    '<< /Type /Pages /Kids [' +
      pages.map((_, index) => `${4 + index * 2} 0 R`).join(' ') +
      `] /Count ${pages.length} >>`,
  )
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  for (const [index, page] of pages.entries()) {
    const pageObject = 4 + index * 2
    const streamObject = pageObject + 1
    const stream = pageStream(page)
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamObject} 0 R >>`,
    )
    objects.push(
      `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`,
    )
  }
  let output = '%PDF-1.4\n'
  const offsets: number[] = [0]
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(output, 'ascii'))
    output += `${index + 1} 0 obj\n${object}\nendobj\n`
  }
  const xref = Buffer.byteLength(output, 'ascii')
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let index = 1; index < offsets.length; index += 1) {
    output += `${offsets[index].toString().padStart(10, '0')} 00000 n \n`
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(output, 'ascii')
}
