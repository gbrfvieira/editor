import { expect, test } from 'bun:test'
import { type CutListReport, calculateQuote, type NestingResult, type PriceTable } from './index'

test('calculates sheets, edge banding, hardware and labor', () => {
  const cutList: CutListReport = {
    panels: [
      {
        cabinetId: 'cabinet',
        label: 'side',
        widthMm: 600,
        heightMm: 800,
        thicknessMm: 18,
        material: 'MDF',
        quantity: 2,
      },
    ],
    hardware: [
      { cabinetId: 'cabinet', item: 'hinge', quantity: 4 },
      { cabinetId: 'cabinet', item: 'handle', quantity: 2 },
    ],
    edgeBanding: [{ cabinetId: 'cabinet', panel: 'door', lengthMm: 4000 }],
  }
  const nesting: NestingResult = {
    sheets: [{ index: 0, panels: [] }],
    sheetCount: 1,
    wasteAreaM2: 0,
    utilizationPercent: 0,
    sheetWidthMm: 1000,
    sheetHeightMm: 1000,
  }
  const prices: PriceTable = {
    boardPricePerM2: { MDF: 100 },
    edgeBandingPricePerMeter: 5,
    hardwarePrices: { hinge: 2, 'drawer-slide': 10, handle: 3 },
    laborMultiplier: 1.3,
  }
  const report = calculateQuote(cutList, nesting, prices)
  expect(report.subtotal).toBe(134)
  expect(report.total).toBe(174.2)
  expect(report.lineItems).toContainEqual({
    label: 'Chapa (MDF)',
    quantity: 1,
    unitPrice: 100,
    total: 100,
  })
  expect(report.lineItems).toContainEqual({
    label: 'Fita de borda',
    quantity: 4,
    unitPrice: 5,
    total: 20,
  })
})
