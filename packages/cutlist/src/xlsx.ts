import ExcelJS from 'exceljs'
import type { CutListReport } from './index'

export type XlsxQuoteReport = {
  lineItems: { label: string; quantity: number; unitPrice: number; total: number }[]
  subtotal: number
  total: number
}

export async function toXlsx(report: CutListReport, quote?: XlsxQuoteReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()

  const panels = workbook.addWorksheet('Painéis')
  panels.addRow([
    'cabinetId',
    'label',
    'widthMm',
    'heightMm',
    'thicknessMm',
    'material',
    'quantity',
  ])
  for (const panel of report.panels) {
    panels.addRow([
      panel.cabinetId,
      panel.label,
      panel.widthMm,
      panel.heightMm,
      panel.thicknessMm,
      panel.material ?? '',
      panel.quantity,
    ])
  }

  const hardware = workbook.addWorksheet('Ferragens')
  hardware.addRow(['cabinetId', 'item', 'quantity', 'brand', 'name'])
  for (const item of report.hardware)
    hardware.addRow([item.cabinetId, item.item, item.quantity, item.brand ?? '', item.name ?? ''])

  const edgeBanding = workbook.addWorksheet('Fita de borda')
  edgeBanding.addRow(['cabinetId', 'panel', 'lengthMm'])
  for (const item of report.edgeBanding)
    edgeBanding.addRow([item.cabinetId, item.panel, item.lengthMm])

  if (quote) {
    const quoteSheet = workbook.addWorksheet('Orcamento')
    quoteSheet.addRow(['item', 'quantity', 'unitPrice', 'total'])
    for (const item of quote.lineItems) {
      quoteSheet.addRow([item.label, item.quantity, item.unitPrice, item.total])
    }
    quoteSheet.addRow([])
    quoteSheet.addRow(['Subtotal', '', '', quote.subtotal])
    quoteSheet.addRow(['Total', '', '', quote.total])
  }

  const data = await workbook.xlsx.writeBuffer()
  return Buffer.from(data)
}
