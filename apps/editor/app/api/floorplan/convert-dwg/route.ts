import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { convertDwgToDxf } from '@pascal-app/dwg-convert'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { guardSceneApiRequest, sceneApiJson, sceneApiPreflight } from '@/lib/scene-api-security'

export const dynamic = 'force-dynamic'

// DWG has no size-efficient text form; cap well above any real residential
// floor plan to keep the local ODA File Converter call bounded.
const MAX_DWG_BYTES = 100 * 1024 * 1024

export function OPTIONS(request: NextRequest) {
  return sceneApiPreflight(request)
}

export async function POST(request: NextRequest) {
  const guard = guardSceneApiRequest(request, { skipAuth: true })
  if (guard) return guard

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return sceneApiJson(request, { ok: false, reason: 'invalid_request' }, { status: 400 })
  }
  if (file.size === 0 || file.size > MAX_DWG_BYTES) {
    return sceneApiJson(request, { ok: false, reason: 'invalid_request' }, { status: 400 })
  }

  const workDir = await mkdtemp(join(tmpdir(), 'pascal-dwg-'))
  try {
    // ODA File Converter silently converts nothing when the source and
    // output directories are the same, so these must stay distinct.
    const inDir = join(workDir, 'in')
    const outDir = join(workDir, 'out')
    await mkdir(inDir)
    await mkdir(outDir)
    const dwgPath = join(inDir, `${randomUUID()}.dwg`)
    await writeFile(dwgPath, Buffer.from(await file.arrayBuffer()))

    const result = await convertDwgToDxf(dwgPath, outDir)
    if (!result.ok) {
      const status = result.reason === 'converter_not_found' ? 503 : 422
      return sceneApiJson(request, { ok: false, ...result }, { status })
    }

    const dxf = await readFile(result.dxfPath, 'utf8')
    return sceneApiJson(request, { ok: true, dxf })
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}

export function GET() {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 })
}
