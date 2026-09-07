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
  edgeBanding: { cabinetId: string; panel: string; lengthMm: number }[]
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

function addLine(
  lineItems: QuoteLineItem[],
  label: string,
  quantity: number,
  unitPrice: number,
): void {
  if (quantity <= 0 || unitPrice === 0) return
  lineItems.push({ label, quantity, unitPrice, total: quantity * unitPrice })
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
    const unitPrice = sheetAreaM2 * (prices.boardPricePerM2[material] ?? 0)
    addLine(lineItems, `Chapa (${material})`, nesting.sheetCount, unitPrice)
  }

  const edgeMeters = cutList.edgeBanding.reduce((sum, edge) => sum + edge.lengthMm / 1000, 0)
  addLine(lineItems, 'Fita de borda', edgeMeters, prices.edgeBandingPricePerMeter)
  for (const item of ['hinge', 'drawer-slide', 'handle'] as const) {
    const quantity = cutList.hardware
      .filter((hardware) => hardware.item === item)
      .reduce((sum, hardware) => sum + hardware.quantity, 0)
    addLine(lineItems, `Ferragem (${item})`, quantity, prices.hardwarePrices[item])
  }

  const subtotal = lineItems.reduce((sum, line) => sum + line.total, 0)
  return {
    lineItems,
    subtotal,
    total: subtotal * (prices.laborMultiplier ?? 1),
  }
}

export { toQuoteText } from './text'
