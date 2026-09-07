import { expect, test } from 'bun:test'
import {
  detectWalls,
  detectWindowOpenings,
  type InputSegment,
  mergeNearlyDuplicateWalls,
  type Point,
  type Wall,
} from './index'

const baseWalls: Wall[] = [
  { start: [-3, 0], end: [-0.6, 0], thickness: 0.2, confidence: 0.9 },
  { start: [0.6, 0], end: [3, 0], thickness: 0.2, confidence: 0.9 },
]
const jambs: InputSegment[] = [
  { start: [-0.6, -0.1], end: [-0.6, 0.1] },
  { start: [0.6, -0.1], end: [0.6, 0.1] },
]

function transform(point: Point, angle: number, translation: Point): Point {
  return [
    translation[0] + point[0] * Math.cos(angle) - point[1] * Math.sin(angle),
    translation[1] + point[0] * Math.sin(angle) + point[1] * Math.cos(angle),
  ]
}

test('detects a window from perpendicular jamb lines inside a wall gap', () => {
  const [window] = detectWindowOpenings(jambs, baseWalls)

  expect(window.type).toBe('window')
  expect(window.position[0]).toBeCloseTo(0, 12)
  expect(window.position[1]).toBeCloseTo(0, 12)
  expect(window.width).toBeCloseTo(1.2, 12)
  expect(window.thickness).toBeCloseTo(0.2, 12)
  expect(window.confidence).toBeGreaterThan(0.8)
  expect(window.segmentIndices).toEqual([0, 1])
})

test('accepts one transverse frame line with lower confidence', () => {
  const centerFrame: InputSegment = { start: [0, -0.1], end: [0, 0.1] }
  const [window] = detectWindowOpenings([centerFrame], baseWalls)

  expect(window.width).toBeCloseTo(1.2, 12)
  expect(window.confidence).toBeLessThan(0.8)
  expect(window.segmentIndices).toEqual([0])
})

test('detects translated, rotated and millimetre window geometry without mutating inputs', () => {
  const angle = Math.PI / 3
  const translation: Point = [14, -8]
  const transformedWalls = baseWalls.map((wall) => ({
    ...wall,
    start: transform(wall.start, angle, translation),
    end: transform(wall.end, angle, translation),
  }))
  const transformedJambs = jambs.map((segment) => ({
    start: transform([segment.start[0] * 1000, segment.start[1] * 1000], angle, [14000, -8000]),
    end: transform([segment.end[0] * 1000, segment.end[1] * 1000], angle, [14000, -8000]),
  }))
  const before = JSON.stringify([transformedJambs, transformedWalls])
  const [window] = detectWindowOpenings(transformedJambs, transformedWalls, {
    metersPerUnit: 0.001,
  })

  expect(window.position[0]).toBeCloseTo(translation[0], 10)
  expect(window.position[1]).toBeCloseTo(translation[1], 10)
  expect(Math.sin(window.rotation)).toBeCloseTo(Math.sin(angle), 10)
  expect(Math.cos(window.rotation)).toBeCloseTo(Math.cos(angle), 10)
  expect(JSON.stringify([transformedJambs, transformedWalls])).toBe(before)
})

test('rejects missing gaps, implausible jambs and degenerate input', () => {
  expect(detectWindowOpenings([], baseWalls)).toEqual([])
  expect(detectWindowOpenings([{ start: [0, 0], end: [1, 0] }], baseWalls)).toEqual([])
  expect(
    detectWindowOpenings(jambs, [
      { ...baseWalls[0], end: [0, 0] },
      { ...baseWalls[1], start: [0, 0] },
    ]),
  ).toEqual([])
  expect(
    detectWindowOpenings(jambs, [baseWalls[0], { ...baseWalls[1], start: [0.6, 1], end: [3, 1] }]),
  ).toEqual([])
  expect(detectWindowOpenings([{ start: [0, 0], end: [0, 0] }], baseWalls)).toEqual([])
  expect(
    detectWindowOpenings(
      jambs.map((segment) => ({ ...segment, source: 'arc' })),
      baseWalls,
    ),
  ).toEqual([])
  expect(() => detectWindowOpenings(jambs, baseWalls, { metersPerUnit: 0 })).toThrow()
})

test('filters trivial segments and merges near-collinear overlapping walls', () => {
  const result = detectWalls([
    { start: [0, 0], end: [2, 0], layer: 'PAREDE' },
    { start: [1, 0.01], end: [3, 0.01], layer: 'PAREDE' },
    { start: [8, 8], end: [8.1, 8], layer: 'PAREDE' },
  ])

  expect(result.walls).toHaveLength(1)
  expect(result.walls[0].start[0]).toBeCloseTo(0, 8)
  expect(result.walls[0].end[0]).toBeCloseTo(3, 8)
  expect(result.walls[0].start[1]).toBeCloseTo(result.walls[0].end[1], 12)
})

test('keeps separated or differently directed walls distinct', () => {
  const walls: Wall[] = [
    { start: [0, 0], end: [2, 0], thickness: 0.2, confidence: 0.7 },
    { start: [2.2, 0], end: [4, 0], thickness: 0.2, confidence: 0.7 },
    { start: [0, 0], end: [0, 2], thickness: 0.2, confidence: 0.7 },
  ]
  expect(mergeNearlyDuplicateWalls(walls)).toHaveLength(3)
})

test('reduces a 1201-segment CAD-like fixture to 160 meaningful walls', () => {
  const meaningful: InputSegment[] = Array.from({ length: 160 }, (_, index) => ({
    start: [0, index],
    end: [4, index],
    layer: 'ALV-PAREDE',
  }))
  const duplicates: InputSegment[] = meaningful.map((segment) => ({
    ...segment,
    start: [segment.start[0] + 0.5, segment.start[1] + 0.01],
    end: [segment.end[0] - 0.5, segment.end[1] + 0.01],
  }))
  const noise: InputSegment[] = Array.from({ length: 881 }, (_, index) => ({
    start: [index, -10],
    end: [index + 0.1, -10],
    layer: 'ALV-PAREDE',
  }))

  const result = detectWalls([...meaningful, ...duplicates, ...noise])
  expect(meaningful.length + duplicates.length + noise.length).toBe(1201)
  expect(result.walls).toHaveLength(160)
})

test('allows the minimum segment length to be configured', () => {
  const tiny: InputSegment = { start: [0, 0], end: [0.1, 0] }
  expect(detectWalls([tiny]).walls).toEqual([])
  expect(detectWalls([tiny], { minSegmentLengthM: 0.05 }).walls).toHaveLength(1)
})
