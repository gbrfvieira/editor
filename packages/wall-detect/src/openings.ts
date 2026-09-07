import type { InputSegment, Point, Wall } from './index'

export interface DoorArc {
  center: Point
  radius: number
  startAngle: number
  endAngle: number
  layer?: string
}

export interface DoorOpening {
  type: 'door'
  position: Point
  hinge: Point
  width: number
  rotation: number
  confidence: number
  wallIndex: number
  arcIndex: number
  leafSegmentIndex: number
}

const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1])

function distanceToWall(point: Point, wall: Wall): number {
  const dx = wall.end[0] - wall.start[0]
  const dy = wall.end[1] - wall.start[1]
  const lengthSquared = dx * dx + dy * dy
  if (!lengthSquared) return Infinity
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point[0] - wall.start[0]) * dx + (point[1] - wall.start[1]) * dy) / lengthSquared,
    ),
  )
  return distance(point, [wall.start[0] + t * dx, wall.start[1] + t * dy])
}

/** Arcs/segments use file units; walls and all returned geometry use metres. */
export function detectDoorOpenings(
  arcs: DoorArc[],
  segments: InputSegment[],
  walls: Wall[],
  options: { metersPerUnit?: number; toleranceM?: number } = {},
): DoorOpening[] {
  const factor = options.metersPerUnit ?? 1
  const tolerance = options.toleranceM ?? 0.05
  if (!Number.isFinite(factor) || factor <= 0 || !Number.isFinite(tolerance) || tolerance < 0) {
    throw new RangeError('Invalid unit factor or tolerance')
  }
  const scale = (p: Point): Point => [p[0] * factor, p[1] * factor]
  const openings: DoorOpening[] = []
  arcs.forEach((arc, arcIndex) => {
    if (![...arc.center, arc.radius, arc.startAngle, arc.endAngle].every(Number.isFinite)) return
    const sweep = (((arc.endAngle - arc.startAngle) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
    const radius = arc.radius * factor
    if (Math.abs(sweep - Math.PI / 2) > Math.PI / 18 || radius < 0.6 - 1e-9 || radius > 1.2 + 1e-9)
      return
    const hinge = scale(arc.center)
    const endpoints = [arc.startAngle, arc.endAngle].map(
      (angle): Point => [hinge[0] + radius * Math.cos(angle), hinge[1] + radius * Math.sin(angle)],
    )
    for (let leafSegmentIndex = 0; leafSegmentIndex < segments.length; leafSegmentIndex += 1) {
      const leaf = segments[leafSegmentIndex]
      if (leaf.source || ![...leaf.start, ...leaf.end].every(Number.isFinite)) continue
      const a = scale(leaf.start)
      const b = scale(leaf.end)
      const tip = distance(a, hinge) <= tolerance ? b : distance(b, hinge) <= tolerance ? a : null
      if (!tip) continue
      const tipIndex = endpoints.findIndex((point) => distance(point, tip) <= tolerance)
      if (tipIndex < 0) continue
      // The other radial endpoint is the closed leaf; its axis must align with the host wall.
      const closed = endpoints[1 - tipIndex]
      const direction: Point = [(closed[0] - hinge[0]) / radius, (closed[1] - hinge[1]) / radius]
      const wallIndex = walls.findIndex((wall) => {
        const length = distance(wall.start, wall.end)
        if (!length || ![...wall.start, ...wall.end, wall.thickness].every(Number.isFinite))
          return false
        const sine =
          Math.abs(
            direction[0] * (wall.end[1] - wall.start[1]) -
              direction[1] * (wall.end[0] - wall.start[0]),
          ) / length
        return (
          sine <= Math.sin(Math.PI / 18) &&
          distanceToWall(hinge, wall) <= tolerance + Math.max(0, wall.thickness) / 2
        )
      })
      if (wallIndex < 0) continue
      if (
        openings.some(
          (opening) =>
            distance(opening.hinge, hinge) <= tolerance &&
            Math.abs(opening.width - radius) <= tolerance,
        )
      )
        return
      openings.push({
        type: 'door',
        position: [(hinge[0] + closed[0]) / 2, (hinge[1] + closed[1]) / 2],
        hinge,
        width: radius,
        rotation: Math.atan2(direction[1], direction[0]),
        confidence: 0.8,
        wallIndex,
        arcIndex,
        leafSegmentIndex,
      })
      return
    }
  })
  return openings
}
