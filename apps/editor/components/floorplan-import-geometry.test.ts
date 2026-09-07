import { expect, test } from 'bun:test'
import { recenterSegments, sameSegmentGeometry } from './floorplan-import-geometry'

test('recenters PDF or DXF segments around their bounding-box center', () => {
  const input = [
    { start: [100, 200] as [number, number], end: [110, 200] as [number, number], page: 2 },
    { start: [110, 200] as [number, number], end: [110, 206] as [number, number], page: 2 },
  ]
  const before = JSON.stringify(input)
  const result = recenterSegments(input)

  expect(result.offset).toEqual([105, 203])
  expect(result.segments).toEqual([
    { start: [-5, -3], end: [5, -3], page: 2 },
    { start: [5, -3], end: [5, 3], page: 2 },
  ])
  expect(JSON.stringify(input)).toBe(before)
})

test('handles empty and invalid geometry without throwing', () => {
  expect(recenterSegments([])).toEqual({ segments: [], offset: [0, 0] })
  const invalid = [{ start: [Number.NaN, 0] as [number, number], end: [1, 1] as [number, number] }]
  expect(recenterSegments(invalid)).toEqual({ segments: invalid, offset: [0, 0] })
})

test('matches window symbol walls independent of endpoint order', () => {
  const wall = { start: [0, -0.1] as [number, number], end: [0, 0.1] as [number, number] }
  expect(
    sameSegmentGeometry(wall, {
      start: [0.01, 0.1],
      end: [-0.01, -0.1],
    }),
  ).toBe(true)
  expect(sameSegmentGeometry(wall, { start: [1, 0], end: [1, 0.2] })).toBe(false)
})
