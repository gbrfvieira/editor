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

export { summarizeImport } from './summary'
