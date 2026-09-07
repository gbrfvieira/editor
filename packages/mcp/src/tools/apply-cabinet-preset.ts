import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { AnyNodeId } from '@pascal-app/core/schema'
import { z } from 'zod'
import type { SceneOperations } from '../operations'
import { ErrorCode, throwMcpError } from './errors'
import { liveSyncOutput, persistencePayload, publishLiveSceneSnapshot } from './live-sync'
import { NodeIdSchema } from './schemas'

export const cabinetPresetIds = [
  'base-door',
  'drawer-base',
  'dishwasher',
  'cooktop-gas',
  'cooktop-induction',
  'sink-base',
  'tall-pantry',
  'oven-tower',
  'fridge-single',
] as const

export const applyCabinetPresetInput = {
  moduleId: NodeIdSchema,
  presetId: z.enum(cabinetPresetIds),
}

export const applyCabinetPresetOutput = {
  moduleId: z.string(),
  presetId: z.string(),
  ...liveSyncOutput,
}

type PresetPatch = Record<string, unknown>

type PresetExport = { id: string; createPatch: (run?: unknown) => PresetPatch }

const presetPatches: Record<(typeof cabinetPresetIds)[number], PresetPatch> = {
  'base-door': {
    width: 0.5,
    cabinetType: 'base',
    handleStyle: 'bar',
    stack: [
      { id: 'preset-drawer', type: 'drawer', height: 0.44, drawerCount: 3 },
      { id: 'preset-door', type: 'door', doorType: 'double', shelfCount: 2 },
    ],
  },
  'drawer-base': {
    width: 0.5,
    cabinetType: 'base',
    handleStyle: 'bar',
    stack: [{ id: 'preset-drawer', type: 'drawer', drawerCount: 3 }],
  },
  dishwasher: {
    width: 0.6,
    cabinetType: 'base',
    handleStyle: 'bar',
    stack: [{ id: 'preset-dishwasher', type: 'dishwasher' }],
  },
  'cooktop-gas': {
    width: 0.75,
    cabinetType: 'base',
    handleStyle: 'bar',
    stack: [
      { id: 'preset-drawer', type: 'drawer', drawerCount: 2 },
      { id: 'preset-cooktop', type: 'cooktop-gas' },
    ],
  },
  'cooktop-induction': {
    width: 0.75,
    cabinetType: 'base',
    handleStyle: 'bar',
    stack: [
      { id: 'preset-drawer', type: 'drawer', drawerCount: 2 },
      { id: 'preset-cooktop', type: 'cooktop-induction' },
    ],
  },
  'sink-base': {
    width: 0.8,
    cabinetType: 'base',
    handleStyle: 'bar',
    stack: [
      { id: 'preset-door', type: 'door', doorType: 'double' },
      { id: 'preset-sink', type: 'sink' },
    ],
  },
  'tall-pantry': {
    width: 0.5,
    carcassHeight: 2.07,
    cabinetType: 'tall',
    handleStyle: 'bar',
    stack: [{ id: 'preset-door', type: 'door', doorType: 'double', shelfCount: 4 }],
  },
  'oven-tower': {
    width: 0.61,
    carcassHeight: 2.07,
    cabinetType: 'tall',
    handleStyle: 'bar',
    stack: [
      { id: 'preset-drawer', type: 'drawer', height: 0.42, drawerCount: 2 },
      { id: 'preset-oven', type: 'oven' },
      { id: 'preset-microwave', type: 'microwave' },
      { id: 'preset-door', type: 'door', doorType: 'double', shelfCount: 2 },
    ],
  },
  'fridge-single': {
    width: 0.76,
    carcassHeight: 1.78,
    cabinetType: 'tall',
    handleStyle: 'bar',
    stack: [{ id: 'preset-fridge', type: 'fridge-single' }],
  },
}

export function registerApplyCabinetPreset(server: McpServer, bridge: SceneOperations): void {
  server.registerTool(
    'apply_cabinet_preset',
    {
      title: 'Apply cabinet preset',
      description: 'Apply one of the built-in cabinet preset configurations to a module.',
      inputSchema: applyCabinetPresetInput,
      outputSchema: applyCabinetPresetOutput,
    },
    async ({ moduleId, presetId }) => {
      const module = bridge.getNode(moduleId as AnyNodeId)
      if (!module) throwMcpError(ErrorCode.InvalidParams, `Cabinet module not found: ${moduleId}`)
      if (module.type !== 'cabinet-module') {
        throwMcpError(
          ErrorCode.InvalidParams,
          `Node ${moduleId} is a ${module.type}, expected cabinet-module`,
        )
      }
      const builtin = await import('@pascal-app/nodes').catch(() => null)
      const exportedPresets = (builtin as unknown as { CABINET_PRESETS?: PresetExport[] } | null)
        ?.CABINET_PRESETS
      const exportedPreset = exportedPresets?.find((preset) => preset.id === presetId)
      const parent = module.parentId ? bridge.getNode(module.parentId as AnyNodeId) : null
      const patch =
        exportedPreset?.createPatch(parent?.type === 'cabinet' ? parent : undefined) ??
        presetPatches[presetId]
      bridge.updateNode(moduleId as AnyNodeId, patch as never)
      const persistence = await publishLiveSceneSnapshot(bridge, 'apply_cabinet_preset')
      const payload = { moduleId, presetId, ...persistencePayload(persistence) }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
        structuredContent: payload,
      }
    },
  )
}
