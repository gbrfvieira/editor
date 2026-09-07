import { GlobalWorkerOptions, getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs'

// In a browser, pdfjs-dist offloads parsing to a Web Worker and throws
// immediately if it doesn't know where to load it from. In Node/Bun,
// pdfjs's own isNodeJS detection skips the worker entirely, so this is a
// no-op there — safe to always set. `import.meta.url`-relative resolution
// lets bundlers (this app uses Turbopack) emit and serve the worker file
// themselves instead of requiring a manual copy into `public/`.
if (typeof window !== 'undefined') {
  GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.mjs',
    import.meta.url,
  ).toString()
}

export type Point = [number, number]

export interface LineSegment {
  start: Point
  end: Point
}

export interface PageSegments {
  pageIndex: number
  segments: LineSegment[]
}

export interface ExtractPdfVectorOptions {
  /** Curves are currently represented by a single chord; kept for API compatibility. */
  curveTolerance?: number
}

type Matrix = [number, number, number, number, number, number]

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]

function multiply(left: Matrix, right: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = left
  const [a2, b2, c2, d2, e2, f2] = right
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ]
}

function transform(matrix: Matrix, point: Point): Point {
  const [a, b, c, d, e, f] = matrix
  return [a * point[0] + c * point[1] + e, b * point[0] + d * point[1] + f]
}

function asMatrix(value: ArrayLike<number>): Matrix {
  return [value[0], value[1], value[2], value[3], value[4], value[5]]
}

function extractPageSegments(
  fnArray: ArrayLike<number>,
  argsArray: ArrayLike<unknown>,
): LineSegment[] {
  const segments: LineSegment[] = []
  const stack: Matrix[] = []
  let matrix: Matrix = [...IDENTITY]
  let current: Point | undefined
  let subpathStart: Point | undefined

  const moveTo = (point: Point) => {
    current = transform(matrix, point)
    subpathStart = current
  }
  const lineTo = (point: Point) => {
    const end = transform(matrix, point)
    if (current) segments.push({ start: current, end })
    current = end
  }
  const curveTo = (end: Point) => {
    const transformedEnd = transform(matrix, end)
    if (current) segments.push({ start: current, end: transformedEnd })
    current = transformedEnd
  }
  const closePath = () => {
    if (
      current &&
      subpathStart &&
      (current[0] !== subpathStart[0] || current[1] !== subpathStart[1])
    ) {
      segments.push({ start: current, end: subpathStart })
    }
    current = subpathStart
  }
  const rectangle = (x: number, y: number, width: number, height: number) => {
    const points: Point[] = [
      [x, y],
      [x + width, y],
      [x + width, y + height],
      [x, y + height],
    ]
    points.forEach((point, index) => {
      const next = points[(index + 1) % points.length]
      segments.push({ start: transform(matrix, point), end: transform(matrix, next) })
    })
    current = transform(matrix, points[0])
    subpathStart = current
  }
  // `OPS.constructPath` doesn't carry the classic parallel
  // operations/coordinates arrays — pdfjs-dist (5.x) packs every subpath into
  // one flat, interleaved array: a small sub-opcode followed by its fixed
  // count of coordinates, repeated. These sub-opcodes are pdfjs-dist's
  // internal `DrawOPS` enum (not part of the public API, so not importable —
  // mirrored here: moveTo 0, lineTo 1, curveTo 2, quadraticCurveTo 3,
  // closePath 4). Verified against the installed pdfjs-dist version; a major
  // bump could renumber these.
  const processPackedPath = (data: ArrayLike<number>) => {
    let index = 0
    while (index < data.length) {
      switch (data[index]) {
        case 0: // moveTo
          moveTo([data[index + 1], data[index + 2]])
          index += 3
          break
        case 1: // lineTo
          lineTo([data[index + 1], data[index + 2]])
          index += 3
          break
        case 2: // curveTo
          curveTo([data[index + 5], data[index + 6]])
          index += 7
          break
        case 3: // quadraticCurveTo
          curveTo([data[index + 3], data[index + 4]])
          index += 5
          break
        case 4: // closePath
          closePath()
          index += 1
          break
        default:
          // Unrecognized sub-opcode: stop rather than mis-align the rest of
          // the stream on a guessed skip width.
          index = data.length
          break
      }
    }
  }

  for (let index = 0; index < fnArray.length; index += 1) {
    const operation = fnArray[index]
    const args = argsArray[index] as ArrayLike<unknown> | undefined
    switch (operation) {
      case OPS.save:
        stack.push([...matrix])
        break
      case OPS.restore:
        matrix = stack.pop() ?? [...IDENTITY]
        break
      case OPS.transform:
        if (args) matrix = multiply(matrix, asMatrix(args as unknown as ArrayLike<number>))
        break
      case OPS.constructPath: {
        // args: [op, data, minMax] from the evaluator's packed operator list
        // (see the CanvasGraphics#constructPath signature) — data[0] is the
        // flat, interleaved sub-opcode/coordinate stream `processPackedPath`
        // expects.
        const data = (args as [unknown, ArrayLike<unknown>, unknown] | undefined)?.[1]?.[0]
        if (data) processPackedPath(data as ArrayLike<number>)
        break
      }
      case OPS.moveTo:
        if (args) moveTo([args[0] as number, args[1] as number])
        break
      case OPS.lineTo:
        if (args) lineTo([args[0] as number, args[1] as number])
        break
      case OPS.curveTo:
        if (args) curveTo([args[4] as number, args[5] as number])
        break
      case OPS.curveTo2:
      case OPS.curveTo3:
        if (args) curveTo([args[2] as number, args[3] as number])
        break
      case OPS.closePath:
        closePath()
        break
      case OPS.rectangle:
        if (args)
          rectangle(args[0] as number, args[1] as number, args[2] as number, args[3] as number)
        break
    }
  }
  return segments
}

export async function extractPdfVectorSegments(
  pdfBytes: Uint8Array | ArrayBuffer,
  options: ExtractPdfVectorOptions = {},
): Promise<PageSegments[]> {
  if (
    options.curveTolerance !== undefined &&
    (!Number.isFinite(options.curveTolerance) || options.curveTolerance <= 0)
  ) {
    throw new RangeError('curveTolerance must be a positive, finite number')
  }
  const data =
    pdfBytes instanceof ArrayBuffer ? new Uint8Array(pdfBytes.slice(0)) : new Uint8Array(pdfBytes)
  const loadingTask = getDocument({ data })
  const document = await loadingTask.promise
  try {
    const pages: PageSegments[] = []
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const operatorList = await page.getOperatorList()
      pages.push({
        pageIndex: pageNumber - 1,
        segments: extractPageSegments(operatorList.fnArray, operatorList.argsArray),
      })
      page.cleanup()
    }
    return pages
  } finally {
    await document.destroy()
  }
}
