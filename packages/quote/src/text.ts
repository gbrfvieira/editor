import type { QuoteReport } from './index'

function money(value: number): string {
  return value.toFixed(2)
}

/** Serializes a quote as a compact, human-readable budget. */
export function toQuoteText(report: QuoteReport): string {
  const lines = ['ORÇAMENTO', '', 'Item | Quantidade | Preço unitário | Total']
  for (const item of report.lineItems) {
    lines.push(`${item.label} | ${item.quantity} | ${money(item.unitPrice)} | ${money(item.total)}`)
  }
  lines.push(
    '',
    `Subtotal |  |  | ${money(report.subtotal)}`,
    `Total |  |  | ${money(report.total)}`,
  )
  return lines.join('\n')
}
