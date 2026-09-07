# PDF vector extract

Small TypeScript utility that reads PDF bytes with `pdfjs-dist` and returns the
straight line segments found in each page's vector operator list.

```ts
import { extractPdfVectorSegments } from "@pascal-app/pdf-vector-extract";

const pages = await extractPdfVectorSegments(pdfBytes);
// [{ pageIndex: 0, segments: [{ start: [10, 20], end: [80, 20] }] }]
```

`pageIndex` is zero-based. Points are `[x, y]` pairs in PDF page user-space
coordinates after applying the content stream's current transformation matrix.

## Known limitations

- Bézier curves are flattened to straight segments with a default tolerance of
  `0.5` transformed page units. Pass `{ curveTolerance: number }` to change it.
- Layer, stroke color, line width, and other drawing-style information are not
  preserved in this first version.
- Raster images and text outlines are not extracted.
