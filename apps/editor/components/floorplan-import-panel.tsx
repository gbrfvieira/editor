'use client'

import {
  type AnyNode,
  type AnyNodeId,
  DoorNode,
  GuideNode,
  saveAsset,
  useScene,
  WallNode,
  WindowNode,
} from '@pascal-app/core'
import { type DxfOpening, extractDxfVectorSegments } from '@pascal-app/dxf-vector-extract'
import {
  commitWalls,
  type DetectedWall,
  matchOpeningsToWalls,
  toWallNodePatches,
} from '@pascal-app/floorplan-import'
import { extractPdfVectorSegments } from '@pascal-app/pdf-vector-extract'
import { useViewer } from '@pascal-app/viewer'
import {
  detectDoorOpenings,
  detectWalls,
  detectWindowOpenings,
  type WindowOpening,
} from '@pascal-app/wall-detect'
import { useCallback, useState } from 'react'
import { recenterSegments, sameSegmentGeometry } from './floorplan-import-geometry'

type EditableWall = DetectedWall & { id: number }
type PreviewOpening = (DxfOpening | WindowOpening) & { id: number }

const WALL_PREVIEW_PAGE_SIZE = 50

// Matches DoorNode/WindowNode schema defaults — kept explicit here so the
// wall-local Y position math below stays correct regardless of schema drift.
const DOOR_HEIGHT = 2.1
const WINDOW_HEIGHT = 1.5
const WINDOW_SILL_HEIGHT = 0.9

function toEditableWalls(source: DetectedWall[]): EditableWall[] {
  return source.map((wall, id) => ({
    ...wall,
    start: [...wall.start] as [number, number],
    end: [...wall.end] as [number, number],
    id,
  }))
}

const PDF_POINTS_TO_METERS = 0.0254 / 72
// Common architectural plot/print scales (1:N). A PDF plotted at, say,
// 1:100 on paper needs the physical points-to-meters conversion multiplied
// by 100 to recover the depicted building's real-world size — the PDF
// itself carries no reliable signal for which scale was used, so this
// tries each candidate and keeps whichever makes wall-layer segment
// lengths land in a plausible 0.3-15m range, the same scoring approach
// already used for the DXF/DWG unit heuristic.
const PDF_PLOT_SCALE_CANDIDATES = [1, 20, 25, 50, 75, 100, 125, 150, 200, 250, 300]

function suggestPdfPlotScale(segments: { start: [number, number]; end: [number, number] }[]): {
  scale: number
  confident: boolean
} {
  const lengths = segments
    .map((segment) => Math.hypot(segment.end[0] - segment.start[0], segment.end[1] - segment.start[1]))
    .filter((length) => Number.isFinite(length) && length > 0)
  if (lengths.length < 3) return { scale: 1, confident: false }

  let best = { scale: 1, fraction: -1 }
  for (const candidate of PDF_PLOT_SCALE_CANDIDATES) {
    const factor = candidate * PDF_POINTS_TO_METERS
    const fraction =
      lengths.filter((length) => length * factor >= 0.3 && length * factor <= 15).length /
      lengths.length
    if (fraction > best.fraction) best = { scale: candidate, fraction }
  }
  return { scale: best.scale, confident: best.fraction >= 0.3 }
}

function updatePoint(
  wall: EditableWall,
  point: 'start' | 'end',
  axis: 0 | 1,
  value: string,
): EditableWall {
  const next = Number(value)
  if (!Number.isFinite(next)) return wall
  const coordinates = [...wall[point]] as [number, number]
  coordinates[axis] = next
  return { ...wall, [point]: coordinates }
}

/**
 * Small, deliberately app-local DXF workflow. It keeps the extracted geometry
 * editable until the user explicitly confirms, then adapts patches to the
 * scene's WallNode schema at the boundary.
 */
export function FloorplanImportPanel() {
  const levelId = useViewer((state) => state.selection.levelId)
  const createNode = useScene((state) => state.createNode)
  const createNodes = useScene((state) => state.createNodes)
  const [walls, setWalls] = useState<EditableWall[]>([])
  const [openings, setOpenings] = useState<PreviewOpening[]>([])
  const [removedWalls, setRemovedWalls] = useState<EditableWall[]>([])
  const [snapTolerance, setSnapTolerance] = useState(0.05)
  const [unitScale, setUnitScale] = useState(1)
  const [lastDxfText, setLastDxfText] = useState<string | null>(null)
  const [lastPdfSegments, setLastPdfSegments] = useState<
    { start: [number, number]; end: [number, number] }[] | null
  >(null)
  const [pdfPlotScale, setPdfPlotScale] = useState<number | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [converterMissing, setConverterMissing] = useState(false)
  const [converting, setConverting] = useState(false)
  const [pdfFallback, setPdfFallback] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [visibleWallCount, setVisibleWallCount] = useState(WALL_PREVIEW_PAGE_SIZE)

  const processDxfText = useCallback(
    (text: string, scale: number) => {
      setLastDxfText(text)
      setVisibleWallCount(WALL_PREVIEW_PAGE_SIZE)
      const dxfLayers = extractDxfVectorSegments(text)
      const segments = dxfLayers.flatMap((layer) =>
        layer.segments.map((segment) => ({
          ...segment,
          layer: layer.layer,
          start: [segment.start[0] * scale, segment.start[1] * scale] as [number, number],
          end: [segment.end[0] * scale, segment.end[1] * scale] as [number, number],
        })),
      )

      // Real CAD files are usually drawn far from (0,0) — survey coordinates,
      // or just wherever the drawing happened to sit in the original file.
      // Importing at those raw coordinates puts the walls thousands of
      // meters from where the camera starts (they're technically there, but
      // invisible and unreachable) and risks Three.js float-precision jitter
      // at that distance from the origin. Recenter the whole import on its
      // own bounding-box center before anything is previewed or created.
      const { segments: recenteredSegments, offset } = recenterSegments(segments)
      const recenter = (point: [number, number]): [number, number] => [
        point[0] - offset[0],
        point[1] - offset[1],
      ]
      const recenteredArcs = dxfLayers.flatMap((layer) =>
        (layer.arcs ?? []).map((arc) => ({
          ...arc,
          center: recenter([arc.center[0] * scale, arc.center[1] * scale]),
          radius: arc.radius * scale,
        })),
      )

      const blockOpenings = dxfLayers.flatMap((layer) =>
        (layer.openings ?? []).map((opening) => ({
          ...opening,
          position: recenter([opening.position[0] * scale, opening.position[1] * scale]),
        })),
      )

      const detected = detectWalls(recenteredSegments, {
        preferLayerContaining: 'PAREDE',
        snapToleranceM: snapTolerance,
      }).walls

      // Doors are commonly drawn as pure geometry (a ~90° swing arc + a
      // radial leaf line) rather than a named block — detectDoorOpenings
      // recognizes that symbol independently of layer/block naming.
      // Skip an arc-detected door that's essentially the same opening as
      // one already found by name (rare, but both paths can fire on a file
      // that mixes conventions).
      const arcDoors = detectDoorOpenings(recenteredArcs, recenteredSegments, detected, {
        metersPerUnit: 1,
      }).filter(
        (door) =>
          !blockOpenings.some(
            (opening) =>
              Math.hypot(
                opening.position[0] - door.position[0],
                opening.position[1] - door.position[1],
              ) < 0.4,
          ),
      )

      const geometricWindows = detectWindowOpenings(recenteredSegments, detected).filter(
        (window) =>
          !blockOpenings.some(
            (opening) =>
              opening.type === 'window' &&
              Math.hypot(
                opening.position[0] - window.position[0],
                opening.position[1] - window.position[1],
              ) < 0.4,
          ),
      )
      const windowSymbolSegmentIndices = new Set(
        geometricWindows.flatMap((window) => window.segmentIndices),
      )
      const windowSymbolSegments = [...windowSymbolSegmentIndices]
        .map((segmentIndex) => recenteredSegments[segmentIndex])
        .filter((segment) => segment !== undefined)
      const previewWalls = detected.filter(
        (wall) => !windowSymbolSegments.some((segment) => sameSegmentGeometry(wall, segment)),
      )
      setWalls(toEditableWalls(previewWalls))

      let openingId = 0
      setOpenings([
        ...blockOpenings.map((opening) => ({ ...opening, id: openingId++ })),
        ...arcDoors.map((door) => ({
          type: 'door' as const,
          position: door.position,
          width: door.width,
          rotation: door.rotation,
          blockName: 'arco de porta',
          id: openingId++,
        })),
        ...geometricWindows.map((window) => ({ ...window, id: openingId++ })),
      ])

      const openingCount = blockOpenings.length + arcDoors.length + geometricWindows.length
      setStatus(
        `${previewWalls.length} parede(s) e ${openingCount} vão(s) detectados (recentralizado na origem). Revise e confirme.`,
      )
    },
    [snapTolerance],
  )

  const processPdfSegments = useCallback(
    (
      rawSegments: { start: [number, number]; end: [number, number] }[],
      plotScale: number | null,
      unitMultiplier: number,
    ) => {
      setLastPdfSegments(rawSegments)
      // PDF user-space coordinates are always in points (1/72 inch) — unlike
      // a DXF's ambiguous drawing unit, that base conversion is a hard
      // PDF-spec fact, not a guess. But an architectural PDF is almost
      // always plotted at a reduced scale (1:50, 1:100...), so the physical
      // point size alone still isn't the depicted building's real-world
      // size — without correcting for that, walls come out either
      // "gigantesco" (no conversion at all) or shrunk to a sliver (physical
      // conversion only, minSegmentLengthM then discards nearly everything).
      // Try common plot scales and keep whichever makes segment lengths look
      // like a real building, same scoring idea as the DXF/DWG unit guess.
      const suggestion =
        plotScale === null ? suggestPdfPlotScale(rawSegments) : { scale: plotScale, confident: true }
      setPdfPlotScale(suggestion.scale)
      const factor = suggestion.scale * PDF_POINTS_TO_METERS * unitMultiplier
      const scaledSegments = rawSegments.map((segment) => ({
        ...segment,
        start: [segment.start[0] * factor, segment.start[1] * factor] as [number, number],
        end: [segment.end[0] * factor, segment.end[1] * factor] as [number, number],
      }))
      const { segments } = recenterSegments(scaledSegments)
      const detected = detectWalls(segments, {
        preferLayerContaining: 'PAREDE',
        snapToleranceM: snapTolerance,
      }).walls
      setWalls(toEditableWalls(detected))
      setStatus(
        `${detected.length} parede(s) detectada(s) (escala 1:${suggestion.scale}${suggestion.confident ? '' : ', incerta — ajuste manualmente'}, recentralizado na origem). Revise e confirme.`,
      )
    },
    [snapTolerance],
  )

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return
      setFileName(file.name)
      setError(null)
      setStatus(null)
      setPdfFallback(null)
      setOpenings([])
      setRemovedWalls([])
      setVisibleWallCount(WALL_PREVIEW_PAGE_SIZE)
      setConverterMissing(false)
      setLastPdfSegments(null)
      const isDwg = file.name.toLocaleLowerCase().endsWith('.dwg')
      const isPdf = file.name.toLocaleLowerCase().endsWith('.pdf')
      try {
        if (isDwg) {
          setWalls([])
          setConverting(true)
          const body = new FormData()
          body.set('file', file)
          const response = await fetch('/api/floorplan/convert-dwg', { method: 'POST', body })
          const result = (await response.json()) as
            | { ok: true; dxf: string }
            | { ok: false; reason: string; message?: string }
          setConverting(false)
          if (!result.ok) {
            if (result.reason === 'converter_not_found') setConverterMissing(true)
            setError(
              result.message ??
                'Não foi possível converter o DWG. Verifique se o ODA File Converter está instalado.',
            )
            return
          }
          processDxfText(result.dxf, unitScale)
          return
        }
        if (isPdf) {
          const rawSegments = (
            await extractPdfVectorSegments(new Uint8Array(await file.arrayBuffer()))
          ).flatMap((page) => page.segments)
          if (rawSegments.length === 0) {
            setWalls([])
            setPdfFallback(file)
            setStatus(
              'Este PDF não contém vetores de linha. Você pode adicioná-lo como guia visual.',
            )
            return
          }
          processPdfSegments(rawSegments, null, unitScale)
          return
        }
        processDxfText(await file.text(), unitScale)
      } catch (cause) {
        setConverting(false)
        setWalls([])
        setError(cause instanceof Error ? cause.message : 'Não foi possível ler o arquivo.')
      }
    },
    [processDxfText, processPdfSegments, unitScale],
  )

  const changeUnitScale = (scale: number) => {
    setUnitScale(scale)
    if (lastPdfSegments) {
      setRemovedWalls([])
      processPdfSegments(lastPdfSegments, pdfPlotScale, scale)
      return
    }
    if (lastDxfText) {
      setRemovedWalls([])
      processDxfText(lastDxfText, scale)
    }
  }

  const changePdfPlotScale = (scale: number) => {
    if (!lastPdfSegments) return
    setRemovedWalls([])
    processPdfSegments(lastPdfSegments, scale, unitScale)
  }

  const updateWall = (id: number, update: (wall: EditableWall) => EditableWall) => {
    setWalls((current) => current.map((wall) => (wall.id === id ? update(wall) : wall)))
  }

  const removeWall = (id: number) => {
    const removed = walls.find((wall) => wall.id === id)
    if (removed) setRemovedWalls((history) => [...history, removed])
    setWalls((current) => current.filter((wall) => wall.id !== id))
  }

  const undoRemove = () => {
    setRemovedWalls((history) => {
      const restored = history.at(-1)
      if (restored) setWalls((current) => [...current, restored])
      return restored ? history.slice(0, -1) : history
    })
  }

  const confirm = () => {
    if (!levelId) {
      setError('Selecione um nível antes de confirmar as paredes.')
      return
    }
    // The user has already reviewed/edited/deleted each wall in the preview
    // list above, so that review is the confidence gate — don't silently
    // drop low-confidence walls a second time here.
    const patches = toWallNodePatches(walls, { minConfidence: 0 })
    // Build every wall/door/window node up front and create them in a single
    // batched store update instead of one createNode() call per node — with
    // hundreds of walls (real DWG/DXF floor plans easily produce that many),
    // calling createNode() in a loop triggers a full store update and
    // re-render per node and can freeze the tab for tens of seconds.
    const ops: { node: AnyNode; parentId: AnyNodeId }[] = []
    const createdWalls: {
      id: string
      start: [number, number]
      end: [number, number]
      thickness: number
    }[] = []
    commitWalls(
      patches,
      {
        createNode: (data, parentId) => {
          const wall = WallNode.parse(data)
          ops.push({ node: wall, parentId: parentId as AnyNodeId })
          createdWalls.push({
            id: wall.id,
            start: wall.start,
            end: wall.end,
            thickness: wall.thickness ?? 0.2,
          })
        },
      },
      levelId,
    )

    const openingPatches = matchOpeningsToWalls(
      openings.map((opening) => ({
        type: opening.type,
        position: opening.position,
        width: opening.width,
      })),
      createdWalls,
    )
    for (const patch of openingPatches) {
      if (patch.type === 'door') {
        const door = DoorNode.parse({
          wallId: patch.wallId,
          parentId: patch.wallId,
          position: [patch.localX, DOOR_HEIGHT / 2, 0],
          width: patch.width,
          height: DOOR_HEIGHT,
        })
        ops.push({ node: door, parentId: patch.wallId as AnyNodeId })
      } else {
        const windowNode = WindowNode.parse({
          wallId: patch.wallId,
          parentId: patch.wallId,
          position: [patch.localX, WINDOW_SILL_HEIGHT + WINDOW_HEIGHT / 2, 0],
          width: patch.width,
          height: WINDOW_HEIGHT,
        })
        ops.push({ node: windowNode, parentId: patch.wallId as AnyNodeId })
      }
    }
    createNodes(ops)

    const skippedOpenings = openings.length - openingPatches.length
    setStatus(
      `${patches.length} parede(s), ${openingPatches.length} vão(s) adicionados ao nível` +
        (skippedOpenings > 0
          ? ` (${skippedOpenings} vão(s) não encontraram parede próxima e foram ignorados — ajuste manualmente).`
          : '.'),
    )
  }

  const addPdfGuide = async () => {
    if (!pdfFallback || !levelId) {
      setError('Selecione um nível antes de adicionar o PDF como guia.')
      return
    }
    try {
      const url = await saveAsset(pdfFallback)
      const guide = GuideNode.parse({
        name: pdfFallback.name.replace(/\.pdf$/i, ''),
        url,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: 1,
        opacity: 50,
        scaleReference: null,
      })
      createNode(guide, levelId as AnyNodeId)
      setStatus('PDF adicionado como guia visual no nível.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o PDF como guia.')
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 p-3">
      <div>
        <h3 className="font-medium text-sm">Importar planta (DXF, DWG ou PDF)</h3>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Carregue um arquivo, confira a unidade abaixo (a maioria dos DWG/DXF de arquitetura usa
          milímetros ou centímetros), revise as paredes detectadas e confirme. DWG é convertido para
          DXF automaticamente (local e gratuito).
        </p>
      </div>

      <label className="flex cursor-pointer items-center justify-center rounded-lg bg-muted/50 px-3 py-2 text-sm hover:bg-muted">
        <span>{fileName ?? 'Escolher arquivo DXF ou DWG'}</span>
        <input
          accept=".dxf,.dwg,.pdf,text/plain,application/pdf"
          className="sr-only"
          onChange={(event) => void handleFile(event.target.files?.[0])}
          type="file"
        />
      </label>

      <label className="flex items-center justify-between gap-2 text-xs">
        <span>Unidade do arquivo</span>
        <select
          aria-label="unidade do arquivo"
          className="rounded border border-border/60 bg-background px-1.5 py-1"
          onChange={(event) => changeUnitScale(Number(event.target.value))}
          value={unitScale}
        >
          <option value={1}>Metros</option>
          <option value={0.01}>Centímetros</option>
          <option value={0.001}>Milímetros</option>
        </select>
      </label>

      {lastPdfSegments ? (
        <label className="flex items-center justify-between gap-2 text-xs">
          <span>Escala da planta (PDF)</span>
          <select
            aria-label="escala da planta em pdf"
            className="rounded border border-border/60 bg-background px-1.5 py-1"
            onChange={(event) => changePdfPlotScale(Number(event.target.value))}
            value={pdfPlotScale ?? 1}
          >
            {PDF_PLOT_SCALE_CANDIDATES.map((candidate) => (
              <option key={candidate} value={candidate}>
                1:{candidate}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="flex items-center justify-between gap-2 text-xs">
        <span>Snap de cantos (m)</span>
        <input
          aria-label="snap tolerance"
          className="w-24 rounded border border-border/60 bg-background px-1.5 py-1"
          min="0"
          onChange={(event) => {
            const value = Number(event.target.value)
            if (Number.isFinite(value)) setSnapTolerance(value)
          }}
          step="0.01"
          type="number"
          value={snapTolerance}
        />
      </label>

      {converting ? (
        <p className="text-muted-foreground text-xs">Convertendo DWG para DXF…</p>
      ) : null}

      {converterMissing ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-muted-foreground">
          <p className="font-medium text-foreground">ODA File Converter não encontrado</p>
          <p className="mt-1">
            A conversão de DWG roda localmente e é gratuita, mas precisa do ODA File Converter
            instalado nesta máquina (uma vez só). Baixe em opendesign.com/guestfiles, instale e
            tente carregar o DWG de novo — a conversão passa a ser automática, sem nenhum passo
            manual. O arquivo não é enviado para nenhum serviço externo.
          </p>
        </div>
      ) : null}

      {error ? <p className="text-red-500 text-xs">{error}</p> : null}
      {status ? <p className="text-emerald-600 text-xs">{status}</p> : null}

      {walls.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            {walls.slice(0, visibleWallCount).map((wall, index) => (
              <div className="rounded-lg bg-muted/30 p-2" key={wall.id}>
                <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Parede {index + 1}</span>
                  <div className="flex items-center gap-2">
                    <span>{Math.round(wall.confidence * 100)}% confiança</span>
                    <button
                      aria-label={`Excluir parede ${index + 1}`}
                      className="text-red-500 hover:text-red-600"
                      onClick={() => removeWall(wall.id)}
                      type="button"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {(['start', 'end'] as const).flatMap((point) =>
                    ([0, 1] as const).map((axis) => (
                      <input
                        aria-label={`${point} ${axis === 0 ? 'x' : 'y'}`}
                        className="min-w-0 rounded border border-border/60 bg-background px-1.5 py-1 text-xs"
                        key={`${point}-${axis}`}
                        onChange={(event) =>
                          updateWall(wall.id, (current) =>
                            updatePoint(current, point, axis, event.target.value),
                          )
                        }
                        step="0.01"
                        type="number"
                        value={wall[point][axis]}
                      />
                    )),
                  )}
                  <input
                    aria-label="thickness"
                    className="min-w-0 rounded border border-border/60 bg-background px-1.5 py-1 text-xs"
                    onChange={(event) => {
                      const thickness = Number(event.target.value)
                      if (Number.isFinite(thickness)) {
                        updateWall(wall.id, (current) => ({ ...current, thickness }))
                      }
                    }}
                    step="0.01"
                    type="number"
                    value={wall.thickness}
                  />
                </div>
              </div>
            ))}
          </div>
          {visibleWallCount < walls.length ? (
            <button
              className="rounded-lg border border-border/60 px-3 py-2 text-xs hover:bg-muted"
              onClick={() => setVisibleWallCount((count) => count + WALL_PREVIEW_PAGE_SIZE)}
              type="button"
            >
              Carregar mais ({Math.min(WALL_PREVIEW_PAGE_SIZE, walls.length - visibleWallCount)} de{' '}
              {walls.length - visibleWallCount})
            </button>
          ) : null}
        </div>
      ) : null}

      {removedWalls.length > 0 ? (
        <button
          className="rounded-lg border border-border/60 px-3 py-2 text-left text-xs hover:bg-muted"
          onClick={undoRemove}
          type="button"
        >
          Desfazer exclusão ({removedWalls.length})
        </button>
      ) : null}

      {openings.length > 0 ? (
        <div className="rounded-lg border border-border/60 p-2 text-xs">
          <div className="mb-1 font-medium">Vãos detectados (prévia)</div>
          <div className="flex flex-col gap-1 text-muted-foreground">
            {openings.map((opening) => (
              <div className="flex items-center justify-between" key={opening.id}>
                <span>
                  {opening.type === 'door' ? 'Porta' : 'Janela'}
                  {'blockName' in opening ? ` · ${opening.blockName}` : ' · geometria CAD'}
                </span>
                <span>
                  {opening.width.toFixed(2)} m · ({opening.position[0].toFixed(2)},{' '}
                  {opening.position[1].toFixed(2)})
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {pdfFallback ? (
        <button
          className="rounded-lg border border-border/60 px-3 py-2 font-medium text-sm hover:bg-muted"
          onClick={() => void addPdfGuide()}
          type="button"
        >
          Adicionar PDF como guia
        </button>
      ) : null}

      <button
        className="rounded-lg bg-primary px-3 py-2 font-medium text-primary-foreground text-sm disabled:cursor-not-allowed disabled:opacity-50"
        disabled={walls.length === 0}
        onClick={confirm}
        type="button"
      >
        Confirmar paredes
      </button>
    </div>
  )
}
