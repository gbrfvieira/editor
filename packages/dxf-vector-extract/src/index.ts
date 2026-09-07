import DxfParser from 'dxf-parser'

export type Point = [number, number]

export interface DxfSegment {
  start: Point
  end: Point
}

export interface DxfLayerSegments {
  layer: string
  segments: DxfSegment[]
}

type SupportedEntity = {
  type?: string
  layer?: string
  vertices?: Array<{ x?: number; y?: number; bulge?: number }>
  shape?: boolean
  closed?: boolean
}

function pointFromVertex(vertex: { x?: number; y?: number }): Point | undefined {
  if (!Number.isFinite(vertex.x) || !Number.isFinite(vertex.y)) {
    return undefined
  }
  return [vertex.x as number, vertex.y as number]
}

/** Extracts LINE and LWPOLYLINE geometry from an ASCII DXF string. */
export function extractDxfVectorSegments(source: string): DxfLayerSegments[] {
  const document = new DxfParser().parseSync(source)
  const byLayer = new Map<string, DxfSegment[]>()

  const addSegment = (layerName: string, start: Point, end: Point): void => {
    let segments = byLayer.get(layerName)
    if (!segments) {
      segments = []
      byLayer.set(layerName, segments)
    }
    segments.push({ start, end })
  }

  for (const rawEntity of document?.entities ?? []) {
    const entity = rawEntity as SupportedEntity
    const layer = entity.layer ?? '0'
    if (entity.type === 'LINE') {
      const vertices = entity.vertices ?? []
      const start = pointFromVertex(vertices[0] ?? {})
      const end = pointFromVertex(vertices[1] ?? {})
      if (start && end) {
        addSegment(layer, start, end)
      }
      continue
    }

    if (entity.type !== 'LWPOLYLINE') {
      continue
    }

    const vertices = (entity.vertices ?? [])
      .map(pointFromVertex)
      .filter((point): point is Point => point !== undefined)
    for (let index = 1; index < vertices.length; index += 1) {
      addSegment(layer, vertices[index - 1], vertices[index])
    }
    if ((entity.shape === true || entity.closed === true) && vertices.length > 2) {
      addSegment(layer, vertices[vertices.length - 1], vertices[0])
    }
  }

  return [...byLayer].map(([layer, segments]) => ({ layer, segments }))
}

export const extractDxfSegments = extractDxfVectorSegments
