import { afterEach, beforeEach, expect, mock, test } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const temp = join(process.cwd(), '.dwg-convert-test')
const original = process.env.ODA_FILE_CONVERTER_PATH

beforeEach(() => {
  mkdirSync(temp, { recursive: true })
})

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
  const inDir = join(temp, 'in')
  const outDir = join(temp, 'out')
  const dwg = join(inDir, 'plan.dwg')
  mkdirSync(inDir, { recursive: true })
  mkdirSync(outDir, { recursive: true })
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
      expect(args).toEqual([inDir, outDir, 'ACAD2018', 'DXF', '0', '1'])
      writeFileSync(join(outDir, 'plan.dxf'), '')
      callback(null, '', '')
    },
  }))
  const { convertDwgToDxf } = await import('./index')
  expect(await convertDwgToDxf(dwg, outDir)).toEqual({
    ok: true,
    dxfPath: join(outDir, 'plan.dxf'),
  })
})

test('returns conversion_failed for process errors and timeout-like errors', async () => {
  const executable = join(temp, 'ODAFileConverter.exe')
  const inDir = join(temp, 'in')
  const dwg = join(inDir, 'plan.dwg')
  mkdirSync(inDir, { recursive: true })
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

test('rejects a source directory equal to the output directory', async () => {
  process.env.ODA_FILE_CONVERTER_PATH = join(temp, 'ODAFileConverter.exe')
  writeFileSync(join(temp, 'ODAFileConverter.exe'), '')
  const { convertDwgToDxf } = await import('./index')
  const result = await convertDwgToDxf(join(temp, 'plan.dwg'), temp)
  expect(result).toMatchObject({ ok: false, reason: 'conversion_failed' })
  expect((result as { message: string }).message).toContain('directory')
})

test('surfaces the ODA .dxf.err report when a specific file fails to convert', async () => {
  const executable = join(temp, 'ODAFileConverter.exe')
  const inDir = join(temp, 'in')
  const outDir = join(temp, 'out')
  const dwg = join(inDir, 'plan.dwg')
  mkdirSync(inDir, { recursive: true })
  mkdirSync(outDir, { recursive: true })
  writeFileSync(executable, '')
  writeFileSync(dwg, '')
  process.env.ODA_FILE_CONVERTER_PATH = executable
  mock.module('node:child_process', () => ({
    execFile: (
      _file: string,
      _args: string[],
      _options: unknown,
      callback: (error: null, stdout: string, stderr: string) => void,
    ) => {
      writeFileSync(join(outDir, 'plan.dxf.err'), 'Unexpected end of file: "plan.dwg".')
      callback(null, '', '')
    },
  }))
  const { convertDwgToDxf } = await import('./index')
  const result = await convertDwgToDxf(dwg, outDir)
  expect(result).toMatchObject({
    ok: false,
    reason: 'conversion_failed',
    message: 'Unexpected end of file: "plan.dwg".',
  })
})
