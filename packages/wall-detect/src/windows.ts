import type { InputSegment, Point, Wall } from './index'

export interface WindowOpening {
  type: 'window'
  position: Point
  width: number
  rotation: number
  thickness: number
  confidence: number
  wallIndices: [number, number]
  segmentIndices: number[]
}

export interface WindowDetectOptions {
  metersPerUnit?: number
  toleranceM?: number
  minWidthM?: number
  maxWidthM?: number
  angleToleranceRad?: number
  thicknessRatioRange?: [number, number]
}

const DEFAULT_TOLERANCE = 0.06
const DEFAULT_MIN_WIDTH = 0.3
const DEFAULT_MAX_WIDTH = 3
const DEFAULT_ANGLE_TOLERANCE = Math.PI / 18
const DEFAULT_THICKNESS_RATIO_RANGE: [number, number] = [0.5, 1.75]

function subtract(left: Point, right: Point): Point {
  return [left[0] - right[0], left[1] - right[1]]
}

function add(left: Point, right: Point): Point {
  return [left[0] + right[0], left[1] + right[1]]
}

function scale(point: Point, factor: number): Point {
  return [point[0] * factor, point[1] * factor]
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

function midpoint(left: Point, right: Point): Point {
  return scale(add(left, right), 0.5)
}

function direction(start: Point, end: Point): Point | undefined {
  const vector = subtract(end, start)
  const magnitude = length(vector)
  return magnitude > 0 ? scale(vector, 1 / magnitude) : undefined
}

function finitePoint(point: Point): boolean {
  return point.every(Number.isFinite)
}

export function detectWindowOpenings(
  segments: InputSegment[],
  walls: Wall[],
  options: WindowDetectOptions = {},
): WindowOpening[] {
  const metersPerUnit = options.metersPerUnit ?? 1
  const tolerance = options.toleranceM ?? DEFAULT_TOLERANCE
  const minWidth = options.minWidthM ?? DEFAULT_MIN_WIDTH
  const maxWidth = options.maxWidthM ?? DEFAULT_MAX_WIDTH
  const angleTolerance = options.angleToleranceRad ?? DEFAULT_ANGLE_TOLERANCE
  const [configuredMinRatio, configuredMaxRatio] =
    options.thicknessRatioRange ?? DEFAULT_THICKNESS_RATIO_RANGE
  const minThicknessRatio = Math.min(configuredMinRatio, configuredMaxRatio)
  const maxThicknessRatio = Math.max(configuredMinRatio, configuredMaxRatio)

  if (
    ![
      metersPerUnit,
      tolerance,
      minWidth,
      maxWidth,
      angleTolerance,
      minThicknessRatio,
      maxThicknessRatio,
    ].every(Number.isFinite) ||
    metersPerUnit <= 0 ||
    tolerance < 0 ||
    minWidth < 0 ||
    maxWidth < minWidth ||
    angleTolerance < 0 ||
    angleTolerance >= Math.PI / 2 ||
    minThicknessRatio <= 0
  ) {
    throw new RangeError('Window detection options must contain valid positive measurements')
  }

  const scaledSegments = segments
    .map((segment, index) => ({
      index,
      start: scale(segment.start, metersPerUnit),
      end: scale(segment.end, metersPerUnit),
      source: segment.source,
    }))
    .filter(
      (segment) =>
        segment.source === undefined && finitePoint(segment.start) && finitePoint(segment.end),
    )
  const openings: WindowOpening[] = []

  for (let firstIndex = 0; firstIndex < walls.length; firstIndex += 1) {
    const first = walls[firstIndex]
    const wallDirection = direction(first.start, first.end)
    if (!wallDirection || !finitePoint(first.start) || !finitePoint(first.end)) {
      continue
    }
    const normal: Point = [-wallDirection[1], wallDirection[0]]
    const firstInterval = [dot(first.start, wallDirection), dot(first.end, wallDirection)].sort(
      (left, right) => left - right,
    )
    const referenceNormal = (dot(first.start, normal) + dot(first.end, normal)) / 2

    for (let secondIndex = firstIndex + 1; secondIndex < walls.length; secondIndex += 1) {
      const second = walls[secondIndex]
      const secondDirection = direction(second.start, second.end)
      if (!secondDirection || !finitePoint(second.start) || !finitePoint(second.end)) {
        continue
      }
      if (Math.abs(cross(wallDirection, secondDirection)) > Math.sin(angleTolerance)) {
        continue
      }

      const secondNormal = (dot(second.start, normal) + dot(second.end, normal)) / 2
      if (Math.abs(referenceNormal - secondNormal) > tolerance) {
        continue
      }
      const secondInterval = [
        dot(second.start, wallDirection),
        dot(second.end, wallDirection),
      ].sort((left, right) => left - right)

      const leftInterval = firstInterval[0] <= secondInterval[0] ? firstInterval : secondInterval
      const rightInterval = leftInterval === firstInterval ? secondInterval : firstInterval
      const leftWallIndex = leftInterval === firstInterval ? firstIndex : secondIndex
      const rightWallIndex = leftWallIndex === firstIndex ? secondIndex : firstIndex
      const gapStart = leftInterval[1]
      const gapEnd = rightInterval[0]
      const gapWidth = gapEnd - gapStart
      if (gapWidth < minWidth || gapWidth > maxWidth) {
        continue
      }

      const thickness = (first.thickness + second.thickness) / 2
      if (!Number.isFinite(thickness) || thickness <= 0) {
        continue
      }
      const matchingSegments = scaledSegments.filter((segment) => {
        const segmentDirection = direction(segment.start, segment.end)
        if (!segmentDirection) {
          return false
        }
        const segmentLength = length(subtract(segment.end, segment.start))
        if (
          segmentLength < thickness * minThicknessRatio ||
          segmentLength > thickness * maxThicknessRatio
        ) {
          return false
        }
        if (Math.abs(dot(segmentDirection, wallDirection)) > Math.sin(angleTolerance)) {
          return false
        }
        const center = midpoint(segment.start, segment.end)
        const alongWall = dot(center, wallDirection)
        const fromCenterline = Math.abs(dot(center, normal) - referenceNormal)
        return (
          alongWall >= gapStart - tolerance &&
          alongWall <= gapEnd + tolerance &&
          fromCenterline <= tolerance
        )
      })

      if (matchingSegments.length === 0) {
        continue
      }

      const gapCenterProjection = (gapStart + gapEnd) / 2
      const center = add(
        scale(wallDirection, gapCenterProjection),
        scale(normal, (referenceNormal + secondNormal) / 2),
      )
      const hasBothJambs =
        matchingSegments.some((segment) => {
          const center = midpoint(segment.start, segment.end)
          return Math.abs(dot(center, wallDirection) - gapStart) <= tolerance
        }) &&
        matchingSegments.some((segment) => {
          const center = midpoint(segment.start, segment.end)
          return Math.abs(dot(center, wallDirection) - gapEnd) <= tolerance
        })

      openings.push({
        type: 'window',
        position: center,
        width: gapWidth,
        rotation: Math.atan2(wallDirection[1], wallDirection[0]),
        thickness,
        confidence: hasBothJambs ? 0.88 : 0.68,
        wallIndices: [leftWallIndex, rightWallIndex],
        segmentIndices: matchingSegments.map((segment) => segment.index),
      })
    }
  }

  return openings
}
