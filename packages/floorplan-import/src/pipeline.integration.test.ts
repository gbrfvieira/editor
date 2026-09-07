import { expect, test } from 'bun:test'
import { extractDxfVectorSegments } from '../../dxf-vector-extract/src/index'
import { detectWalls } from '../../wall-detect/src/index'
import { toWallNodePatches } from './index'

function houseDxf(): string {
  const lines = [
    ['PAREDES', 0, 0, 10, 0],
    ['PAREDES', 10, 0, 10, 8],
    ['PAREDES', 10, 8, 0, 8],
    ['PAREDES', 0, 8, 0, 0],
    ['PAREDES', 3, 0, 3, 8],
    ['PAREDES', 7, 0, 7, 8],
    ['PAREDES', 0, 4, 3, 4],
  ]
  const entities = lines
    .map(
      ([layer, x1, y1, x2, y2]) =>
        `0\nLINE\n8\n${layer}\n10\n${x1}\n20\n${y1}\n11\n${x2}\n21\n${y2}\n`,
    )
    .join('')
  return `0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`
}

test('runs DXF extraction, wall detection and node patch conversion end to end', () => {
  const grouped = extractDxfVectorSegments(houseDxf())
  const sourceSegments = grouped.flatMap((group) =>
    group.segments.map((segment) => ({ ...segment, layer: group.layer })),
  )
  const detected = detectWalls(sourceSegments, { preferLayerContaining: 'paredes' }).walls
  const patches = toWallNodePatches(detected, { minConfidence: 0.3 })

  expect(grouped).toHaveLength(1)
  expect(detected).toHaveLength(7)
  expect(patches).toHaveLength(7)
  expect(patches.every((patch) => patch.height === 2.7 && patch.thickness === 0.2)).toBe(true)
  expect(
    patches
      .map((patch) => Math.hypot(patch.end[0] - patch.start[0], patch.end[1] - patch.start[1]))
      .sort((a, b) => a - b),
  ).toEqual([3, 8, 8, 8, 8, 10, 10])
})
