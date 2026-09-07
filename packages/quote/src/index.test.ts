import { expect, test } from 'bun:test'
import {
  BRAZILIAN_PRICE_PRESETS,
  brazilianPricePreset,
  type CutListReport,
  calculateQuote,
  toQuoteText,
} from './index'

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

test('provides Brazilian MDF presets with per-panel labor pricing', () => {
  const preset = brazilianPricePreset(18)
  expect(preset.boardPricePerM2['mdf-18mm']).toBe(
    BRAZILIAN_PRICE_PRESETS[18].boardPricePerM2['mdf-18mm'],
  )
  expect(preset.laborPricePerPanelM2).toBeGreaterThan(0)
})

test('adds direct labor per square meter when configured', () => {
  const report = calculateQuote(
    cutList,
    { sheets: [], sheetCount: 0, wasteAreaM2: 0, utilizationPercent: 0 },
    {
      boardPricePerM2: {},
      edgeBandingPricePerMeter: 0,
      hardwarePrices: { hinge: 0, 'drawer-slide': 0, handle: 0 },
      laborPricePerPanelM2: 100,
    },
  )
  // cutList has one panel entry at 0.6 x 0.8 m, quantity 2 -> 0.96 m^2 total
  // manufactured area (labor scales with every panel produced, not just one).
  expect(report.lineItems.find((line) => line.label === 'Mão de obra')?.total).toBe(96)
})
