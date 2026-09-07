import { expect, test } from 'bun:test'
import {
  detectDoorOpenings,
  detectWalls,
  type InputSegment,
  suggestCadUnit,
  type Wall,
} from './index'

const wall: Wall = { start: [-3, 0], end: [0, 0], thickness: 0.2, confidence: 0.9 }
const arc = {
  center: [0, 0] as [number, number],
  radius: 0.9,
  startAngle: 0,
  endAngle: Math.PI / 2,
}
const leaf: InputSegment = { start: [0, 0], end: [0, 0.9] }

test('detects an opening at a wall end with a quarter arc and radial leaf', () => {
  const [door] = detectDoorOpenings([arc], [leaf], [wall])
  expect(door.type).toBe('door')
  expect(door.position[0]).toBeCloseTo(0.45)
  expect(door.position[1]).toBeCloseTo(0)
  expect(door.width).toBeCloseTo(0.9)
  expect(door.rotation).toBeCloseTo(0)
  expect(door.leafSegmentIndex).toBe(0)
})

test('requires a matching leaf, plausible radius, quarter sweep and a nearby aligned wall', () => {
  expect(detectDoorOpenings([arc], [], [wall])).toEqual([])
  expect(detectDoorOpenings([arc], [leaf], [])).toEqual([])
  expect(detectDoorOpenings([{ ...arc, radius: 4 }], [leaf], [wall])).toEqual([])
  expect(detectDoorOpenings([{ ...arc, endAngle: Math.PI }], [leaf], [wall])).toEqual([])
  expect(detectDoorOpenings([arc], [leaf], [{ ...wall, start: [-3, 2], end: [0, 2] }])).toEqual([])
  expect(detectDoorOpenings([arc], [leaf], [{ ...wall, start: [0, -3], end: [0, 0] }])).toEqual([])
  expect(detectDoorOpenings([arc], [{ ...leaf, source: 'arc' }], [wall])).toEqual([])
})

test('supports millimetres, reversed leaf endpoints, wraparound arcs and duplicate symbols', () => {
  const a = { ...arc, radius: 900, startAngle: Math.PI * 1.5, endAngle: 0 }
  const result = detectDoorOpenings([a, a], [{ start: [0, -900], end: [0, 0] }], [wall], {
    metersPerUnit: 0.001,
  })
  expect(result).toHaveLength(1)
  expect(result[0].position[0]).toBeCloseTo(0.45)
})

test('only clear wall layers increase single-line confidence, not arbitrary preferred layers', () => {
  for (const layer of ['PAREDES', 'arq-parede', 'P-PAREDE', 'ALV', 'ALVENARIA', 'Walls']) {
    expect(detectWalls([{ ...leaf, layer }]).walls[0].confidence).toBe(0.7)
  }
  expect(
    detectWalls([{ ...leaf, layer: 'TEXT' }], { preferLayerContaining: 'TEXT' }).walls[0]
      .confidence,
  ).toBe(0.35)
  expect(detectWalls([{ ...leaf, layer: 'PAREDE', source: 'arc' }]).walls[0].confidence).toBe(0.35)
})

test('suggests metres, centimetres and millimetres from wall lengths without mutation', () => {
  for (const [unit, scale] of [
    ['m', 1],
    ['cm', 100],
    ['mm', 1000],
  ] as const) {
    const segments: InputSegment[] = [2, 4, 5].map((length) => ({
      start: [0, 0],
      end: [length * scale, 0],
      layer: 'PAREDE',
    }))
    const before = JSON.stringify(segments)
    expect(suggestCadUnit(segments).unit).toBe(unit)
    expect(JSON.stringify(segments)).toBe(before)
  }
  expect(suggestCadUnit([], 4).unit).toBe('mm')
  expect(suggestCadUnit([]).source).toBe('insufficient-data')
  expect(suggestCadUnit([leaf, leaf, leaf].map((s) => ({ ...s, end: [0, 0.01] }))).confidence).toBe(
    0,
  )
})

test('handles translated and rotated door geometry without changing inputs', () => {
  const angle = Math.PI / 6
  const rotate = ([x, y]: [number, number]): [number, number] => [
    12 + x * Math.cos(angle) - y * Math.sin(angle),
    -7 + x * Math.sin(angle) + y * Math.cos(angle),
  ]
  const a = { ...arc, center: rotate(arc.center), startAngle: angle, endAngle: angle + Math.PI / 2 }
  const s = { start: rotate(leaf.start), end: rotate(leaf.end) }
  const w = { ...wall, start: rotate(wall.start), end: rotate(wall.end) }
  const before = JSON.stringify([a, s, w])
  const [door] = detectDoorOpenings([a], [s], [w])
  expect(door.rotation).toBeCloseTo(angle, 12)
  expect(door.position[0]).toBeCloseTo(rotate([0.45, 0])[0], 12)
  expect(door.position[1]).toBeCloseTo(rotate([0.45, 0])[1], 12)
  expect(JSON.stringify([a, s, w])).toBe(before)
  expect(detectDoorOpenings([{ ...arc, radius: NaN }], [leaf], [wall])).toEqual([])
  expect(() => detectDoorOpenings([arc], [leaf], [wall], { metersPerUnit: 0 })).toThrow()
})
