import type { DetectedWall } from './index'

export function summarizeImport(walls: DetectedWall[]): {
  totalWalls: number
  totalLengthM: number
  averageConfidence: number
  needsReview: DetectedWall[]
} {
  const totalLengthM = walls.reduce(
    (sum, wall) => sum + Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]),
    0,
  )
  return {
    totalWalls: walls.length,
    totalLengthM,
    averageConfidence:
      walls.length === 0 ? 0 : walls.reduce((sum, wall) => sum + wall.confidence, 0) / walls.length,
    needsReview: walls.filter((wall) => wall.confidence < 0.6),
  }
}
