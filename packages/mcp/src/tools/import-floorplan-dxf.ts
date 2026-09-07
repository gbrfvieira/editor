import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { extractDxfVectorSegments } from '@pascal-app/dxf-vector-extract'
import type { DetectedWall } from '@pascal-app/floorplan-import'
import { detectWalls } from '@pascal-app/wall-detect'
import { z } from 'zod'
import type { SceneOperations } from '../operations'

const detectedWallSchema = z.object({
  start: z.array(z.number()).length(2),
  end: z.array(z.number()).length(2),
  thickness: z.number(),
  confidence: z.number().min(0).max(1),
})

export const importFloorplanDxfInput = {
  dxfBase64: z.string().min(1).describe('ASCII DXF bytes encoded as base64.'),
}

export const importFloorplanDxfOutput = {
  walls: z.array(detectedWallSchema),
  wallCount: z.number().int().nonnegative(),
}

export function registerImportFloorplanDxf(server: McpServer, _bridge: SceneOperations): void {
  server.registerTool(
    'import_floorplan_dxf',
    {
      title: 'Preview DXF floor plan',
      description:
        'Decode a DXF floor plan and return detected wall candidates without changing the scene.',
      inputSchema: importFloorplanDxfInput,
      outputSchema: importFloorplanDxfOutput,
    },
    async ({ dxfBase64 }) => {
      const source = Buffer.from(dxfBase64, 'base64').toString('utf8')
      const grouped = extractDxfVectorSegments(source)
      const segments = grouped.flatMap((group) =>
        group.segments.map((segment) => ({ ...segment, layer: group.layer })),
      )
      const walls = detectWalls(segments).walls as DetectedWall[]
      const payload = { walls, wallCount: walls.length }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
        structuredContent: payload,
      }
    },
  )
}
