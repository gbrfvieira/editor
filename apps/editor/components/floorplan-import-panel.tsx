'use client'

import { type AnyNodeId, GuideNode, saveAsset, useScene, WallNode } from '@pascal-app/core'
import { type DxfOpening, extractDxfVectorSegments } from '@pascal-app/dxf-vector-extract'
import { commitWalls, type DetectedWall, toWallNodePatches } from '@pascal-app/floorplan-import'
import { extractPdfVectorSegments } from '@pascal-app/pdf-vector-extract'
import { useViewer } from '@pascal-app/viewer'
import { detectWalls } from '@pascal-app/wall-detect'
import { useCallback, useState } from 'react'

type EditableWall = DetectedWall & { id: number }
type PreviewOpening = DxfOpening & { id: number }

function toEditableWalls(source: DetectedWall[]): EditableWall[] {
  return source.map((wall, id) => ({
    ...wall,
    start: [...wall.start] as [number, number],
    end: [...wall.end] as [number, number],
    id,
  }))
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
  const [walls, setWalls] = useState<EditableWall[]>([])
  const [openings, setOpenings] = useState<PreviewOpening[]>([])
  const [removedWalls, setRemovedWalls] = useState<EditableWall[]>([])
  const [snapTolerance, setSnapTolerance] = useState(0.05)
  const [fileName, setFileName] = useState<string | null>(null)
  const [converterMissing, setConverterMissing] = useState(false)
  const [converting, setConverting] = useState(false)
  const [pdfFallback, setPdfFallback] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const processDxfText = useCallback(
    (text: string) => {
      const dxfLayers = extractDxfVectorSegments(text)
      const segments = dxfLayers.flatMap((layer) =>
        layer.segments.map((segment) => ({ ...segment, layer: layer.layer })),
      )
      let openingId = 0
      setOpenings(
        dxfLayers.flatMap((layer) =>
          (layer.openings ?? []).map((opening) => ({ ...opening, id: openingId++ })),
        ),
      )
      const detected = detectWalls(segments, {
        preferLayerContaining: 'PAREDE',
        snapToleranceM: snapTolerance,
      }).walls
      setWalls(toEditableWalls(detected))
      setStatus(
        `${detected.length} parede(s) e ${dxfLayers.reduce((sum, layer) => sum + (layer.openings?.length ?? 0), 0)} vão(s) detectados. Revise e confirme.`,
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
      setConverterMissing(false)
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
          processDxfText(result.dxf)
          return
        }
        if (isPdf) {
          const segments = (
            await extractPdfVectorSegments(new Uint8Array(await file.arrayBuffer()))
          ).flatMap((page) => page.segments)
          if (segments.length === 0) {
            setWalls([])
            setPdfFallback(file)
            setStatus('Este PDF não contém vetores de linha. Você pode adicioná-lo como guia visual.')
            return
          }
          const detected = detectWalls(segments, {
            preferLayerContaining: 'PAREDE',
            snapToleranceM: snapTolerance,
          }).walls
          setWalls(toEditableWalls(detected))
          setStatus(`${detected.length} parede(s) detectada(s). Revise e confirme.`)
          return
        }
        processDxfText(await file.text())
      } catch (cause) {
        setConverting(false)
        setWalls([])
        setError(cause instanceof Error ? cause.message : 'Não foi possível ler o arquivo.')
      }
    },
    [processDxfText, snapTolerance],
  )

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
    const patches = toWallNodePatches(walls)
    commitWalls(
      patches,
      {
        createNode: (data, parentId) => {
          createNode(WallNode.parse(data), parentId as AnyNodeId)
        },
      },
      levelId,
    )
    setStatus(`${patches.length} parede(s) adicionada(s) ao nível.`)
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
          Carregue um arquivo em coordenadas de metro, revise as paredes detectadas e confirme. DWG
          é convertido para DXF automaticamente (local e gratuito).
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
        <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
          {walls.map((wall, index) => (
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
                  {opening.type === 'door' ? 'Porta' : 'Janela'} · {opening.blockName}
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
