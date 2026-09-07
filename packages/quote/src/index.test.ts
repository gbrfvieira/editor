import { expect, test } from 'bun:test'
import { type CutListReport, calculateQuote, toQuoteText } from './index'

const cutList: CutListReport = {
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

test('calculates boards, edge banding, hardware and labor', () => {
  const report = calculateQuote(
    cutList,
    {
      sheets: [],
      sheetCount: 1,
      wasteAreaM2: 0,
      utilizationPercent: 0,
      sheetWidthMm: 1000,
      sheetHeightMm: 1000,
    },
    {
      boardPricePerM2: { default: 10 },
      edgeBandingPricePerMeter: 2,
      hardwarePrices: { hinge: 1, 'drawer-slide': 4, handle: 3 },
      laborMultiplier: 1.5,
    },
  )
  expect(report.subtotal).toBe(16)
  expect(report.total).toBe(24)
})

test('exports a readable text quote', () => {
  const text = toQuoteText({ lineItems: [], subtotal: 12.5, total: 15 })
  expect(text).toContain('ORÇAMENTO')
  expect(text).toContain('Subtotal')
  expect(text).toContain('15.00')
})
