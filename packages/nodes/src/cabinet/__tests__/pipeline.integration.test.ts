import { expect, test } from 'bun:test'
import { CabinetModuleNode, CabinetNode } from '@pascal-app/core'
import { createCutList, nestPanels } from '@pascal-app/cutlist'
import { calculateQuote } from '@pascal-app/quote'
import { CABINET_PRESETS } from '../presets'

test('runs cabinet creation through preset, cutlist and quote', () => {
  const run = CabinetNode.parse({
    id: 'cabinet_run-e2e',
    width: 0.8,
    depth: 0.6,
    carcassHeight: 0.8,
    boardThickness: 0.018,
    withBottomPanel: true,
    withCountertop: false,
    handleStyle: 'bar',
  })
  const preset = CABINET_PRESETS.find((candidate) => candidate.id === 'base-door')!
  const module = CabinetModuleNode.parse({
    id: 'cabinet-module_e2e',
    parentId: run.id,
    ...preset.createPatch(run),
    boardThickness: run.boardThickness,
  })

  const cutList = createCutList([module])
  const nesting = nestPanels(cutList.panels)
  const quote = calculateQuote(cutList, nesting, {
    boardPricePerM2: { default: 80 },
    edgeBandingPricePerMeter: 3,
    hardwarePrices: { hinge: 4, 'drawer-slide': 8, handle: 5 },
    laborMultiplier: 1.3,
  })

  expect(module.type).toBe('cabinet-module')
  expect(cutList.panels.length).toBeGreaterThan(0)
  expect(cutList.panels.every((panel) => panel.widthMm > 0 && panel.heightMm > 0)).toBe(true)
  expect(nesting.sheetCount).toBeGreaterThan(0)
  expect(quote.total).toBeGreaterThan(0)
})
