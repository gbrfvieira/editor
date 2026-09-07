export type CutListReport = {
  panels: {
    cabinetId: string
    label: string
    widthMm: number
    heightMm: number
    thicknessMm: number
    material?: string
    quantity: number
  }[]
  hardware: { cabinetId: string; item: 'hinge' | 'drawer-slide' | 'handle'; quantity: number }[]
  edgeBanding: { cabinetId: string; panel: string; lengthMm: number; edge?: string }[]
}

export type NestingResult = {
  sheets: { index: number; panels: unknown[] }[]
  sheetCount: number
  wasteAreaM2: number
  utilizationPercent: number
  sheetWidthMm?: number
  sheetHeightMm?: number
}

export type PriceTable = {
  boardPricePerM2: Record<string, number>
  edgeBandingPricePerMeter: number
  hardwarePrices: { hinge: number; 'drawer-slide': number; handle: number }
  laborMultiplier?: number
  /** Optional direct labor charge per square meter of panel material. */
  laborPricePerPanelM2?: number
}

export type BrazilianMdfThickness = 15 | 18

/** Indicative BRL prices; callers should override with their regional supplier table. */
export const BRAZILIAN_PRICE_PRESETS: Record<BrazilianMdfThickness, PriceTable> = {
  15: {
    boardPricePerM2: { 'mdf-15mm': 140 },
    edgeBandingPricePerMeter: 8,
    hardwarePrices: { hinge: 7, 'drawer-slide': 45, handle: 12 },
    laborPricePerPanelM2: 90,
  },
  18: {
    boardPricePerM2: { 'mdf-18mm': 180 },
    edgeBandingPricePerMeter: 9,
    hardwarePrices: { hinge: 8, 'drawer-slide': 50, handle: 14 },
    laborPricePerPanelM2: 90,
  },
}

export function brazilianPricePreset(
  thicknessMm: BrazilianMdfThickness,
  overrides: Partial<PriceTable> = {},
): PriceTable {
  const base = BRAZILIAN_PRICE_PRESETS[thicknessMm]
  return {
    ...base,
    ...overrides,
    boardPricePerM2: { ...base.boardPricePerM2, ...(overrides.boardPricePerM2 ?? {}) },
    hardwarePrices: { ...base.hardwarePrices, ...(overrides.hardwarePrices ?? {}) },
  }
}

export type QuoteLineItem = {
  label: string
  quantity: number
  unitPrice: number
  total: number
}

export type QuoteReport = {
  lineItems: QuoteLineItem[]
  subtotal: number
  total: number
}

const DEFAULT_SHEET_WIDTH_MM = 2750
const DEFAULT_SHEET_HEIGHT_MM = 1830

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function addLine(
  lineItems: QuoteLineItem[],
  label: string,
  quantity: number,
  unitPrice: number,
): void {
  if (quantity <= 0 || unitPrice === 0) return
  lineItems.push({ label, quantity, unitPrice, total: roundMoney(quantity * unitPrice) })
}

export function calculateQuote(
  cutList: CutListReport,
  nesting: NestingResult,
  prices: PriceTable,
): QuoteReport {
  const lineItems: QuoteLineItem[] = []
  const sheetAreaM2 =
    ((nesting.sheetWidthMm ?? DEFAULT_SHEET_WIDTH_MM) *
      (nesting.sheetHeightMm ?? DEFAULT_SHEET_HEIGHT_MM)) /
    1_000_000
  const materials = new Set(cutList.panels.map((panel) => panel.material ?? 'default'))
  for (const material of materials) {
    addLine(
      lineItems,
      `Chapa (${material})`,
      nesting.sheetCount,
      sheetAreaM2 * (prices.boardPricePerM2[material] ?? 0),
    )
  }

  const edgeMeters = cutList.edgeBanding.reduce((sum, edge) => sum + edge.lengthMm / 1000, 0)
  addLine(lineItems, 'Fita de borda', edgeMeters, prices.edgeBandingPricePerMeter)
  for (const item of ['hinge', 'drawer-slide', 'handle'] as const) {
    const quantity = cutList.hardware
      .filter((hardware) => hardware.item === item)
      .reduce((sum, hardware) => sum + hardware.quantity, 0)
    addLine(lineItems, `Ferragem (${item})`, quantity, prices.hardwarePrices[item])
  }

  if ((prices.laborPricePerPanelM2 ?? 0) > 0) {
    const panelAreaM2 = cutList.panels.reduce(
      (sum, panel) => sum + (panel.widthMm * panel.heightMm * panel.quantity) / 1_000_000,
      0,
    )
    addLine(lineItems, 'Mão de obra', panelAreaM2, prices.laborPricePerPanelM2 ?? 0)
  }

  const subtotal = roundMoney(lineItems.reduce((sum, line) => sum + line.total, 0))
  return {
    lineItems,
    subtotal,
    total: roundMoney(subtotal * (prices.laborMultiplier ?? 1)),
  }
}

export { toQuoteText } from './text'
