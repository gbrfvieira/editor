'use client'

import { nodeRegistry, useRegistryVersion } from '@pascal-app/core'
import {
  CATALOG_ITEMS,
  type FloorplanMode,
  getFloorplanNodeExtension,
  isFloorplanToolAvailableInMode,
  MaterialPaintPanel,
  TerrainSculptPanel,
  triggerSFX,
  useEditor,
  useFloorplanMode,
} from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import Image from 'next/image'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/toolbar-tooltip'
import { cn } from '@/lib/utils'
import { FloorplanImportPanel } from './floorplan-import-panel'

type BuildType = {
  /** Selection id — equals `kind` for tool types, with dedicated ids for modes and groups. */
  id: string
  label: string
  /** Raster asset tile (legacy Build sidebar artwork). */
  iconSrc: string
  /** Present for structure-tool types (absent for paint mode and the import action). */
  kind?: string
  paletteOrder?: number
  /** Non-placement special mode. */
  mode?: 'material-paint' | 'terrain-sculpt'
  /** App-local workflow that does not alter the editor tool state. */
  action?: 'floorplan-import'
}

// Same icons + ordering as the community Build sidebar, minus presets.
const BASE_BUILD_TYPES: BuildType[] = [
  { id: 'wall', label: 'Parede', iconSrc: '/icons/wall.webp', kind: 'wall' },
  { id: 'fence', label: 'Cerca', iconSrc: '/icons/fence.webp', kind: 'fence' },
  { id: 'slab', label: 'Laje', iconSrc: '/icons/floor.webp', kind: 'slab' },
  { id: 'ceiling', label: 'Forro', iconSrc: '/icons/ceiling.webp', kind: 'ceiling' },
  { id: 'stair', label: 'Escada', iconSrc: '/icons/stairs.webp', kind: 'stair' },
  { id: 'elevator', label: 'Elevador', iconSrc: '/icons/elevator.webp', kind: 'elevator' },
  { id: 'door', label: 'Porta', iconSrc: '/icons/door.webp', kind: 'door' },
  { id: 'window', label: 'Janela', iconSrc: '/icons/window.webp', kind: 'window' },
  { id: 'column', label: 'Coluna', iconSrc: '/icons/column.webp', kind: 'column' },
  { id: 'shelf', label: 'Prateleira', iconSrc: '/icons/shelf.webp', kind: 'shelf' },
  { id: 'spawn', label: 'Ponto de início', iconSrc: '/icons/spawn-point.webp', kind: 'spawn' },
  { id: 'kitchen', label: 'Cozinha', iconSrc: '/icons/kitchen.webp' },
  {
    id: 'floorplan-import',
    label: 'Importar planta',
    iconSrc: '/icons/floor.webp',
    action: 'floorplan-import',
  },
  { id: 'painting', label: 'Pintura', iconSrc: '/icons/paint.webp', mode: 'material-paint' },
  { id: 'terrain', label: 'Terreno', iconSrc: '/icons/mesh.webp', mode: 'terrain-sculpt' },
]

const subscribeToClientMount = () => () => {}

function collectBuildTypes(floorplanMode: FloorplanMode): BuildType[] {
  const baseKinds = new Set(BASE_BUILD_TYPES.flatMap((type) => (type.kind ? [type.kind] : [])))
  const tools = BASE_BUILD_TYPES.filter((type) => type.kind).map((type, index) => ({
    ...type,
    paletteOrder:
      nodeRegistry.get(type.kind!)?.presentation?.paletteOrder ?? type.paletteOrder ?? index * 10,
  }))
  for (const [kind, definition] of nodeRegistry.entries()) {
    const presentation = definition.presentation
    const extension = getFloorplanNodeExtension(definition)
    if (
      baseKinds.has(kind) ||
      !extension?.tool ||
      !isFloorplanToolAvailableInMode(extension.availableModes, floorplanMode) ||
      !presentation ||
      presentation.hidden ||
      presentation.paletteSection !== 'structure'
    ) {
      continue
    }
    tools.push({
      id: kind,
      kind,
      label: presentation.label,
      iconSrc: presentation.icon.kind === 'url' ? presentation.icon.src : '/icons/spawn-point.webp',
      paletteOrder: presentation.paletteOrder ?? Number.MAX_SAFE_INTEGER,
    })
  }
  tools.sort((left, right) => (left.paletteOrder ?? 0) - (right.paletteOrder ?? 0))
  return [...tools, ...BASE_BUILD_TYPES.filter((type) => !type.kind)]
}

const MODULAR_CABINET_CATALOG_ITEM = CATALOG_ITEMS.find((item) => item.id === 'cabinet')
const MODULAR_CABINET_ICON = MODULAR_CABINET_CATALOG_ITEM?.thumbnail ?? '/icons/item.webp'

/**
 * Activate a raw structure draw/cursor tool. Mirrors the editor's own
 * structure-tool activation (`setPhase`/`setStructureLayer`/`setMode`/`setTool`).
 */
function activateBuildTool(kind: string): void {
  const ed = useEditor.getState()
  const definition = nodeRegistry.get(kind)
  const extension = getFloorplanNodeExtension(definition)
  if (
    !isFloorplanToolAvailableInMode(extension?.availableModes, useFloorplanMode.getState().mode)
  ) {
    useFloorplanMode.getState().showExpertModeNotice(definition?.presentation?.label ?? kind)
    return
  }
  const preferredView = extension?.preferredView
  if (preferredView) ed.setViewMode(preferredView)
  ed.setPhase('structure')
  ed.setStructureLayer('elements')
  ed.setCatalogCategory(null)
  ed.setToolDefaults(kind, null)
  ed.setMode('build')
  ed.setTool(kind)
}

function activateModularCabinetTool(): void {
  const ed = useEditor.getState()
  useViewer.getState().setSelection({ selectedIds: [], zoneId: null })
  if (MODULAR_CABINET_CATALOG_ITEM) ed.setSelectedItem(MODULAR_CABINET_CATALOG_ITEM)
  ed.setPhase('structure')
  ed.setStructureLayer('elements')
  ed.setCatalogCategory(null)
  ed.setMode('build')
  ed.setTool('cabinet')
}

/** Enter material-paint mode — the Build tab's "Painting" category. */
function activatePaintMode(): void {
  const ed = useEditor.getState()
  ed.setPhase('structure')
  ed.setStructureLayer('elements')
  ed.setMode('material-paint')
}

/**
 * Enter terrain-sculpt mode — the Build tab's "Terrain" category. No `setPhase`:
 * `setMode` moves to the site phase itself, since sculpting is a site-phase mode.
 */
function activateTerrainSculptMode(): void {
  useEditor.getState().setMode('terrain-sculpt')
}

/**
 * Build tab for the open-source standalone editor — a preset-less replica of
 * the community Build sidebar. Clicking a type activates its raw tool, drawn
 * with the kind's own `def.defaults()`. The "Painting" type swaps in the
 * material-paint panel.
 */
export function BuildTab() {
  const activeTool = useEditor((s) => s.tool)
  const mode = useEditor((s) => s.mode)
  const floorplanMode = useFloorplanMode((s) => s.mode)
  useRegistryVersion()
  const registryReady = useSyncExternalStore(
    subscribeToClientMount,
    () => true,
    () => false,
  )
  const buildTypes = registryReady ? collectBuildTypes(floorplanMode) : BASE_BUILD_TYPES
  const [showFloorplanImport, setShowFloorplanImport] = useState(false)

  // Tile highlight derives from the single source of truth (the active tool /
  // mode), never a separate local selection — so keyboard shortcuts and panel
  // clicks always agree on which tile is lit.
  const isKitchenActive = mode === 'build' && activeTool === 'cabinet'

  const isTypeActive = (type: BuildType) => {
    if (type.action === 'floorplan-import') return showFloorplanImport
    if (type.mode) return mode === type.mode
    if (type.id === 'kitchen') return isKitchenActive
    return mode === 'build' && activeTool === type.kind
  }

  const handleTypeClick = useCallback((type: BuildType) => {
    if (type.action === 'floorplan-import') {
      setShowFloorplanImport(true)
      return
    }
    setShowFloorplanImport(false)
    if (type.mode === 'material-paint') {
      activatePaintMode()
    } else if (type.mode === 'terrain-sculpt') {
      activateTerrainSculptMode()
    } else if (type.id === 'kitchen') {
      activateModularCabinetTool()
    } else if (type.kind) {
      activateBuildTool(type.kind)
    }
  }, [])

  // On open, land on the first build tool — parity with the community Build
  // sidebar, so switching to Build immediately arms a usable tool. Skip when a
  // build tool is already active (e.g. the B shortcut armed one before this
  // panel mounted): the active tool is the source of truth, not this default.
  const didInitRef = useRef(false)
  useEffect(() => {
    if (didInitRef.current) return
    didInitRef.current = true
    const ed = useEditor.getState()
    if (ed.mode === 'build' && ed.tool) return
    const firstType = buildTypes.find((t) => t.kind)
    if (firstType) handleTypeClick(firstType)
  }, [buildTypes, handleTypeClick])

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <TooltipProvider delayDuration={0} disableHoverableContent>
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))' }}
        >
          {buildTypes.map((type) => {
            const active = isTypeActive(type)
            return (
              <Tooltip key={type.id}>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      'group relative flex aspect-square items-center justify-center rounded-xl p-1 transition-all duration-200',
                      active
                        ? 'bg-primary/10 ring-1 ring-primary/50'
                        : 'bg-muted/40 opacity-70 grayscale hover:bg-muted hover:opacity-100 hover:grayscale-0',
                    )}
                    onClick={() => {
                      triggerSFX('sfx:menu-click')
                      handleTypeClick(type)
                    }}
                    onMouseEnter={() => triggerSFX('sfx:menu-hover')}
                    type="button"
                  >
                    <Image
                      alt={type.label}
                      className="size-full object-contain transition-transform duration-200 group-hover:scale-110"
                      height={48}
                      src={type.iconSrc}
                      width={48}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="pointer-events-none" side="top">
                  {type.label}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </TooltipProvider>

      {showFloorplanImport ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <FloorplanImportPanel />
        </div>
      ) : mode === 'material-paint' ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <MaterialPaintPanel />
        </div>
      ) : mode === 'terrain-sculpt' ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <TerrainSculptPanel />
        </div>
      ) : isKitchenActive ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          <div className="px-0.5 pt-1 font-medium text-muted-foreground text-xs">Kitchen</div>
          <TooltipProvider delayDuration={0} disableHoverableContent>
            <div
              className="grid gap-1.5 px-0.5"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))' }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="group relative flex aspect-square items-center justify-center rounded-xl bg-primary/10 p-1 ring-1 ring-primary/50 transition-all duration-200"
                    onClick={() => {
                      triggerSFX('sfx:menu-click')
                      activateModularCabinetTool()
                    }}
                    onMouseEnter={() => triggerSFX('sfx:menu-hover')}
                    type="button"
                  >
                    <Image
                      alt="Modular Cabinet"
                      className="size-full object-contain transition-transform duration-200 group-hover:scale-110"
                      height={48}
                      src={MODULAR_CABINET_ICON}
                      width={48}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="pointer-events-none" side="top">
                  Modular Cabinet
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
      ) : null}
    </div>
  )
}
