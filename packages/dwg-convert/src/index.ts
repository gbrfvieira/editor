import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, parse, resolve } from 'node:path'

export type ConversionResult =
  | { ok: true; dxfPath: string }
  | { ok: false; reason: 'converter_not_found' | 'conversion_failed'; message: string }

const TIMEOUT_MS = 120_000
const ODA_EXECUTABLE = 'ODAFileConverter.exe'

function converterCandidates(root: string): string[] {
  const candidates = [join(root, ODA_EXECUTABLE)]
  const visit = (directory: string, depth: number): void => {
    if (depth > 3 || !existsSync(directory)) return
    let entries
    try {
      entries = readdirSync(directory, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const child = join(directory, entry.name)
      if (entry.name.toLowerCase().startsWith('oda')) candidates.push(join(child, ODA_EXECUTABLE))
      visit(child, depth + 1)
    }
  }
  visit(root, 0)
  return candidates
}

function findConverter(): string | undefined {
  const override = process.env.ODA_FILE_CONVERTER_PATH
  if (override) return existsSync(override) ? override : undefined
  const roots = [
    process.env.ProgramFiles,
    process.env['ProgramFiles(x86)'],
    'C:\\Program Files',
    'C:\\Program Files (x86)',
  ]
  for (const root of roots.filter((value): value is string => Boolean(value))) {
    for (const candidate of converterCandidates(root)) {
      if (existsSync(candidate)) return candidate
    }
  }
  return undefined
}

function runConverter(
  executable: string,
  args: string[],
): Promise<{ code: number | null; error?: Error }> {
  return new Promise((resolvePromise) => {
    execFile(
      executable,
      args,
      { timeout: TIMEOUT_MS, windowsHide: true },
      (error, _stdout, stderr) => {
        if (error) {
          const detail = stderr?.trim()
          resolvePromise({
            code:
              typeof (error as NodeJS.ErrnoException).code === 'number'
                ? Number((error as NodeJS.ErrnoException).code)
                : null,
            error: new Error(detail || error.message),
          })
          return
        }
        resolvePromise({ code: 0 })
      },
    )
  })
}

export async function convertDwgToDxf(dwgPath: string, outDir: string): Promise<ConversionResult> {
  const executable = findConverter()
  if (!executable) {
    return {
      ok: false,
      reason: 'converter_not_found',
      message:
        'ODA File Converter executable was not found. Set ODA_FILE_CONVERTER_PATH or install it.',
    }
  }
  const sourceDir = dirname(resolve(dwgPath))
  const targetDir = resolve(outDir)
  if (sourceDir === targetDir) {
    return {
      ok: false,
      reason: 'conversion_failed',
      message:
        'convertDwgToDxf requires the DWG source directory and the output directory to differ — ' +
        'ODA File Converter silently converts nothing when they are the same path.',
    }
  }
  const args = [sourceDir, targetDir, 'ACAD2018', 'DXF', '0', '1']
  try {
    mkdirSync(targetDir, { recursive: true })
    const result = await runConverter(executable, args)
    if (result.error || result.code !== 0) {
      return {
        ok: false,
        reason: 'conversion_failed',
        message: result.error?.message ?? `ODA File Converter exited with code ${result.code}`,
      }
    }
    const dxfPath = join(targetDir, `${parse(dwgPath).name}.dxf`)
    if (!existsSync(dxfPath)) {
      // On a per-file failure, ODA writes a sibling `<name>.dxf.err` report
      // instead of the `.dxf` (e.g. "Unexpected end of file", unsupported
      // DWG version) rather than a nonzero process exit code.
      const errPath = `${dxfPath}.err`
      const detail = existsSync(errPath) ? readFileSync(errPath, 'utf8').trim() : undefined
      return {
        ok: false,
        reason: 'conversion_failed',
        message: detail || `Converter completed but did not create ${dxfPath}`,
      }
    }
    return { ok: true, dxfPath }
  } catch (error) {
    return {
      ok: false,
      reason: 'conversion_failed',
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

export const findOdaFileConverter = findConverter
