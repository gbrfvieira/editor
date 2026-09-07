# Wall detect

Heuristic pairing of generic floor-plan line segments into wall centerlines.
Parallel segments separated by `wallThicknessRangeM` become one wall whose
centerline is the average of the two lines. Unpaired segments are retained as
lower-confidence single-line walls.

```ts
const result = detectWalls(segments, {
  preferLayerContaining: "PAREDE",
  snapToleranceM: 0.05,
})
// { walls: [{ start: [0, 0], end: [4, 0], thickness: 0.2, confidence: 0.9 }] }
```

The default thickness range is `[0.05, 0.40]` m and single-line walls use a
0.20 m default thickness with confidence `0.35`. This is intentionally a
geometric heuristic: it does not infer openings, levels, materials, or wall
semantics. Endpoint snapping replaces nearby endpoints with their average.
