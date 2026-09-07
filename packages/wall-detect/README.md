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
0.20 m default thickness with confidence `0.35`, or `0.70` for straight lines
on clearly named wall layers (`PAREDE`, `WALL`, `ALVEN`, or an `ALV` token,
case-insensitive). An arbitrary preferred layer does not raise confidence.
Segments marked `source: 'arc' | 'bulge'` do not get this semantic boost.
Endpoint snapping replaces nearby endpoints with their average.

## CAD inspection and preview integration

`suggestCadUnit(segments, insertionUnits?)` returns
`{ unit: 'm' | 'cm' | 'mm', metersPerUnit, confidence, source }`.
DXF `$INSUNITS` values 6/5/4 take precedence. Otherwise, at least three finite
straight segments are needed. The heuristic prefers wall layers, scores lengths
in the 0.3–15 m range and uses a median near 3 m to break ties. Small details,
large buildings, mixed units and incorrect headers can mislead it; this is only
a suggestion, never a replacement for manual unit selection. Insufficient
data returns metres with confidence zero. Inputs are not mutated.

`detectDoorOpenings(arcs, segments, walls, { metersPerUnit, toleranceM })`
recognizes native ARC geometry with a 90° ±10° sweep, radius 0.6–1.2 m, a
straight radial door leaf and a nearby wall aligned with the closed leaf.
Arcs and leaf segments use **file units**; detected walls and returned
geometry use **metres**. Angles are radians, counterclockwise from +X.
The default matching tolerance is 0.05 m, plus half the host wall thickness.
Each candidate contains `type: 'door'`, `position` (opening midpoint), `hinge`,
`width`, `rotation`, `confidence: 0.8`, and indices `wallIndex`, `arcIndex`,
`leafSegmentIndex` into the supplied arrays. Those indices let a preview
identify the source symbol; candidates are not committed or cut into walls.

For the importing UI:

1. Inspect the DXF layers/header and keep all source layers for review.
2. Suggest a unit, allowing the user to override it before detection.
3. Filter wall segments by the selected checkboxes, then scale coordinates to
   metres. Do not pass `preferLayerContaining` again after explicit selection.
4. Call `detectWalls` on those wall segments. Pass **all** native arcs and leaf
   segments to `detectDoorOpenings`, since doors may live on a separate layer.
5. Review candidates, especially walls accidentally made from door symbols.

This remains a heuristic, not a CAD semantic model: no geometry-only window
recognition, nested INSERT expansion, bulge-based door symbols, double leaves,
sliding doors or reliable handing inference. Layer names and plausible geometry
are evidence, not a guarantee that a line is a wall or a symbol is a door.
