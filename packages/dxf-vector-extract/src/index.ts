import DxfParser from 'dxf-parser'

export type Point = [number, number]

export interface DxfSegment {
  start: Point
  end: Point
}

export interface DxfOpening {
  type: 'door' | 'window'
  position: Point
  width: number
  rotation: number
  blockName: string
}

export interface DxfLayerSegments {
  layer: string
  segments: DxfSegment[]
  openings?: DxfOpening[]
}

type SupportedEntity = {
  type?: string
  layer?: string
  vertices?: Array<{ x?: number; y?: number; bulge?: number }>
  shape?: boolean
  closed?: boolean
  center?: { x?: number; y?: number }
  radius?: number
  startAngle?: number
  endAngle?: number
  name?: string
  position?: { x?: number; y?: number }
  rotation?: number
  xScale?: number
}

function pointFromVertex(vertex: { x?: number; y?: number }): Point | undefined {
  if (!Number.isFinite(vertex.x) || !Number.isFinite(vertex.y)) {
    return undefined
  }
  return [vertex.x as number, vertex.y as number]
}

function segmentsForArc(
  center: Point,
  radius: number,
  startAngle: number,
  endAngle: number,
  tolerance: number,
): DxfSegment[] {
  if (!Number.isFinite(radius) || radius <= 0) return []
  let sweep = endAngle - startAngle
  if (sweep <= 0) sweep += Math.PI * 2
  const count = Math.max(2, Math.ceil((Math.abs(sweep) * radius) / tolerance))
  const points = Array.from({ length: count + 1 }, (_, index) => {
    const angle = startAngle + (sweep * index) / count
    return [center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)] as Point
  })
  return points.slice(1).map((end, index) => ({ start: points[index], end }))
}

function segmentsForBulge(
  start: Point,
  end: Point,
  bulge: number | undefined,
  tolerance: number,
): DxfSegment[] {
  if (!Number.isFinite(bulge) || !bulge) return [{ start, end }]
  const sweep = 4 * Math.atan(bulge as number)
  const chord = Math.hypot(end[0] - start[0], end[1] - start[1])
  if (chord === 0 || Math.abs(sweep) < 1e-9) return []
  const radius = Math.abs(chord / (2 * Math.sin(sweep / 2)))
  const midpoint: Point = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2]
  const normal: Point = [-(end[1] - start[1]) / chord, (end[0] - start[0]) / chord]
  const offset = chord / (2 * Math.tan(sweep / 2))
  const center: Point = [midpoint[0] + normal[0] * offset, midpoint[1] + normal[1] * offset]
  const startAngle = Math.atan2(start[1] - center[1], start[0] - center[0])
  const count = Math.max(2, Math.ceil((Math.abs(sweep) * radius) / tolerance))
  const points = Array.from({ length: count + 1 }, (_, index) => {
    const angle = startAngle + (sweep * index) / count
    return [center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)] as Point
  })
  points[0] = start
  points[points.length - 1] = end
  return points.slice(1).map((point, index) => ({ start: points[index], end: point }))
}

function openingType(name: string | undefined): DxfOpening['type'] | undefined {
  const normalized = name?.toLocaleUpperCase() ?? ''
  if (normalized.includes('PORTA') || normalized.includes('DOOR')) return 'door'
  if (normalized.includes('JANELA') || normalized.includes('WINDOW')) return 'window'
  return undefined
}

function openingWidth(name: string | undefined, type: DxfOpening['type'], scale: number): number {
  const encoded = name?.match(/(?:^|[_ -])(\d{3,4})(?:$|[_ -])/u)?.[1]
  if (encoded) {
    const value = Number(encoded)
    if (value > 0) return (value > 10 ? value / 1000 : value) * scale
  }
  return (type === 'door' ? 0.9 : 1.2) * scale
}

/** Extracts lines, flattened arcs/bulges and named door/window inserts. */
export function extractDxfVectorSegments(
  source: string,
  options: { curveTolerance?: number } = {},
): DxfLayerSegments[] {
  const curveTolerance = options.curveTolerance ?? 0.02
  if (!Number.isFinite(curveTolerance) || curveTolerance <= 0) {
    throw new RangeError('curveTolerance must be a positive, finite number')
  }
  const document = new DxfParser().parseSync(source)
  const byLayer = new Map<string, DxfSegment[]>()
  const openingsByLayer = new Map<string, DxfOpening[]>()

  const addSegment = (layerName: string, start: Point, end: Point): void => {
    let segments = byLayer.get(layerName)
    if (!segments) {
      segments = []
      byLayer.set(layerName, segments)
    }
    segments.push({ start, end })
  }

  const addOpening = (layerName: string, opening: DxfOpening): void => {
    const openings = openingsByLayer.get(layerName) ?? []
    openings.push(opening)
    openingsByLayer.set(layerName, openings)
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

    if (entity.type === 'ARC') {
      const center = pointFromVertex(entity.center ?? {})
      if (
        center &&
        entity.radius !== undefined &&
        entity.startAngle !== undefined &&
        entity.endAngle !== undefined
      ) {
        for (const segment of segmentsForArc(
          center,
          entity.radius,
          entity.startAngle,
          entity.endAngle,
          curveTolerance,
        )) {
          addSegment(layer, segment.start, segment.end)
        }
      }
      continue
    }

    if (entity.type === 'INSERT') {
      const type = openingType(entity.name)
      const position = pointFromVertex(entity.position ?? {})
      if (type && position) {
        addOpening(layer, {
          type,
          position,
          width: openingWidth(entity.name, type, Math.abs(entity.xScale ?? 1)),
          rotation: ((entity.rotation ?? 0) * Math.PI) / 180,
          blockName: entity.name ?? '',
        })
      }
      continue
    }

    if (entity.type !== 'LWPOLYLINE') {
      continue
    }

    const vertices = (entity.vertices ?? []).flatMap((vertex) => {
      const point = pointFromVertex(vertex)
      return point ? [{ point, bulge: vertex.bulge }] : []
    })
    for (let index = 1; index < vertices.length; index += 1) {
      for (const segment of segmentsForBulge(
        vertices[index - 1].point,
        vertices[index].point,
        vertices[index - 1].bulge,
        curveTolerance,
      )) {
        addSegment(layer, segment.start, segment.end)
      }
    }
    if ((entity.shape === true || entity.closed === true) && vertices.length > 2) {
      for (const segment of segmentsForBulge(
        vertices[vertices.length - 1].point,
        vertices[0].point,
        vertices[vertices.length - 1].bulge,
        curveTolerance,
      )) {
        addSegment(layer, segment.start, segment.end)
      }
    }
  }

  const layerNames = new Set([...byLayer.keys(), ...openingsByLayer.keys()])
  return [...layerNames].map((layer) => {
    const segments = byLayer.get(layer) ?? []
    const openings = openingsByLayer.get(layer)
    return openings ? { layer, segments, openings } : { layer, segments }
  })
}

export const extractDxfSegments = extractDxfVectorSegments
