import { expect, test } from 'bun:test'
import { type CutPanel, nestPanels } from './nesting'

const panel = (panelId: string, widthMm: number, heightMm: number, quantity = 1): CutPanel => ({
  panelId,
  cabinetId: 'cabinet',
  label: panelId,
  widthMm,
  heightMm,
  thicknessMm: 18,
  quantity,
})

test('fits four 900 x 600 panels on one default sheet', () => {
  const result = nestPanels([panel('p', 900, 600, 4)])
  expect(result.sheetCount).toBe(1)
  expect(result.sheets[0]?.panels).toHaveLength(4)
  expect(result.sheetWidthMm).toBe(2750)
  expect(result.sheetHeightMm).toBe(1830)
})

test('uses a second sheet when shelves cannot fit', () => {
  const result = nestPanels([panel('p', 2000, 1000, 2)])
  expect(result.sheetCount).toBe(2)
})

test('never overlaps placements on a sheet', () => {
  const result = nestPanels([
    panel('a', 1200, 700),
    panel('b', 900, 600),
    panel('c', 700, 500),
    panel('d', 500, 400),
  ])
  for (const sheet of result.sheets) {
    for (let first = 0; first < sheet.panels.length; first += 1) {
      for (let second = first + 1; second < sheet.panels.length; second += 1) {
        const left = sheet.panels[first]
        const right = sheet.panels[second]
        const separated =
          left.xMm + left.widthMm + 3 <= right.xMm ||
          right.xMm + right.widthMm + 3 <= left.xMm ||
          left.yMm + left.heightMm + 3 <= right.yMm ||
          right.yMm + right.heightMm + 3 <= left.yMm
        expect(separated).toBe(true)
      }
    }
  }
})
