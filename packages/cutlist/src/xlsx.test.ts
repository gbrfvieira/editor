import { expect, test } from 'bun:test'
import ExcelJS from 'exceljs'
import type { CutListReport } from './index'
import { toXlsx } from './xlsx'

test('writes a readable xlsx with the three cut list sheets', async () => {
  const report: CutListReport = {
    panels: [
      {
        cabinetId: 'cabinet-1',
        label: 'side',
        widthMm: 600,
        heightMm: 800,
        thicknessMm: 18,
        quantity: 2,
      },
    ],
    hardware: [{ cabinetId: 'cabinet-1', item: 'hinge', quantity: 4 }],
    edgeBanding: [{ cabinetId: 'cabinet-1', panel: 'door', lengthMm: 3000 }],
  }
  const buffer = await toXlsx(report)
  expect(buffer.subarray(0, 2).toString()).toBe('PK')

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
    'Painéis',
    'Ferragens',
    'Fita de borda',
  ])
  expect(workbook.getWorksheet('Painéis')?.rowCount).toBe(2)
  expect(workbook.getWorksheet('Ferragens')?.getRow(2).getCell(3).value).toBe(4)
  expect(workbook.getWorksheet('Fita de borda')?.getRow(2).getCell(3).value).toBe(3000)
})
