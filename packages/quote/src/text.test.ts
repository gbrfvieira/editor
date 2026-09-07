import { expect, test } from 'bun:test'
import { toQuoteText } from './text'

test('exports readable line items, subtotal and total', () => {
  const text = toQuoteText({
    lineItems: [{ label: 'Chapa (MDF)', quantity: 2, unitPrice: 100, total: 200 }],
    subtotal: 200,
    total: 260,
  })
  expect(text).toContain('Chapa (MDF) | 2 | 100.00 | 200.00')
  expect(text).toContain('Subtotal |  |  | 200.00')
  expect(text).toContain('Total |  |  | 260.00')
})
