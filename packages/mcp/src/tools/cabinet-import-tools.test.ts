import { expect, test } from 'bun:test'
import type { SceneOperations } from '../operations'
import { registerAddCabinetModule } from './add-cabinet-module'
import { registerApplyCabinetPreset } from './apply-cabinet-preset'
import { registerCommitFloorplanWalls } from './commit-floorplan-walls'
import { registerCreateCabinetRun } from './create-cabinet-run'
import { registerGenerateCutlist } from './generate-cutlist'
import { registerImportFloorplanDxf } from './import-floorplan-dxf'

type Handler = (input: Record<string, unknown>) => Promise<unknown>

function harness() {
  const registrations = new Map<string, Handler>()
  const created: Array<{ node: Record<string, unknown>; parentId?: string }> = []
  const updates: Array<{ id: string; patch: Record<string, unknown> }> = []
  const server = {
    registerTool(name: string, _config: unknown, handler: Handler) {
      registrations.set(name, handler)
    },
  }
  let sequence = 0
  const nodes: Record<
    string,
    { id: string; type: string; width?: number; depth?: number; carcassHeight?: number }
  > = {
    level_1: { id: 'level_1', type: 'level' },
    cabinet_1: { id: 'cabinet_1', type: 'cabinet', width: 0.5, depth: 0.6, carcassHeight: 0.8 },
    module_1: { id: 'module_1', type: 'cabinet-module' },
  }
  const bridge = {
    getNode: (id: string) => nodes[id] ?? null,
    createNode: (node: Record<string, unknown>, parentId?: string) => {
      sequence += 1
      created.push({ node, parentId })
      return `${node.type ?? 'node'}_${sequence}`
    },
    updateNode: (id: string, patch: Record<string, unknown>) => updates.push({ id, patch }),
    getNodes: () => ({}),
    getActiveScene: () => null,
  } as unknown as SceneOperations
  return { registrations, server, bridge, created, updates }
}

test('registers all cabinet and floor-plan importer tools', () => {
  const { registrations, server, bridge } = harness()
  registerCreateCabinetRun(server as never, bridge)
  registerAddCabinetModule(server as never, bridge)
  registerApplyCabinetPreset(server as never, bridge)
  registerImportFloorplanDxf(server as never, bridge)
  registerCommitFloorplanWalls(server as never, bridge)
  registerGenerateCutlist(server as never, bridge)
  expect([...registrations.keys()]).toEqual([
    'create_cabinet_run',
    'add_cabinet_module',
    'apply_cabinet_preset',
    'import_floorplan_dxf',
    'commit_floorplan_walls',
    'generate_cutlist',
  ])
})

test('creates a cabinet run and rejects an invalid level', async () => {
  const { registrations, server, bridge } = harness()
  registerCreateCabinetRun(server as never, bridge)
  const result = await registrations.get('create_cabinet_run')!({
    levelId: 'level_1',
    start: [0, 0],
    end: [2, 0],
  })
  expect(JSON.parse((result as { content: [{ text: string }] }).content[0].text).cabinetId).toMatch(
    /^cabinet_/,
  )
  await expect(
    registrations.get('create_cabinet_run')!({ levelId: 'missing', width: 1 }),
  ).rejects.toThrow()
})

test('adds a module and rejects an unknown run', async () => {
  const { registrations, server, bridge, created } = harness()
  registerAddCabinetModule(server as never, bridge)
  const result = await registrations.get('add_cabinet_module')!({
    runId: 'cabinet_1',
    compartmentType: 'drawer',
    count: 3,
  })
  expect(JSON.parse((result as { content: [{ text: string }] }).content[0].text).moduleId).toMatch(
    /^cabinet-module_/,
  )
  expect(created[0]?.node.stack).toEqual([
    expect.objectContaining({ type: 'drawer', drawerCount: 3 }),
  ])
  await expect(
    registrations.get('add_cabinet_module')!({ runId: 'missing', compartmentType: 'shelf' }),
  ).rejects.toThrow()
})

test('applies a preset and rejects an unknown module', async () => {
  const { registrations, server, bridge, updates } = harness()
  registerApplyCabinetPreset(server as never, bridge)
  const result = await registrations.get('apply_cabinet_preset')!({
    moduleId: 'module_1',
    presetId: 'drawer-base',
  })
  expect(JSON.parse((result as { content: [{ text: string }] }).content[0].text)).toMatchObject({
    moduleId: 'module_1',
    presetId: 'drawer-base',
  })
  expect(updates[0]?.patch).toEqual(expect.objectContaining({ width: expect.any(Number) }))
  await expect(
    registrations.get('apply_cabinet_preset')!({ moduleId: 'missing', presetId: 'drawer-base' }),
  ).rejects.toThrow()
})

test('previews a DXF and rejects malformed source', async () => {
  const { registrations, server, bridge } = harness()
  registerImportFloorplanDxf(server as never, bridge)
  const dxf = `0\nSECTION\n2\nENTITIES\n0\nLINE\n8\nPAREDES\n10\n0\n20\n0\n11\n4\n21\n0\n0\nENDSEC\n0\nEOF\n`
  const result = await registrations.get('import_floorplan_dxf')!({
    dxfBase64: Buffer.from(dxf).toString('base64'),
  })
  expect(JSON.parse((result as { content: [{ text: string }] }).content[0].text).wallCount).toBe(1)
  await expect(
    registrations.get('import_floorplan_dxf')!({ dxfBase64: 'not-a-dxf' }),
  ).rejects.toThrow()
})

test('commits approved walls and rejects an unknown level', async () => {
  const { registrations, server, bridge, created } = harness()
  registerCommitFloorplanWalls(server as never, bridge)
  const result = await registrations.get('commit_floorplan_walls')!({
    levelId: 'level_1',
    walls: [{ start: [0, 0], end: [4, 0], thickness: 0.2, confidence: 0.9 }],
  })
  expect(
    JSON.parse((result as { content: [{ text: string }] }).content[0].text).wallIds,
  ).toHaveLength(1)
  expect(created[0]?.node).toEqual(expect.objectContaining({ type: 'wall', height: 2.7 }))
  await expect(
    registrations.get('commit_floorplan_walls')!({ levelId: 'missing', walls: [] }),
  ).rejects.toThrow()
})

test('generates a cut list and rejects an unknown cabinet', async () => {
  const { registrations, server, bridge } = harness()
  registerGenerateCutlist(server as never, bridge)
  const result = await registrations.get('generate_cutlist')!({ cabinetId: 'cabinet_1' })
  const report = JSON.parse((result as { content: [{ text: string }] }).content[0].text).report
  expect(report.panels.length).toBeGreaterThan(0)
  await expect(registrations.get('generate_cutlist')!({ cabinetId: 'missing' })).rejects.toThrow()
})
