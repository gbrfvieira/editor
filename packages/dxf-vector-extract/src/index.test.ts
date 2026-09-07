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

test('extracts named door and window INSERT openings', () => {
  const result = extractDxfVectorSegments(
    dxf(
      '0\nINSERT\n8\nPAREDES\n2\nPORTA_900\n10\n2\n20\n3\n50\n90\n' +
        '0\nINSERT\n8\nESQUADRIAS\n2\nWINDOW_1200\n10\n4\n20\n5\n',
    ),
  )
  expect(result).toEqual([
    {
      layer: 'PAREDES',
      segments: [],
      openings: [
        {
          type: 'door',
          position: [2, 3],
          width: 0.9,
          rotation: Math.PI / 2,
          blockName: 'PORTA_900',
        },
      ],
    },
    {
      layer: 'ESQUADRIAS',
      segments: [],
      openings: [
        {
          type: 'window',
          position: [4, 5],
          width: 1.2,
          rotation: 0,
          blockName: 'WINDOW_1200',
        },
      ],
    },
  ])
})

test('flattens ARC and bulged polyline entities', () => {
  const result = extractDxfVectorSegments(
    dxf(
      '0\nARC\n8\nCURVES\n10\n0\n20\n0\n40\n1\n50\n0\n51\n90\n' +
        '0\nLWPOLYLINE\n8\nCURVES\n90\n2\n10\n0\n20\n0\n42\n1\n10\n2\n20\n0\n',
    ),
    { curveTolerance: 0.1 },
  )
  expect(result[0]?.segments.length).toBeGreaterThan(2)
  expect(result[0]?.segments.every((segment) => Number.isFinite(segment.end[0]))).toBe(true)
})
