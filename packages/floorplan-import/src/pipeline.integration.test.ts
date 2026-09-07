import { expect, test } from 'bun:test'
import { extractDxfVectorSegments } from '@pascal-app/dxf-vector-extract'
import { detectWalls } from '@pascal-app/wall-detect'
import { toWallNodePatches } from './index'

function dxf(entities: string): string {
  return `0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`
}

function line(layer: string, x1: number, y1: number, x2: number, y2: number): string {
  return `0\nLINE\n8\n${layer}\n10\n${x1}\n20\n${y1}\n11\n${x2}\n21\n${y2}\n`
}

test('runs DXF extraction, wall detection and node patch conversion for a sample house', () => {
  const source = dxf(
    [
      // Outer rectangle, represented by two lines per wall (200 mm apart).
      line('PAREDES', 0, 0, 5, 0),
      line('PAREDES', 0, 0.2, 5, 0.2),
      line('PAREDES', 0, 5, 5, 5),
      line('PAREDES', 0, 4.8, 5, 4.8),
      line('PAREDES', 0, 0, 0, 5),
      line('PAREDES', 0.2, 0, 0.2, 5),
      line('PAREDES', 5, 0, 5, 5),
      line('PAREDES', 4.8, 0, 4.8, 5),
      // Two internal partitions, also double-lined.
      line('PAREDES', 2, 0.2, 2, 4.8),
      line('PAREDES', 2.2, 0.2, 2.2, 4.8),
      line('PAREDES', 0.2, 3, 4.8, 3),
      line('PAREDES', 0.2, 3.2, 4.8, 3.2),
    ].join(''),
  )
  const segments = extractDxfVectorSegments(source).flatMap((layer) =>
    layer.segments.map((segment) => ({ ...segment, layer: layer.layer })),
  )
  const detected = detectWalls(segments, { preferLayerContaining: 'PAREDE' }).walls
  const patches = toWallNodePatches(detected)

  expect(detected).toHaveLength(6)
  expect(patches).toHaveLength(6)
  expect(patches.every((wall) => wall.thickness > 0)).toBe(true)
  expect(patches.some((wall) => Math.abs(wall.end[0] - wall.start[0]) > 4.5)).toBe(true)
  expect(patches.some((wall) => Math.abs(wall.end[1] - wall.start[1]) > 4.5)).toBe(true)
  expect(patches.every((wall) => wall.height === 2.7)).toBe(true)
})
