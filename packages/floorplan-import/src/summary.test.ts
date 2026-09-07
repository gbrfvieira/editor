import { expect, test } from 'bun:test'
import { summarizeImport } from './summary'
import type { DetectedWall } from './index'

test('summarizes lengths, confidence and review candidates', () => {
  const walls: DetectedWall[] = [
    { start: [0, 0], end: [3, 0], thickness: 0.2, confidence: 0.95 },
    { start: [3, 0], end: [3, 4], thickness: 0.2, confidence: 0.4 },
  ]
  const summary = summarizeImport(walls)
  expect(summary.totalWalls).toBe(2)
  expect(summary.totalLengthM).toBe(7)
  expect(summary.averageConfidence).toBeCloseTo(0.675)
  expect(summary.needsReview).toEqual([walls[1]])
})

test('returns neutral values for an empty import', () => {
  expect(summarizeImport([])).toEqual({
    totalWalls: 0,
    totalLengthM: 0,
    averageConfidence: 0,
    needsReview: [],
  })
})
