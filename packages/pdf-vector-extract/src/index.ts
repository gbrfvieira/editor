import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs'

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
  /** Maximum deviation, in transformed page units, when flattening curves. */
  curveTolerance?: number
}

type Matrix = [number, number, number, number, number, number]

const IDENTITY_MATRIX: Matrix = [1, 0, 0, 1, 0, 0]
const DEFAULT_CURVE_TOLERANCE = 0.5
const MAX_CURVE_SUBDIVISION_DEPTH = 12

function multiplyMatrices(left: Matrix, right: Matrix): Matrix {
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

function transformPoint(matrix: Matrix, x: number, y: number): Point {
  const [a, b, c, d, e, f] = matrix
  return [a * x + c * y + e, b * x + d * y + f]
}

function pointsEqual(left: Point, right: Point): boolean {
  return left[0] === right[0] && left[1] === right[1]
}

function midpoint(left: Point, right: Point): Point {
  return [(left[0] + right[0]) / 2, (left[1] + right[1]) / 2]
}

function squaredDistanceToLine(point: Point, start: Point, end: Point): number {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const squaredLength = dx * dx + dy * dy

  if (squaredLength === 0) {
    const pointDx = point[0] - start[0]
    const pointDy = point[1] - start[1]
    return pointDx * pointDx + pointDy * pointDy
  }

  const cross = dx * (start[1] - point[1]) - (start[0] - point[0]) * dy
  return (cross * cross) / squaredLength
}

function flattenCubicBezier(
  start: Point,
  control1: Point,
  control2: Point,
  end: Point,
  tolerance: number,
  segments: LineSegment[],
  depth = 0,
): void {
  const toleranceSquared = tolerance * tolerance
  const isFlatEnough =
    squaredDistanceToLine(control1, start, end) <= toleranceSquared &&
    squaredDistanceToLine(control2, start, end) <= toleranceSquared

  if (isFlatEnough || depth >= MAX_CURVE_SUBDIVISION_DEPTH) {
    segments.push({ start, end })
    return
  }

  const startControl = midpoint(start, control1)
  const controls = midpoint(control1, control2)
  const controlEnd = midpoint(control2, end)
  const leftControl = midpoint(startControl, controls)
  const rightControl = midpoint(controls, controlEnd)
  const middle = midpoint(leftControl, rightControl)

  flattenCubicBezier(start, startControl, leftControl, middle, tolerance, segments, depth + 1)
  flattenCubicBezier(middle, rightControl, controlEnd, end, tolerance, segments, depth + 1)
}

function flattenQuadraticBezier(
  start: Point,
  control: Point,
  end: Point,
  tolerance: number,
  segments: LineSegment[],
): void {
  const control1: Point = [
    start[0] + (2 / 3) * (control[0] - start[0]),
    start[1] + (2 / 3) * (control[1] - start[1]),
  ]
  const control2: Point = [
    end[0] + (2 / 3) * (control[0] - end[0]),
    end[1] + (2 / 3) * (control[1] - end[1]),
  ]
  flattenCubicBezier(start, control1, control2, end, tolerance, segments)
}

function asMatrix(values: ArrayLike<number>): Matrix {
  return [values[0], values[1], values[2], values[3], values[4], values[5]]
}

function extractPageSegments(
  fnArray: ArrayLike<number>,
  argsArray: ArrayLike<unknown>,
  curveTolerance: number,
): LineSegment[] {
  const segments: LineSegment[] = []
  const matrixStack: Matrix[] = []
  let matrix: Matrix = [...IDENTITY_MATRIX]
  let currentPoint: Point | undefined
  let subpathStart: Point | undefined

  const moveTo = (x: number, y: number): void => {
    currentPoint = transformPoint(matrix, x, y)
    subpathStart = currentPoint
  }

  const lineTo = (x: number, y: number): void => {
    const end = transformPoint(matrix, x, y)
    if (currentPoint) {
      segments.push({ start: currentPoint, end })
    }
    currentPoint = end
  }

  const curveTo = (control1: Point, control2: Point, end: Point): void => {
    if (currentPoint) {
      flattenCubicBezier(currentPoint, control1, control2, end, curveTolerance, segments)
    }
    currentPoint = end
  }

  const closePath = (): void => {
    if (currentPoint && subpathStart && !pointsEqual(currentPoint, subpathStart)) {
      segments.push({ start: currentPoint, end: subpathStart })
    }
    currentPoint = subpathStart
  }

  const rectangle = (x: number, y: number, width: number, height: number): void => {
    const first = transformPoint(matrix, x, y)
    const second = transformPoint(matrix, x + width, y)
    const third = transformPoint(matrix, x + width, y + height)
    const fourth = transformPoint(matrix, x, y + height)
    segments.push(
      { start: first, end: second },
      { start: second, end: third },
      { start: third, end: fourth },
      { start: fourth, end: first },
    )
    currentPoint = first
    subpathStart = first
  }

  const processPath = (pathOperations: ArrayLike<number>, coordinates: ArrayLike<number>): void => {
    let coordinateIndex = 0

    for (let index = 0; index < pathOperations.length; index += 1) {
      switch (pathOperations[index]) {
        case OPS.moveTo:
          moveTo(coordinates[coordinateIndex], coordinates[coordinateIndex + 1])
          coordinateIndex += 2
          break
        case OPS.lineTo:
          lineTo(coordinates[coordinateIndex], coordinates[coordinateIndex + 1])
          coordinateIndex += 2
          break
        case OPS.curveTo: {
          const control1 = transformPoint(
            matrix,
            coordinates[coordinateIndex],
            coordinates[coordinateIndex + 1],
          )
          const control2 = transformPoint(
            matrix,
            coordinates[coordinateIndex + 2],
            coordinates[coordinateIndex + 3],
          )
          const end = transformPoint(
            matrix,
            coordinates[coordinateIndex + 4],
            coordinates[coordinateIndex + 5],
          )
          curveTo(control1, control2, end)
          coordinateIndex += 6
          break
        }
        case OPS.curveTo2: {
          const end = transformPoint(
            matrix,
            coordinates[coordinateIndex + 2],
            coordinates[coordinateIndex + 3],
          )
          curveTo(
            currentPoint ?? transformPoint(matrix, 0, 0),
            transformPoint(matrix, coordinates[coordinateIndex], coordinates[coordinateIndex + 1]),
            end,
          )
          coordinateIndex += 4
          break
        }
        case OPS.curveTo3: {
          const end = transformPoint(
            matrix,
            coordinates[coordinateIndex + 2],
            coordinates[coordinateIndex + 3],
          )
          curveTo(
            transformPoint(matrix, coordinates[coordinateIndex], coordinates[coordinateIndex + 1]),
            end,
            end,
          )
          coordinateIndex += 4
          break
        }
        case OPS.closePath:
          closePath()
          break
        case OPS.rectangle:
          rectangle(
            coordinates[coordinateIndex],
            coordinates[coordinateIndex + 1],
            coordinates[coordinateIndex + 2],
            coordinates[coordinateIndex + 3],
          )
          coordinateIndex += 4
          break
        default:
          break
      }
    }
  }

  const processCompactPath = (data: ArrayLike<number>): void => {
    let index = 0

    while (index < data.length) {
      const operation = data[index]
      index += 1

      switch (operation) {
        case 0:
          moveTo(data[index], data[index + 1])
          index += 2
          break
        case 1:
          lineTo(data[index], data[index + 1])
          index += 2
          break
        case 2: {
          const control1 = transformPoint(matrix, data[index], data[index + 1])
          const control2 = transformPoint(matrix, data[index + 2], data[index + 3])
          const end = transformPoint(matrix, data[index + 4], data[index + 5])
          curveTo(control1, control2, end)
          index += 6
          break
        }
        case 3: {
          const control = transformPoint(matrix, data[index], data[index + 1])
          const end = transformPoint(matrix, data[index + 2], data[index + 3])
          if (currentPoint) {
            flattenQuadraticBezier(currentPoint, control, end, curveTolerance, segments)
          }
          currentPoint = end
          index += 4
          break
        }
        case 4:
          closePath()
          break
        default:
          return
      }
    }
  }

  for (let index = 0; index < fnArray.length; index += 1) {
    const operation = fnArray[index]
    const args = argsArray[index] as ArrayLike<number> | undefined

    switch (operation) {
      case OPS.save:
        matrixStack.push([...matrix])
        break
      case OPS.restore:
        matrix = matrixStack.pop() ?? [...IDENTITY_MATRIX]
        break
      case OPS.transform:
        if (args) {
          matrix = multiplyMatrices(matrix, asMatrix(args))
        }
        break
      case OPS.paintFormXObjectBegin:
        matrixStack.push([...matrix])
        if (args?.[0]) {
          matrix = multiplyMatrices(matrix, asMatrix(args[0] as unknown as ArrayLike<number>))
        }
        break
      case OPS.paintFormXObjectEnd:
        matrix = matrixStack.pop() ?? [...IDENTITY_MATRIX]
        break
      case OPS.constructPath:
        if (args) {
          if (typeof args[0] === 'number') {
            const pathData = args[1] as unknown as ArrayLike<ArrayLike<number>>
            if (pathData[0]) {
              processCompactPath(pathData[0])
            }
          } else {
            processPath(
              args[0] as unknown as ArrayLike<number>,
              args[1] as unknown as ArrayLike<number>,
            )
          }
        }
        break
      case OPS.moveTo:
        if (args) {
          moveTo(args[0], args[1])
        }
        break
      case OPS.lineTo:
        if (args) {
          lineTo(args[0], args[1])
        }
        break
      case OPS.curveTo:
      case OPS.curveTo2:
      case OPS.curveTo3:
      case OPS.closePath:
      case OPS.rectangle:
        processPath([operation], args ?? [])
        break
      default:
        break
    }
  }

  return segments
}

/**
 * Extracts straight line segments from every page of a PDF without rasterizing it.
 */
export async function extractPdfVectorSegments(
  pdfBytes: Uint8Array | ArrayBuffer,
  options: ExtractPdfVectorOptions = {},
): Promise<PageSegments[]> {
  const curveTolerance = options.curveTolerance ?? DEFAULT_CURVE_TOLERANCE
  if (!(curveTolerance > 0) || !Number.isFinite(curveTolerance)) {
    throw new RangeError('curveTolerance must be a positive, finite number')
  }

  const data =
    pdfBytes instanceof ArrayBuffer ? new Uint8Array(pdfBytes.slice(0)) : new Uint8Array(pdfBytes)
  const loadingTask = getDocument({ data })

  try {
    const document = await loadingTask.promise
    const pages: PageSegments[] = []

    try {
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber)
        const operatorList = await page.getOperatorList()
        pages.push({
          pageIndex: pageNumber - 1,
          segments: extractPageSegments(
            operatorList.fnArray,
            operatorList.argsArray,
            curveTolerance,
          ),
        })
        page.cleanup()
      }
    } finally {
      await document.destroy()
    }

    return pages
  } catch (error) {
    await loadingTask.destroy()
    throw error
  }
}
