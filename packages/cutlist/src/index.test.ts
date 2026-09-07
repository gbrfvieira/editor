import { expect, test } from 'bun:test'
import { type CabinetLike, createCutList, toCsv } from './index'

const base = (overrides: Partial<CabinetLike> = {}): CabinetLike => ({
  id: 'cabinet',
  width: 0.5,
  depth: 0.6,
  carcassHeight: 0.8,
  boardThickness: 0.018,
  withBottomPanel: true,
  withCountertop: false,
  handleStyle: 'bar',
  ...overrides,
})

test('base-door preset shape produces panels and double-door hardware', () => {
  const report = createCutList([
    base({
      id: 'base-door',
      stack: [
        { type: 'drawer', height: 0.44, drawerCount: 3 },
        { type: 'door', doorType: 'double', shelfCount: 2 },
      ],
    }),
  ])
  expect(report.panels.find((p) => p.label === 'side')?.quantity).toBe(2)
  expect(report.panels.find((p) => p.label === 'shelf')?.quantity).toBe(2)
  expect(report.panels.find((p) => p.label === 'door')?.quantity).toBe(2)
  expect(report.hardware).toContainEqual({ cabinetId: 'base-door', item: 'hinge', quantity: 4 })
  expect(report.hardware).toContainEqual({
    cabinetId: 'base-door',
    item: 'drawer-slide',
    quantity: 3,
  })
})

test('drawer-base and sink-base representative presets', () => {
  const report = createCutList([
    base({ id: 'drawer-base', stack: [{ type: 'drawer', height: 0.8, drawerCount: 3 }] }),
    base({
      id: 'sink-base',
      width: 0.8,
      stack: [{ type: 'door', doorType: 'double' }, { type: 'sink' }],
    }),
  ])
  expect(report.hardware.filter((h) => h.cabinetId === 'drawer-base')).toContainEqual({
    cabinetId: 'drawer-base',
    item: 'drawer-slide',
    quantity: 3,
  })
  expect(
    report.panels.find((p) => p.cabinetId === 'sink-base' && p.label === 'door')?.quantity,
  ).toBe(2)
})

test('toCsv includes all three sections', () => {
  const csv = toCsv(createCutList([base({ stack: [{ type: 'door', doorType: 'single-left' }] })]))
  expect(csv).toContain('[panels]')
  expect(csv).toContain('[hardware]')
  expect(csv).toContain('[edgeBanding]')
  expect(csv).toContain('cabinetId,label,widthMm')
})

test('reports each visible front edge separately', () => {
  const report = createCutList([
    base({ id: 'fronts', stack: [{ type: 'door', doorType: 'single-left', height: 0.8 }] }),
  ])
  expect(report.edgeBanding).toHaveLength(4)
  expect(report.edgeBanding.map((edge) => edge.edge)).toEqual(['top', 'bottom', 'left', 'right'])
  expect(report.edgeBanding.reduce((sum, edge) => sum + edge.lengthMm, 0)).toBeCloseTo(2.6 * 1000)
})

test('uses three hinges for each tall door leaf', () => {
  const report = createCutList([
    base({
      id: 'tall-door',
      stack: [{ type: 'door', doorType: 'double', height: 1.2 }],
    }),
  ])
  expect(report.hardware).toContainEqual({ cabinetId: 'tall-door', item: 'hinge', quantity: 6 })
})
