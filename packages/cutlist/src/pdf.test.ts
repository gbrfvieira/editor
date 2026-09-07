import { expect, test } from 'bun:test'
import { type CutListReport, toPdf } from './index'

test('exports a printable PDF containing cutlist sections', () => {
  const report: CutListReport = {
    panels: [
      {
        cabinetId: 'cabinet',
        label: 'side',
        widthMm: 600,
        heightMm: 800,
        thicknessMm: 18,
        quantity: 2,
      },
    ],
    hardware: [{ cabinetId: 'cabinet', item: 'hinge', quantity: 4 }],
    edgeBanding: [{ cabinetId: 'cabinet', panel: 'door', edge: 'top', lengthMm: 1000 }],
  }
  const pdf = toPdf(report)
  expect(pdf.subarray(0, 8).toString('ascii')).toBe('%PDF-1.4')
  expect(pdf.toString('ascii')).toContain('PAINEIS')
  expect(pdf.toString('ascii')).toContain('FERRAGENS')
  expect(pdf.toString('ascii')).toContain('FITA DE BORDA')
  expect(pdf.toString('ascii')).toContain('%%EOF')
})
