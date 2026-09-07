import { expect, test } from 'bun:test'
import { commitWalls, type DetectedWall, toWallNodePatches } from './index'

const walls: DetectedWall[] = [
  { start: [0, 0], end: [3, 0], thickness: 0.2, confidence: 0.95 },
  { start: [3, 0], end: [3, 4], thickness: 0.2, confidence: 0.4 },
]

test('filters confidence and produces WallPatch fields', () => {
  expect(toWallNodePatches(walls)).toEqual([
    { start: [0, 0], end: [3, 0], thickness: 0.2, height: 2.7 },
  ])
})

test('commits one wall node per patch through injected scene API', () => {
  const calls: unknown[] = []
  commitWalls(
    toWallNodePatches(walls),
    { createNode: (data, parent) => calls.push([data, parent]) },
    'level-1',
  )
  expect(calls).toEqual([
    [{ type: 'wall', start: [0, 0], end: [3, 0], thickness: 0.2, height: 2.7 }, 'level-1'],
  ])
})
