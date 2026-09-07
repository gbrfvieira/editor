import { expect, test } from 'bun:test'
import type { NestingResult } from './nesting'
import { toNestingSvg } from './svg'

test('draws a sheet and one rectangle per nested panel', () => {
  const nesting: NestingResult = {
    sheets: [
      {
        index: 0,
        panels: [
          { panelId: 'side-1', widthMm: 600, heightMm: 800, rotated: false, xMm: 0, yMm: 0 },
          { panelId: 'door-1', widthMm: 500, heightMm: 700, rotated: true, xMm: 603, yMm: 0 },
        ],
      },
    ],
    sheetCount: 1,
    wasteAreaM2: 0,
    utilizationPercent: 0,
  }
  const svg = toNestingSvg(nesting, { widthMm: 2750, heightMm: 1830 })
  expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
  expect((svg.match(/data-panel-id=/g) ?? []).length).toBe(2)
  expect(svg).toContain('side-1')
  expect(svg).toContain('door-1')
  expect(svg.endsWith('</svg>')).toBe(true)
})
