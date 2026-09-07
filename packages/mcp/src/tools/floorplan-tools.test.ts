import { beforeEach, describe, expect, test } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SceneBridge } from '../bridge/scene-bridge'
import { registerCommitFloorplanWalls } from './commit-floorplan-walls'
import { registerImportFloorplanDxf } from './import-floorplan-dxf'

function dxf(): string {
  return `0\nSECTION\n2\nENTITIES\n0\nLINE\n8\nPAREDES\n10\n0\n20\n0\n11\n4\n21\n0\n0\nLINE\n8\nPAREDES\n10\n0\n20\n0.2\n11\n4\n21\n0.2\n0\nENDSEC\n0\nEOF\n`
}

describe('floorplan MCP tools', () => {
  let client: Client
  let bridge: SceneBridge

  beforeEach(async () => {
    bridge = new SceneBridge()
    bridge.setScene({}, [])
    bridge.loadDefault()
    const server = new McpServer({ name: 'floorplan-test', version: '0.0.0' })
    registerImportFloorplanDxf(server, bridge)
    registerCommitFloorplanWalls(server, bridge)
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair()
    client = new Client({ name: 'floorplan-client', version: '0.0.0' })
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  })

  test('previews a DXF and commits approved walls', async () => {
    const result = await client.callTool({
      name: 'import_floorplan_dxf',
      arguments: { bytesBase64: Buffer.from(dxf(), 'utf8').toString('base64') },
    })
    expect(result.isError).toBeFalsy()
    const preview = JSON.parse((result.content as Array<{ text: string }>)[0]!.text)
    expect(preview.walls).toHaveLength(1)
    const level = Object.values(bridge.getNodes()).find((node) => node.type === 'level')!
    const commit = await client.callTool({
      name: 'commit_floorplan_walls',
      arguments: { levelId: level.id, walls: preview.walls },
    })
    expect(commit.isError).toBeFalsy()
    const payload = JSON.parse((commit.content as Array<{ text: string }>)[0]!.text)
    expect(payload.wallIds).toHaveLength(1)
    expect(bridge.getNode(payload.wallIds[0]).type).toBe('wall')
  })

  test('rejects committing to an unknown level', async () => {
    const result = await client.callTool({
      name: 'commit_floorplan_walls',
      arguments: {
        levelId: 'level_missing',
        walls: [{ start: [0, 0], end: [1, 0], thickness: 0.2, confidence: 0.9 }],
      },
    })
    expect(result.isError).toBe(true)
  })
})
