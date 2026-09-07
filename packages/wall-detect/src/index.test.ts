import { expect, test } from 'bun:test'
import { detectWalls, type InputSegment } from './index'

const segment = (start: [number, number], end: [number, number], layer?: string): InputSegment => ({
  start,
  end,
  layer,
})

test('pairs the eight edges of a double-line rectangle into four walls', () => {
  const result = detectWalls([
    segment([0, 0], [4, 0]),
    segment([0, 0.2], [4, 0.2]),
    segment([4, 0], [4, 3]),
    segment([3.8, 0], [3.8, 3]),
    segment([4, 3], [0, 3]),
    segment([4, 2.8], [0, 2.8]),
    segment([0, 3], [0, 0]),
    segment([0.2, 3], [0.2, 0]),
  ])

  expect(result.walls).toHaveLength(4)
  expect(result.walls.every((wall) => Math.abs(wall.thickness - 0.2) < 1e-9)).toBe(true)
  expect(result.walls.every((wall) => wall.confidence > 0.8)).toBe(true)
})

test('keeps an L shape of single lines as direct centerlines', () => {
  const result = detectWalls([segment([0, 0], [2, 0]), segment([2, 0], [2, 2])])

  expect(result.walls).toHaveLength(2)
  expect(result.walls.every((wall) => wall.confidence < 0.5)).toBe(true)
  expect(result.walls.every((wall) => wall.thickness === 0.2)).toBe(true)
})

test('does not pair parallel lines separated by two metres', () => {
  const result = detectWalls([segment([0, 0], [4, 0]), segment([0, 2], [4, 2])])

  expect(result.walls).toHaveLength(2)
  expect(result.walls.every((wall) => wall.confidence < 0.5)).toBe(true)
})

test('snaps nearly touching endpoints to the same point', () => {
  const result = detectWalls([segment([0, 0], [1, 0]), segment([1.03, 0.02], [1.03, 1])])

  const horizontalEnd = result.walls.find(
    (wall) => Math.abs(wall.end[1] - wall.start[1]) < Math.abs(wall.end[0] - wall.start[0]),
  )?.end
  const verticalStart = result.walls.find(
    (wall) => Math.abs(wall.end[0] - wall.start[0]) < Math.abs(wall.end[1] - wall.start[1]),
  )?.start
  expect(horizontalEnd).toEqual(verticalStart)
  expect(horizontalEnd?.[0]).toBeCloseTo(1.015, 12)
  expect(horizontalEnd?.[1]).toBeCloseTo(0.01, 12)
})
