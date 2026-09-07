import DxfParser from 'dxf-parser'

export type Point = [number, number]

export interface DxfSegment {
  start: Point
  end: Point
  source?: 'arc' | 'bulge'
}

export interface DxfArc {
  center: Point
  radius: number
  startAngle: number
  endAngle: number
  layer: string
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
  arcs?: DxfArc[]
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
  yScale?: number
}

type DxfBlock = { entities?: unknown[] }
type DxfDocument = {
  entities?: unknown[]
  blocks?: Record<string, DxfBlock>
  header?: Record<string, unknown>
  tables?: { layer?: { layers?: Record<string, unknown> } }
}

/** 2D affine matrix [a, b, c, d, e, f]: x' = a*x + c*y + e, y' = b*x + d*y + f. */
type Mat = [number, number, number, number, number, number]

const IDENTITY_MATRIX: Mat = [1, 0, 0, 1, 0, 0]
const MAX_BLOCK_DEPTH = 12

function applyMatrix(m: Mat, p: Point): Point {
  return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]]
}

/** Composes `outer ∘ inner` — applying the result to a point first applies `inner`, then `outer`. */
function composeMatrix(outer: Mat, inner: Mat): Mat {
  const [a1, b1, c1, d1, e1, f1] = outer
  const [a2, b2, c2, d2, e2, f2] = inner
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ]
}

/** Scale, then rotate, then translate — matches DXF INSERT semantics. */
function insertMatrix(position: Point, rotationDeg: number, xScale: number, yScale: number): Mat {
  const rot = (rotationDeg * Math.PI) / 180
  const cos = Math.cos(rot)
  const sin = Math.sin(rot)
  return [cos * xScale, sin * xScale, -sin * yScale, cos * yScale, position[0], position[1]]
}

/** Approximate scalar magnitude of a matrix's linear part — exact for uniform scale/rotation. */
function matrixScale(m: Mat): number {
  return Math.hypot(m[0], m[1])
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
  if (![radius, startAngle, endAngle].every(Number.isFinite) || radius <= 0) return []
  let sweep = endAngle - startAngle
  if (sweep <= 0) sweep += Math.PI * 2
  const count = Math.min(4096, Math.max(2, Math.ceil((Math.abs(sweep) * radius) / tolerance)))
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
  const count = Math.min(4096, Math.max(2, Math.ceil((Math.abs(sweep) * radius) / tolerance)))
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

/**
 * Extracts lines, flattened arcs/bulges and named door/window inserts.
 *
 * Architecture DWG/DXF files very commonly draw the whole floor plan (or
 * large chunks of it) inside a BLOCK definition placed once via INSERT,
 * rather than as loose top-level entities — sometimes nested more than one
 * level deep. Every INSERT is resolved recursively (depth-capped, cycle-safe)
 * so geometry buried inside blocks is not silently dropped.
 */
export function extractDxfVectorSegments(
  source: string,
  options: { curveTolerance?: number } = {},
): DxfLayerSegments[] {
  const curveTolerance = options.curveTolerance ?? 0.02
  if (!Number.isFinite(curveTolerance) || curveTolerance <= 0) {
    throw new RangeError('curveTolerance must be a positive, finite number')
  }
  const document = new DxfParser().parseSync(source) as DxfDocument
  const blocksByName = document?.blocks ?? {}
  const byLayer = new Map<string, DxfSegment[]>()
  const openingsByLayer = new Map<string, DxfOpening[]>()
  const arcsByLayer = new Map<string, DxfArc[]>()

  const addSegment = (
    layerName: string,
    start: Point,
    end: Point,
    source?: DxfSegment['source'],
  ): void => {
    let segments = byLayer.get(layerName)
    if (!segments) {
      segments = []
      byLayer.set(layerName, segments)
    }
    segments.push({ start, end, ...(source ? { source } : {}) })
  }

  const addOpening = (layerName: string, opening: DxfOpening): void => {
    const openings = openingsByLayer.get(layerName) ?? []
    openings.push(opening)
    openingsByLayer.set(layerName, openings)
  }

  const walkEntities = (entities: unknown[], transform: Mat, depth: number, path: Set<string>) => {
    for (const rawEntity of entities) {
      const entity = rawEntity as SupportedEntity
      const layer = entity.layer ?? '0'
      const scale = matrixScale(transform)

      if (entity.type === 'LINE') {
        const vertices = entity.vertices ?? []
        const start = pointFromVertex(vertices[0] ?? {})
        const end = pointFromVertex(vertices[1] ?? {})
        if (start && end) addSegment(layer, applyMatrix(transform, start), applyMatrix(transform, end))
        continue
      }

      if (entity.type === 'ARC') {
        const center = pointFromVertex(entity.center ?? {})
        if (
          center &&
          entity.radius !== undefined &&
          entity.startAngle !== undefined &&
          entity.endAngle !== undefined &&
          [entity.radius, entity.startAngle, entity.endAngle].every(Number.isFinite) &&
          entity.radius > 0
        ) {
          const worldCenter = applyMatrix(transform, center)
          const worldRadius = entity.radius * scale
          // Uniform-scale/rotation approximation: a mirrored INSERT (negative
          // xScale/yScale) would also reverse the arc's sweep direction, which
          // this doesn't attempt to correct — mirrored block inserts are rare
          // in practice for architectural symbols.
          const worldRotation = Math.atan2(transform[1], transform[0])
          arcsByLayer.set(layer, [
            ...(arcsByLayer.get(layer) ?? []),
            {
              center: worldCenter,
              radius: worldRadius,
              startAngle: entity.startAngle + worldRotation,
              endAngle: entity.endAngle + worldRotation,
              layer,
            },
          ])
          for (const segment of segmentsForArc(
            center,
            entity.radius,
            entity.startAngle,
            entity.endAngle,
            curveTolerance / Math.max(scale, 1e-9),
          )) {
            addSegment(
              layer,
              applyMatrix(transform, segment.start),
              applyMatrix(transform, segment.end),
              'arc',
            )
          }
        }
        continue
      }

      if (entity.type === 'INSERT') {
        const position = pointFromVertex(entity.position ?? {})
        if (!position) continue
        const rotationDeg = entity.rotation ?? 0
        const xScale = entity.xScale ?? 1
        const yScale = entity.yScale ?? 1
        const localMatrix = insertMatrix(position, rotationDeg, xScale, yScale)
        const worldMatrix = composeMatrix(transform, localMatrix)

        const type = openingType(entity.name)
        if (type) {
          const worldPosition = applyMatrix(transform, position)
          addOpening(layer, {
            type,
            position: worldPosition,
            width: openingWidth(entity.name, type, Math.abs(xScale) * scale),
            rotation: (rotationDeg * Math.PI) / 180 + Math.atan2(transform[1], transform[0]),
            blockName: entity.name ?? '',
          })
        }

        const blockName = entity.name ?? ''
        const block = blocksByName[blockName]
        if (block?.entities && depth < MAX_BLOCK_DEPTH && !path.has(blockName)) {
          path.add(blockName)
          walkEntities(block.entities, worldMatrix, depth + 1, path)
          path.delete(blockName)
        }
        continue
      }

      if (entity.type !== 'LWPOLYLINE') continue

      const vertices = (entity.vertices ?? []).flatMap((vertex) => {
        const point = pointFromVertex(vertex)
        return point ? [{ point, bulge: vertex.bulge }] : []
      })
      const emit = (a: { point: Point; bulge?: number }, b: { point: Point; bulge?: number }) => {
        for (const segment of segmentsForBulge(a.point, b.point, a.bulge, curveTolerance)) {
          addSegment(
            layer,
            applyMatrix(transform, segment.start),
            applyMatrix(transform, segment.end),
            a.bulge ? 'bulge' : undefined,
          )
        }
      }
      for (let index = 1; index < vertices.length; index += 1) {
        emit(vertices[index - 1], vertices[index])
      }
      if ((entity.shape === true || entity.closed === true) && vertices.length > 2) {
        emit(vertices[vertices.length - 1], vertices[0])
      }
    }
  }

  walkEntities(document?.entities ?? [], IDENTITY_MATRIX, 0, new Set())

  const layerNames = new Set([...byLayer.keys(), ...openingsByLayer.keys()])
  return [...layerNames].map((layer) => {
    const segments = byLayer.get(layer) ?? []
    const openings = openingsByLayer.get(layer)
    const arcs = arcsByLayer.get(layer)
    return { layer, segments, ...(openings ? { openings } : {}), ...(arcs ? { arcs } : {}) }
  })
}

export const extractDxfSegments = extractDxfVectorSegments

/** Includes table-only layers and unsupported entities, unlike the geometry-only result. */
export function inspectDxf(
  source: string,
  options: { curveTolerance?: number } = {},
): {
  insertionUnits: number | null
  layers: { layer: string; segmentCount: number; entityCount: number }[]
} {
  const document = new DxfParser().parseSync(source) as DxfDocument
  const layers = new Map<string, { layer: string; segmentCount: number; entityCount: number }>()
  const ensure = (layer: string) => {
    let entry = layers.get(layer)
    if (!entry) {
      entry = { layer, segmentCount: 0, entityCount: 0 }
      layers.set(layer, entry)
    }
    return entry
  }
  for (const layer of Object.keys(document?.tables?.layer?.layers ?? {})) ensure(layer)
  for (const entity of document?.entities ?? [])
    ensure((entity as SupportedEntity).layer ?? '0').entityCount += 1
  for (const result of extractDxfVectorSegments(source, options))
    ensure(result.layer).segmentCount = result.segments.length
  const units = document?.header?.$INSUNITS
  return { insertionUnits: typeof units === 'number' ? units : null, layers: [...layers.values()] }
}
