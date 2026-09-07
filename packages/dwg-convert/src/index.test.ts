import { afterEach, expect, mock, test } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const temp = join(process.cwd(), '.dwg-convert-test')
mkdirSync(temp, { recursive: true })
const original = process.env.ODA_FILE_CONVERTER_PATH

afterEach(() => {
  if (original === undefined) delete process.env.ODA_FILE_CONVERTER_PATH
  else process.env.ODA_FILE_CONVERTER_PATH = original
  rmSync(temp, { recursive: true, force: true })
  mock.restore()
})

test('reports a missing converter', async () => {
  process.env.ODA_FILE_CONVERTER_PATH = join(temp, 'missing.exe')
  const { convertDwgToDxf } = await import('./index')
  expect(await convertDwgToDxf(join(temp, 'plan.dwg'), temp)).toMatchObject({
    ok: false,
    reason: 'converter_not_found',
  })
})

test('invokes ODA with documented arguments', async () => {
  const executable = join(temp, 'ODAFileConverter.exe')
  const dwg = join(temp, 'plan.dwg')
  writeFileSync(executable, '')
  writeFileSync(dwg, '')
  process.env.ODA_FILE_CONVERTER_PATH = executable
  mock.module('node:child_process', () => ({
    execFile: (
      _file: string,
      args: string[],
      _options: unknown,
      callback: (error: null, stdout: string, stderr: string) => void,
    ) => {
      expect(args).toEqual([temp, temp, 'ACAD2018', 'DXF', '0', '1'])
      writeFileSync(join(temp, 'plan.dxf'), '')
      callback(null, '', '')
    },
  }))
  const { convertDwgToDxf } = await import('./index')
  expect(await convertDwgToDxf(dwg, temp)).toEqual({ ok: true, dxfPath: join(temp, 'plan.dxf') })
})

test('returns conversion_failed for process errors and timeout-like errors', async () => {
  const executable = join(temp, 'ODAFileConverter.exe')
  const dwg = join(temp, 'plan.dwg')
  writeFileSync(executable, '')
  writeFileSync(dwg, '')
  process.env.ODA_FILE_CONVERTER_PATH = executable
  mock.module('node:child_process', () => ({
    execFile: (
      _file: string,
      _args: string[],
      _options: unknown,
      callback: (error: Error, stdout: string, stderr: string) => void,
    ) => callback(new Error('timed out'), '', 'timeout'),
  }))
  const { convertDwgToDxf } = await import('./index')
  expect(await convertDwgToDxf(dwg, temp)).toMatchObject({ ok: false, reason: 'conversion_failed' })
})
