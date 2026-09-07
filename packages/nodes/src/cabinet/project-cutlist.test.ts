import { expect, test } from 'bun:test'
import { createCutList, nestPanels } from '@pascal-app/cutlist'
import { brazilianPricePreset, calculateQuote } from '@pascal-app/quote'
import { collectProjectCabinets, type SceneCabinetCandidate } from './project-cutlist'

const cabinet = (
  id: string,
  type: 'cabinet' | 'cabinet-module',
  children: string[] = [],
): SceneCabinetCandidate => ({
  id,
  type,
  children,
  width: 0.6,
  depth: 0.6,
  carcassHeight: 0.8,
  boardThickness: 0.018,
})

test('collects all modules and standalone cabinets without counting parent runs twice', () => {
  const nodes: SceneCabinetCandidate[] = [
    cabinet('run-kitchen', 'cabinet', ['module-kitchen-a', 'module-kitchen-b']),
    cabinet('module-kitchen-a', 'cabinet-module'),
    cabinet('module-kitchen-b', 'cabinet-module'),
    cabinet('closet-legacy', 'cabinet'),
    { id: 'wall-1', type: 'wall' },
  ]

  expect(collectProjectCabinets(nodes).map((node) => node.id)).toEqual([
    'module-kitchen-a',
    'module-kitchen-b',
    'closet-legacy',
  ])
})

test('ignores malformed cabinet data instead of producing invalid panels', () => {
  expect(collectProjectCabinets([{ id: 'broken', type: 'cabinet' }])).toEqual([])
})

test('feeds all project cabinets into one cut list, nesting and quote', () => {
  const projectCabinets = collectProjectCabinets([
    cabinet('kitchen', 'cabinet-module'),
    cabinet('closet', 'cabinet-module'),
  ])
  const report = createCutList(projectCabinets)
  const nesting = nestPanels(report.panels)
  const quote = calculateQuote(report, nesting, brazilianPricePreset(18))

  expect(new Set(report.panels.map((panel) => panel.cabinetId))).toEqual(
    new Set(['kitchen', 'closet']),
  )
  expect(nesting.sheetCount).toBeGreaterThan(0)
  expect(quote.total).toBeGreaterThan(0)
})
