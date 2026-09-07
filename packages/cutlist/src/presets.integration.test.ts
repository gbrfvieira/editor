import { expect, test } from 'bun:test'
import { CabinetNode } from '@pascal-app/core'
import { CABINET_PRESETS } from '../../nodes/src/cabinet/presets'
import { createCutList } from './index'

test('every built-in cabinet preset yields only positive cut panels', () => {
  const run = CabinetNode.parse({
    id: 'cabinet_cutlist-preset-run',
    width: 0.8,
    depth: 0.6,
    carcassHeight: 0.8,
    boardThickness: 0.018,
  })
  for (const preset of CABINET_PRESETS) {
    const module = { id: `module-${preset.id}`, ...preset.createPatch(run) }
    const report = createCutList([module])
    expect(report.panels.length).toBeGreaterThan(0)
    expect(report.panels.every((panel) => panel.widthMm > 0 && panel.heightMm > 0)).toBe(true)
  }
})
