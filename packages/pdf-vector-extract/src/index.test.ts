import { describe, expect, test } from 'bun:test'
import { extractPdfVectorSegments } from './index'

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
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return new TextEncoder().encode(pdf)
}

describe('extractPdfVectorSegments', () => {
  test('extracts a single straight line', async () => {
    const pages = await extractPdfVectorSegments(createPdf('10 10 m 40 10 l S'))
    expect(pages[0]?.segments).toEqual([{ start: [10, 10], end: [40, 10] }])
  })

  test('extracts the four sides of a rectangle', async () => {
    const pages = await extractPdfVectorSegments(createPdf('20 20 50 30 re S'))
    expect(pages[0]?.segments).toHaveLength(4)
    expect(pages[0]?.segments).toContainEqual({ start: [20, 20], end: [70, 20] })
    expect(pages[0]?.segments).toContainEqual({ start: [70, 50], end: [20, 50] })
  })

  test('extracts a transformed line from a synthetic PDF', async () => {
    const pages = await extractPdfVectorSegments(createPdf('0 2 -3 0 100 50 cm 10 20 m 30 40 l S'))
    expect(pages).toHaveLength(1)
    expect(pages[0].segments[0]).toEqual({ start: [40, 70], end: [-20, 110] })
  })

  test('does not fail on a curve operator', async () => {
    const pages = await extractPdfVectorSegments(createPdf('10 10 m 20 80 80 80 90 10 c S'))
    expect(pages[0].segments).toHaveLength(1)
    expect(pages[0].segments[0].end).toEqual([90, 10])
  })
})
