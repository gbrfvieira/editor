# DXF vector extract

Parses an ASCII DXF string with `dxf-parser` and returns `LINE`,
`LWPOLYLINE` and flattened `ARC` geometry grouped by CAD layer:

```ts
const result = extractDxfVectorSegments(dxfText)
// [{ layer: "WALL", segments: [{ start: [0, 0], end: [4, 0] }] }]
```

Closed polylines produce a final segment back to their first vertex. Curved
segments carry `source: 'arc' | 'bulge'`; straight LINE results remain unchanged.
Layers with ARC entities also return `arcs: [{ center, radius, startAngle,
endAngle, layer }]`, preserving the original analytic geometry for door-swing
detection. Angles are radians, counterclockwise from +X; coordinates/radii are
in native file units. Z, extrusion planes and nested blocks are not handled.

`curveTolerance` (default 0.02 **file units**) bounds the target arc step length;
each curve is capped at 4096 segments to avoid unbounded allocation, so very
large curves may exceed that target. For a 20 mm target in a millimetre file,
pass `{ curveTolerance: 20 }`. This is not a chord-error tolerance.

Named INSERT entities containing PORTA/DOOR/JANELA/WINDOW still return optional
`openings`. Their legacy width is a metre-based name/default estimate multiplied
by INSERT scale, while position remains in file units; do not scale that width
as though it were native geometry. Block contents are not expanded. Text,
dimensions, hatches and other unsupported geometry are ignored.

`inspectDxf(text, { curveTolerance? })` returns
`{ insertionUnits: number | null, layers: [{ layer, segmentCount, entityCount }] }`.
It includes table-only layers and layers with unsupported entities (zero
segments), enabling a layer-checkbox list before import. Counts are extracted
segments after flattening, not just CAD entities. Use the same tolerance for
inspection and extraction. `$INSUNITS` is reported without converting geometry.
Parsing malformed DXF can still throw. This package does not select layers,
change units, detect host walls or mutate a scene.
