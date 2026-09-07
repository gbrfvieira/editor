import { beforeEach, describe, expect, test } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SceneBridge } from '../bridge/scene-bridge'
import { registerAddCabinetModule } from './add-cabinet-module'
import { registerApplyCabinetPreset } from './apply-cabinet-preset'
import { registerCreateCabinetRun } from './create-cabinet-run'

describe('cabinet MCP tools', () => {
  let client: Client
  let bridge: SceneBridge

  beforeEach(async () => {
    bridge = new SceneBridge()
    bridge.setScene({}, [])
    bridge.loadDefault()
    const server = new McpServer({ name: 'cabinet-test', version: '0.0.0' })
    registerCreateCabinetRun(server, bridge)
    registerAddCabinetModule(server, bridge)
    registerApplyCabinetPreset(server, bridge)
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair()
    client = new Client({ name: 'cabinet-client', version: '0.0.0' })
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  })

  test('creates a run from two points, adds a module and applies a preset', async () => {
    const level = Object.values(bridge.getNodes()).find((node) => node.type === 'level')!
    const runResult = await client.callTool({
      name: 'create_cabinet_run',
      arguments: { levelId: level.id, start: [1, 2], end: [3, 2] },
    })
    expect(runResult.isError).toBeFalsy()
    const runId = JSON.parse((runResult.content as Array<{ text: string }>)[0]!.text).cabinetId
    const moduleResult = await client.callTool({
      name: 'add_cabinet_module',
      arguments: { runId, compartmentType: 'door' },
    })
    const moduleId = JSON.parse((moduleResult.content as Array<{ text: string }>)[0]!.text).moduleId
    const presetResult = await client.callTool({
      name: 'apply_cabinet_preset',
      arguments: { moduleId, presetId: 'base-door' },
    })
    expect(presetResult.isError).toBeFalsy()
    const module = bridge.getNode(moduleId) as { stack?: Array<{ type: string }> }
    expect(module.stack?.map((entry) => entry.type)).toEqual(['drawer', 'door'])
  })

  test('rejects an invalid level for a new run', async () => {
    const result = await client.callTool({
      name: 'create_cabinet_run',
      arguments: { levelId: 'level_missing', width: 0.6 },
    })
    expect(result.isError).toBe(true)
  })
})
