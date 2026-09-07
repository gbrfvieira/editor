# DXF vector extract

Parses an ASCII DXF string with `dxf-parser` and returns `LINE` and
`LWPOLYLINE` geometry grouped by CAD layer:

```ts
const result = extractDxfVectorSegments(dxfText)
// [{ layer: "WALL", segments: [{ start: [0, 0], end: [4, 0] }] }]
```

Closed polylines produce a final segment back to their first vertex. Other
entity types (text, dimensions, hatches, blocks, and so on) are ignored.
Coordinates are returned as the DXF's x/y coordinates; z values are not used.
Polyline bulges/arcs are represented by their endpoint chord in this v1, and
layer/entity metadata beyond the layer name is not preserved.
