import { expect, test } from 'bun:test'
import {
  commitWalls,
  type CommittedWall,
  type DetectedOpening,
  type DetectedWall,
  matchOpeningsToWalls,
  toWallNodePatches,
} from './index'

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

const committedWalls: CommittedWall[] = [
  { id: 'wall_a', start: [0, 0], end: [5, 0], thickness: 0.2 },
  { id: 'wall_b', start: [5, 0], end: [5, 4], thickness: 0.2 },
]

test('matches an opening sitting on a wall centerline', () => {
  const openings: DetectedOpening[] = [{ type: 'door', position: [2.5, 0], width: 0.9 }]
  expect(matchOpeningsToWalls(openings, committedWalls)).toEqual([
    { wallId: 'wall_a', type: 'door', localX: 2.5, width: 0.9 },
  ])
})

test('picks the nearer of two candidate walls', () => {
  const openings: DetectedOpening[] = [{ type: 'window', position: [5, 2], width: 1.2 }]
  expect(matchOpeningsToWalls(openings, committedWalls)).toEqual([
    { wallId: 'wall_b', type: 'window', localX: 2, width: 1.2 },
  ])
})

test('clamps localX so the opening does not spill past the wall end', () => {
  const openings: DetectedOpening[] = [{ type: 'door', position: [0.1, 0], width: 0.9 }]
  expect(matchOpeningsToWalls(openings, committedWalls)).toEqual([
    { wallId: 'wall_a', type: 'door', localX: 0.45, width: 0.9 },
  ])
})

test('drops an opening too far from every wall', () => {
  const openings: DetectedOpening[] = [{ type: 'door', position: [2.5, 3], width: 0.9 }]
  expect(matchOpeningsToWalls(openings, committedWalls)).toEqual([])
})

test('drops an opening wider than any candidate wall', () => {
  const shortWalls: CommittedWall[] = [
    { id: 'wall_c', start: [0, 0], end: [0.5, 0], thickness: 0.1 },
  ]
  const openings: DetectedOpening[] = [{ type: 'door', position: [0.25, 0], width: 0.9 }]
  expect(matchOpeningsToWalls(openings, shortWalls)).toEqual([])
})
