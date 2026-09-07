export type RecenterableSegment = {
  start: [number, number]
  end: [number, number]
}

export function recenterSegments<T extends RecenterableSegment>(
  segments: T[],
): {
  segments: T[]
  offset: [number, number]
} {
  if (segments.length === 0) return { segments, offset: [0, 0] }

  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const segment of segments) {
    for (const point of [segment.start, segment.end]) {
      minX = Math.min(minX, point[0])
      maxX = Math.max(maxX, point[0])
      minY = Math.min(minY, point[1])
      maxY = Math.max(maxY, point[1])
    }
  }
  if (![minX, maxX, minY, maxY].every(Number.isFinite)) {
    return { segments, offset: [0, 0] }
  }

  const offset: [number, number] = [(minX + maxX) / 2, (minY + maxY) / 2]
  return {
    segments: segments.map((segment) => ({
      ...segment,
      start: [segment.start[0] - offset[0], segment.start[1] - offset[1]],
      end: [segment.end[0] - offset[0], segment.end[1] - offset[1]],
    })),
    offset,
  }
}
