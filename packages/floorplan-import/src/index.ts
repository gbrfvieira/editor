export interface DetectedWall {
  start: [number, number]
  end: [number, number]
  thickness: number
  confidence: number
}

export interface WallPatch {
  start: [number, number]
  end: [number, number]
  thickness: number
  height: number
}

export function toWallNodePatches(
  walls: DetectedWall[],
  options: { minConfidence?: number; defaultHeight?: number } = {},
): WallPatch[] {
  const minConfidence = options.minConfidence ?? 0.5
  const height = options.defaultHeight ?? 2.7
  return walls
    .filter((wall) => wall.confidence >= minConfidence)
    .map((wall) => ({
      start: [...wall.start] as [number, number],
      end: [...wall.end] as [number, number],
      thickness: wall.thickness,
      height,
    }))
}

export function commitWalls(
  patches: WallPatch[],
  scene: { createNode: (data: unknown, parentId: string) => void },
  parentLevelId: string,
): void {
  for (const patch of patches) scene.createNode({ type: 'wall', ...patch }, parentLevelId)
}

export interface CommittedWall {
  id: string
  start: [number, number]
  end: [number, number]
  thickness: number
}

export interface DetectedOpening {
  type: 'door' | 'window'
  position: [number, number]
  width: number
}

export interface OpeningPatch {
  wallId: string
  type: 'door' | 'window'
  /** Distance along the wall from `start`, clamped so the opening fits. */
  localX: number
  width: number
}

function wallLength(wall: Pick<CommittedWall, 'start' | 'end'>): number {
  return Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1])
}

/** Perpendicular distance from `point` to the wall segment, and how far along it. */
function projectPointToWall(
  point: [number, number],
  wall: Pick<CommittedWall, 'start' | 'end'>,
): { distance: number; alongWall: number } {
  const dx = wall.end[0] - wall.start[0]
  const dz = wall.end[1] - wall.start[1]
  const lengthSq = dx * dx + dz * dz
  const length = Math.sqrt(lengthSq)
  if (lengthSq === 0) {
    return {
      distance: Math.hypot(point[0] - wall.start[0], point[1] - wall.start[1]),
      alongWall: 0,
    }
  }
  const rawT = ((point[0] - wall.start[0]) * dx + (point[1] - wall.start[1]) * dz) / lengthSq
  const t = Math.max(0, Math.min(1, rawT))
  const projected: [number, number] = [wall.start[0] + t * dx, wall.start[1] + t * dz]
  return {
    distance: Math.hypot(point[0] - projected[0], point[1] - projected[1]),
    alongWall: t * length,
  }
}

/**
 * Matches each detected door/window opening to the nearest committed wall it
 * plausibly sits on. DXF door/window block insertion points are drawn at the
 * opening's centerline but sometimes offset to a jamb, so the tolerance is
 * generous (half the wall thickness plus a fixed slack) rather than exact.
 */
export function matchOpeningsToWalls(
  openings: DetectedOpening[],
  walls: CommittedWall[],
  options: { toleranceM?: number } = {},
): OpeningPatch[] {
  const slack = options.toleranceM ?? 0.4
  const patches: OpeningPatch[] = []
  for (const opening of openings) {
    let best: { wall: CommittedWall; distance: number; alongWall: number } | undefined
    for (const wall of walls) {
      const { distance, alongWall } = projectPointToWall(opening.position, wall)
      if (!best || distance < best.distance) best = { wall, distance, alongWall }
    }
    if (!best) continue
    const tolerance = best.wall.thickness / 2 + slack
    if (best.distance > tolerance) continue
    const length = wallLength(best.wall)
    if (length < opening.width) continue
    const localX = Math.max(opening.width / 2, Math.min(length - opening.width / 2, best.alongWall))
    patches.push({ wallId: best.wall.id, type: opening.type, localX, width: opening.width })
  }
  return patches
}

export { summarizeImport } from './summary'
