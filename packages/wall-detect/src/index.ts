export type Point = [number, number]

export interface InputSegment {
  start: Point
  end: Point
  layer?: string
  source?: 'arc' | 'bulge'
}

export interface Wall {
  start: Point
  end: Point
  thickness: number
  confidence: number
}

export interface WallDetectOptions {
  wallThicknessRangeM?: [number, number]
  snapToleranceM?: number
  preferLayerContaining?: string
}

export interface WallDetectResult {
  walls: Wall[]
}

const DEFAULT_THICKNESS_RANGE: [number, number] = [0.05, 0.4]
const DEFAULT_SNAP_TOLERANCE = 0.05
const DEFAULT_SINGLE_WALL_THICKNESS = 0.2
const PARALLEL_ANGLE_TOLERANCE = Math.PI / 18
const MIN_OVERLAP_FRACTION = 0.1

export function isWallLayer(layer = ''): boolean {
  return /PAREDE|WALL|ALVEN|(?:^|[^A-Z])ALV(?:$|[^A-Z])/i.test(layer)
}

function subtract(left: Point, right: Point): Point {
  return [left[0] - right[0], left[1] - right[1]]
}

function add(left: Point, right: Point): Point {
  return [left[0] + right[0], left[1] + right[1]]
}

function scale(point: Point, factor: number): Point {
  return [point[0] * factor, point[1] * factor]
}

// Endpoint snapping averages 2-3 float coordinates together, which lands on
// values like 1.0150000000000001 instead of 1.015 — well below any real
// wall-geometry tolerance, but it breaks exact-equality comparisons and
// scene persistence. Round to micrometer precision to discard the noise.
function roundPoint(point: Point): Point {
  return [Math.round(point[0] * 1e6) / 1e6, Math.round(point[1] * 1e6) / 1e6]
}

function dot(left: Point, right: Point): number {
  return left[0] * right[0] + left[1] * right[1]
}

function cross(left: Point, right: Point): number {
  return left[0] * right[1] - left[1] * right[0]
}

function length(point: Point): number {
  return Math.hypot(point[0], point[1])
}

function distance(left: Point, right: Point): number {
  return length(subtract(left, right))
}

function midpoint(left: Point, right: Point): Point {
  return scale(add(left, right), 0.5)
}

function normalizedDirection(
  segment: InputSegment,
): { direction: Point; length: number } | undefined {
  const vector = subtract(segment.end, segment.start)
  const segmentLength = length(vector)
  if (segmentLength === 0) {
    return undefined
  }
  return { direction: scale(vector, 1 / segmentLength), length: segmentLength }
}

function overlapLength(first: InputSegment, second: InputSegment, direction: Point): number {
  const firstStart = dot(first.start, direction)
  const firstEnd = dot(first.end, direction)
  const secondStart = dot(second.start, direction)
  const secondEnd = dot(second.end, direction)
  return Math.max(
    0,
    Math.min(Math.max(firstStart, firstEnd), Math.max(secondStart, secondEnd)) -
      Math.max(Math.min(firstStart, firstEnd), Math.min(secondStart, secondEnd)),
  )
}

function pairCandidate(
  first: InputSegment,
  second: InputSegment,
  minThickness: number,
  maxThickness: number,
): { thickness: number; wall: Wall } | undefined {
  const firstInfo = normalizedDirection(first)
  const secondInfo = normalizedDirection(second)
  if (!firstInfo || !secondInfo) {
    return undefined
  }

  const parallelSine = Math.abs(cross(firstInfo.direction, secondInfo.direction))
  if (parallelSine > Math.sin(PARALLEL_ANGLE_TOLERANCE)) {
    return undefined
  }

  const direction = firstInfo.direction
  const thickness = Math.abs(cross(direction, subtract(second.start, first.start)))
  if (thickness < minThickness || thickness > maxThickness) {
    return undefined
  }

  const overlap = overlapLength(first, second, direction)
  if (overlap < Math.min(firstInfo.length, secondInfo.length) * MIN_OVERLAP_FRACTION) {
    return undefined
  }

  const secondStart =
    dot(second.start, direction) < dot(second.end, direction) ? second.start : second.end
  const secondEnd = secondStart === second.start ? second.end : second.start
  return {
    thickness,
    wall: {
      start: midpoint(first.start, secondStart),
      end: midpoint(first.end, secondEnd),
      thickness,
      confidence: 0.9,
    },
  }
}

function snapWallEndpoints(walls: Wall[], tolerance: number): void {
  const endpoints = walls.flatMap((wall) => [wall.start, wall.end])
  const parent = endpoints.map((_, index) => index)
  const find = (index: number): number => {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]]
      index = parent[index]
    }
    return index
  }
  const union = (left: number, right: number): void => {
    const leftRoot = find(left)
    const rightRoot = find(right)
    if (leftRoot !== rightRoot) {
      parent[rightRoot] = leftRoot
    }
  }

  for (let left = 0; left < endpoints.length; left += 1) {
    for (let right = left + 1; right < endpoints.length; right += 1) {
      if (distance(endpoints[left], endpoints[right]) <= tolerance) {
        union(left, right)
      }
    }
  }

  const groups = new Map<number, Point[]>()
  endpoints.forEach((point, index) => {
    const root = find(index)
    const group = groups.get(root) ?? []
    group.push(point)
    groups.set(root, group)
  })
  const snapped = new Map<number, Point>()
  for (const [root, group] of groups) {
    const center = group.reduce((sum, point) => add(sum, point), [0, 0] as Point)
    snapped.set(root, roundPoint(scale(center, 1 / group.length)))
  }
  endpoints.forEach((_, index) => {
    const point = snapped.get(find(index))
    if (point) {
      endpoints[index][0] = point[0]
      endpoints[index][1] = point[1]
    }
  })
}

export function detectWalls(
  inputSegments: InputSegment[],
  options: WallDetectOptions = {},
): WallDetectResult {
  const [configuredMin, configuredMax] = options.wallThicknessRangeM ?? DEFAULT_THICKNESS_RANGE
  const minThickness = Math.min(configuredMin, configuredMax)
  const maxThickness = Math.max(configuredMin, configuredMax)
  const snapTolerance = options.snapToleranceM ?? DEFAULT_SNAP_TOLERANCE
  const preferred = options.preferLayerContaining?.toLocaleLowerCase()
  const preferredSegments = preferred
    ? inputSegments.filter((segment) => segment.layer?.toLocaleLowerCase().includes(preferred))
    : []
  const segments = preferredSegments.length > 0 ? preferredSegments : inputSegments
  const walls: Wall[] = []
  const paired = new Set<number>()
  const candidates: Array<{ first: number; second: number; thickness: number; wall: Wall }> = []

  for (let first = 0; first < segments.length; first += 1) {
    for (let second = first + 1; second < segments.length; second += 1) {
      const candidate = pairCandidate(segments[first], segments[second], minThickness, maxThickness)
      if (candidate) {
        candidates.push({ first, second, ...candidate })
      }
    }
  }
  candidates.sort((left, right) => left.thickness - right.thickness)
  for (const candidate of candidates) {
    if (paired.has(candidate.first) || paired.has(candidate.second)) {
      continue
    }
    paired.add(candidate.first)
    paired.add(candidate.second)
    walls.push(candidate.wall)
  }

  segments.forEach((segment, index) => {
    if (!paired.has(index) && distance(segment.start, segment.end) > 0) {
      walls.push({
        start: [...segment.start],
        end: [...segment.end],
        thickness: DEFAULT_SINGLE_WALL_THICKNESS,
        confidence: !segment.source && isWallLayer(segment.layer) ? 0.7 : 0.35,
      })
    }
  })

  snapWallEndpoints(walls, snapTolerance)
  return { walls }
}

export const detectWallSegments = detectWalls

export type { DoorArc, DoorOpening } from './openings'
export { detectDoorOpenings } from './openings'
export type { CadUnit, UnitSuggestion } from './units'
export { suggestCadUnit } from './units'
