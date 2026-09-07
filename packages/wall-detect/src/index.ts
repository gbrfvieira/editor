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
  minSegmentLengthM?: number
  mergeAngleToleranceRad?: number
  mergeOffsetToleranceM?: number
  mergeGapToleranceM?: number
}

export interface WallDetectResult {
  walls: Wall[]
}

const DEFAULT_THICKNESS_RANGE: [number, number] = [0.05, 0.4]
const DEFAULT_SNAP_TOLERANCE = 0.05
const DEFAULT_SINGLE_WALL_THICKNESS = 0.2
const DEFAULT_MIN_SEGMENT_LENGTH = 0.15
const DEFAULT_MERGE_ANGLE_TOLERANCE = Math.PI / 90
const DEFAULT_MERGE_OFFSET_TOLERANCE = 0.03
const DEFAULT_MERGE_GAP_TOLERANCE = 0.02
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

/**
 * Buckets points into a uniform grid (cell size = `radius`) and returns, for
 * each point index, every other point index sharing its cell or an adjacent
 * one (deduplicated, `left < right`). Two points within `radius` of each
 * other always land in the same or a neighboring cell, so this never misses
 * a candidate pair — it only skips pairs already known to be farther apart
 * than `radius`. Turns the naive O(n^2) all-pairs scan into roughly O(n) for
 * geometry that isn't pathologically dense everywhere (real floor plans).
 */
function nearbyPairs(points: Point[], radius: number): Array<[number, number]> {
  const cellSize = Math.max(radius, 1e-6)
  const cellOf = (value: number) => Math.floor(value / cellSize)
  const grid = new Map<string, number[]>()
  points.forEach((point, index) => {
    const key = `${cellOf(point[0])},${cellOf(point[1])}`
    const bucket = grid.get(key)
    if (bucket) bucket.push(index)
    else grid.set(key, [index])
  })

  const pairs: Array<[number, number]> = []
  const seen = new Set<string>()
  points.forEach((point, index) => {
    const cx = cellOf(point[0])
    const cy = cellOf(point[1])
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (const other of grid.get(`${cx + dx},${cy + dy}`) ?? []) {
          if (other === index) continue
          const first = Math.min(index, other)
          const second = Math.max(index, other)
          const key = `${first}:${second}`
          if (seen.has(key)) continue
          seen.add(key)
          pairs.push([first, second])
        }
      }
    }
  })
  return pairs
}

/** Grid cells for a segment's bounding box, expanded by `margin` on each side. */
function segmentCells(segment: InputSegment, cellSize: number, margin: number): string[] {
  const minX = Math.min(segment.start[0], segment.end[0]) - margin
  const maxX = Math.max(segment.start[0], segment.end[0]) + margin
  const minY = Math.min(segment.start[1], segment.end[1]) - margin
  const maxY = Math.max(segment.start[1], segment.end[1]) + margin
  const cells: string[] = []
  const cx0 = Math.floor(minX / cellSize)
  const cx1 = Math.floor(maxX / cellSize)
  const cy0 = Math.floor(minY / cellSize)
  const cy1 = Math.floor(maxY / cellSize)
  for (let cx = cx0; cx <= cx1; cx += 1) {
    for (let cy = cy0; cy <= cy1; cy += 1) cells.push(`${cx},${cy}`)
  }
  return cells
}

/** Candidate segment pairs whose bounding boxes are within `maxThickness` of each other. */
function nearbySegmentPairs(
  segments: InputSegment[],
  maxThickness: number,
): Array<[number, number]> {
  const cellSize = Math.max(maxThickness, 1e-6)
  const grid = new Map<string, number[]>()
  segments.forEach((segment, index) => {
    for (const key of segmentCells(segment, cellSize, maxThickness)) {
      const bucket = grid.get(key)
      if (bucket) bucket.push(index)
      else grid.set(key, [index])
    }
  })
  const pairs: Array<[number, number]> = []
  const seen = new Set<string>()
  for (const bucket of grid.values()) {
    for (let i = 0; i < bucket.length; i += 1) {
      for (let j = i + 1; j < bucket.length; j += 1) {
        const first = Math.min(bucket[i], bucket[j])
        const second = Math.max(bucket[i], bucket[j])
        const key = `${first}:${second}`
        if (seen.has(key)) continue
        seen.add(key)
        pairs.push([first, second])
      }
    }
  }
  return pairs
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

  for (const [left, right] of nearbyPairs(endpoints, tolerance)) {
    if (distance(endpoints[left], endpoints[right]) <= tolerance) {
      union(left, right)
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

interface MergeOptions {
  angleToleranceRad: number
  offsetToleranceM: number
  gapToleranceM: number
}

function mergeWallPair(first: Wall, second: Wall, options: MergeOptions): Wall | undefined {
  const firstInfo = normalizedDirection(first)
  const secondInfo = normalizedDirection(second)
  if (!firstInfo || !secondInfo) {
    return undefined
  }

  if (
    Math.abs(cross(firstInfo.direction, secondInfo.direction)) > Math.sin(options.angleToleranceRad)
  ) {
    return undefined
  }

  const direction = firstInfo.direction
  const normal: Point = [-direction[1], direction[0]]
  const firstNormal = (dot(first.start, normal) + dot(first.end, normal)) / 2
  const secondNormal = (dot(second.start, normal) + dot(second.end, normal)) / 2
  if (
    Math.max(
      Math.abs(dot(second.start, normal) - firstNormal),
      Math.abs(dot(second.end, normal) - firstNormal),
    ) > options.offsetToleranceM
  ) {
    return undefined
  }

  const firstInterval = [dot(first.start, direction), dot(first.end, direction)].sort(
    (left, right) => left - right,
  )
  const secondInterval = [dot(second.start, direction), dot(second.end, direction)].sort(
    (left, right) => left - right,
  )
  const gap =
    Math.max(firstInterval[0], secondInterval[0]) - Math.min(firstInterval[1], secondInterval[1])
  if (gap > options.gapToleranceM) {
    return undefined
  }

  const startProjection = Math.min(firstInterval[0], secondInterval[0])
  const endProjection = Math.max(firstInterval[1], secondInterval[1])
  const normalProjection =
    (firstNormal * firstInfo.length + secondNormal * secondInfo.length) /
    (firstInfo.length + secondInfo.length)

  return {
    start: add(scale(direction, startProjection), scale(normal, normalProjection)),
    end: add(scale(direction, endProjection), scale(normal, normalProjection)),
    thickness:
      (first.thickness * firstInfo.length + second.thickness * secondInfo.length) /
      (firstInfo.length + secondInfo.length),
    confidence: Math.max(first.confidence, second.confidence),
  }
}

export function mergeNearlyDuplicateWalls(
  walls: Wall[],
  options: Partial<MergeOptions> = {},
): Wall[] {
  const configured: MergeOptions = {
    angleToleranceRad: options.angleToleranceRad ?? DEFAULT_MERGE_ANGLE_TOLERANCE,
    offsetToleranceM: options.offsetToleranceM ?? DEFAULT_MERGE_OFFSET_TOLERANCE,
    gapToleranceM: options.gapToleranceM ?? DEFAULT_MERGE_GAP_TOLERANCE,
  }
  const merged: Wall[] = walls.map((wall) => ({
    ...wall,
    start: [...wall.start] as Point,
    end: [...wall.end] as Point,
  }))

  let changed = true
  while (changed) {
    changed = false
    for (let first = 0; first < merged.length && !changed; first += 1) {
      for (let second = first + 1; second < merged.length; second += 1) {
        const combined = mergeWallPair(merged[first], merged[second], configured)
        if (!combined) {
          continue
        }
        merged[first] = combined
        merged.splice(second, 1)
        changed = true
        break
      }
    }
  }

  return merged
}

export function detectWalls(
  inputSegments: InputSegment[],
  options: WallDetectOptions = {},
): WallDetectResult {
  const [configuredMin, configuredMax] = options.wallThicknessRangeM ?? DEFAULT_THICKNESS_RANGE
  const minThickness = Math.min(configuredMin, configuredMax)
  const maxThickness = Math.max(configuredMin, configuredMax)
  const snapTolerance = options.snapToleranceM ?? DEFAULT_SNAP_TOLERANCE
  const minSegmentLength = options.minSegmentLengthM ?? DEFAULT_MIN_SEGMENT_LENGTH
  const preferred = options.preferLayerContaining?.toLocaleLowerCase()
  const preferredSegments = preferred
    ? inputSegments.filter((segment) => segment.layer?.toLocaleLowerCase().includes(preferred))
    : []
  // A caller-supplied substring (e.g. "PAREDE") wins when it matches
  // anything; otherwise fall back to the same wall-layer heuristic used for
  // the single-line confidence boost — many real offices name wall layers
  // "ALV1"/"ALV2"/etc. rather than anything containing "parede" — before
  // finally giving up and running detection over every segment (including
  // non-wall geometry pulled in by resolved block INSERTs).
  const wallLayerSegments =
    preferredSegments.length > 0
      ? preferredSegments
      : inputSegments.filter((segment) => isWallLayer(segment.layer))
  const selectedSegments = wallLayerSegments.length > 0 ? wallLayerSegments : inputSegments
  const segments = selectedSegments.filter(
    (segment) =>
      segment.start.every(Number.isFinite) &&
      segment.end.every(Number.isFinite) &&
      distance(segment.start, segment.end) >= minSegmentLength,
  )
  const walls: Wall[] = []
  const paired = new Set<number>()
  const candidates: Array<{ first: number; second: number; thickness: number; wall: Wall }> = []

  for (const [first, second] of nearbySegmentPairs(segments, maxThickness)) {
    const candidate = pairCandidate(segments[first], segments[second], minThickness, maxThickness)
    if (candidate) {
      candidates.push({ first, second, ...candidate })
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

  const mergedWalls = mergeNearlyDuplicateWalls(walls, {
    angleToleranceRad: options.mergeAngleToleranceRad,
    offsetToleranceM: options.mergeOffsetToleranceM,
    gapToleranceM: options.mergeGapToleranceM,
  })
  snapWallEndpoints(mergedWalls, snapTolerance)
  return { walls: mergedWalls }
}

export const detectWallSegments = detectWalls

export type { DoorArc, DoorOpening } from './openings'
export { detectDoorOpenings } from './openings'
export type { CadUnit, UnitSuggestion } from './units'
export { suggestCadUnit } from './units'
export type { WindowDetectOptions, WindowOpening } from './windows'
export { detectWindowOpenings } from './windows'
