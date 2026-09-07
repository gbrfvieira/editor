import { describe, expect, test } from 'bun:test'
import { extractPdfVectorSegments, type Point } from './index'

function createPdf(content: string): Uint8Array {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << >> >>',
    `<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []

  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(new TextEncoder().encode(pdf).length)
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`
  }

  const xrefOffset = new TextEncoder().encode(pdf).length
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`

  return new TextEncoder().encode(pdf)
}

function expectPoint(actual: Point, expected: Point): void {
  expect(actual[0]).toBeCloseTo(expected[0])
  expect(actual[1]).toBeCloseTo(expected[1])
}

describe('extractPdfVectorSegments', () => {
  test('extracts one line from a synthetic PDF', async () => {
    const pages = await extractPdfVectorSegments(createPdf('10 20 m 30 40 l S'))

    expect(pages).toHaveLength(1)
    expect(pages[0].pageIndex).toBe(0)
    expect(pages[0].segments).toEqual([{ start: [10, 20], end: [30, 40] }])
  })

  test('extracts the four sides of a rectangle', async () => {
    const pages = await extractPdfVectorSegments(createPdf('10 20 m 110 20 l 110 70 l 10 70 l h S'))

    expect(pages[0].segments).toEqual([
      { start: [10, 20], end: [110, 20] },
      { start: [110, 20], end: [110, 70] },
      { start: [110, 70], end: [10, 70] },
      { start: [10, 70], end: [10, 20] },
    ])
  })

  test('applies scale and rotation from the current transformation matrix', async () => {
    const pages = await extractPdfVectorSegments(createPdf('0 2 -3 0 100 50 cm 10 20 m 30 40 l S'))
    const [segment] = pages[0].segments

    expectPoint(segment.start, [40, 70])
    expectPoint(segment.end, [-20, 110])
  })

  test('flattens curves without failing', async () => {
    const pages = await extractPdfVectorSegments(createPdf('10 10 m 20 80 80 80 90 10 c S'))

    expect(pages[0].segments.length).toBeGreaterThan(1)
    expectPoint(pages[0].segments[0].start, [10, 10])
    expectPoint(pages[0].segments.at(-1)!.end, [90, 10])
  })
})
