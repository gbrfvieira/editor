import { expect, test } from 'bun:test'
import { extractDxfVectorSegments } from './index'

function dxf(entities: string): string {
  return `0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`
}

test('extracts a single LINE', () => {
  const result = extractDxfVectorSegments(dxf('0\nLINE\n8\nWalls\n10\n1.5\n20\n2\n11\n8\n21\n2\n'))

  expect(result).toEqual([{ layer: 'Walls', segments: [{ start: [1.5, 2], end: [8, 2] }] }])
})

test('extracts the four sides of a closed LWPOLYLINE', () => {
  const result = extractDxfVectorSegments(
    dxf(
      '0\nLWPOLYLINE\n8\nPAREDE\n90\n4\n70\n1\n10\n0\n20\n0\n10\n4\n20\n0\n10\n4\n20\n3\n10\n0\n20\n3\n',
    ),
  )

  expect(result).toEqual([
    {
      layer: 'PAREDE',
      segments: [
        { start: [0, 0], end: [4, 0] },
        { start: [4, 0], end: [4, 3] },
        { start: [4, 3], end: [0, 3] },
        { start: [0, 3], end: [0, 0] },
      ],
    },
  ])
})

test('keeps entities grouped by layer in first-seen order', () => {
  const result = extractDxfVectorSegments(
    dxf(
      '0\nLINE\n8\nA\n10\n0\n20\n0\n11\n1\n21\n0\n' +
        '0\nLINE\n8\nB\n10\n0\n20\n1\n11\n1\n21\n1\n' +
        '0\nLINE\n8\nA\n10\n2\n20\n0\n11\n3\n21\n0\n',
    ),
  )

  expect(result).toEqual([
    {
      layer: 'A',
      segments: [
        { start: [0, 0], end: [1, 0] },
        { start: [2, 0], end: [3, 0] },
      ],
    },
    { layer: 'B', segments: [{ start: [0, 1], end: [1, 1] }] },
  ])
})

test('ignores unsupported entities without breaking the parse', () => {
  const result = extractDxfVectorSegments(
    dxf(
      '0\nLINE\n8\nWALL\n10\n0\n20\n0\n11\n2\n21\n0\n' +
        '0\nTEXT\n8\nLABELS\n10\n1\n20\n1\n40\n0.2\n1\nDoor\n' +
        '0\nLINE\n8\nWALL\n10\n2\n20\n0\n11\n2\n21\n2\n',
    ),
  )

  expect(result).toEqual([
    {
      layer: 'WALL',
      segments: [
        { start: [0, 0], end: [2, 0] },
        { start: [2, 0], end: [2, 2] },
      ],
    },
  ])
})
