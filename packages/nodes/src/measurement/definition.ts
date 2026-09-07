import { measurementReferenceNodeIds, type NodeDefinition } from '@pascal-app/core'
import type { FloorplanNodeExtension } from '@pascal-app/editor'
import { buildMeasurementFloorplan } from './floorplan'
import { measurementMoveVertexAffordance } from './floorplan-affordance'
import { MeasurementNode } from './schema'

export const measurementDefinition: NodeDefinition<typeof MeasurementNode> = {
  kind: 'measurement',
  bake: 'strip',
  snapProfile: 'structural',
  schemaVersion: 2,
  schema: MeasurementNode,
  category: 'analysis',

  defaults: () => ({
    object: 'node',
    parentId: null,
    visible: true,
    metadata: {},
    measurement: {
      kind: 'distance',
      points: [
        [0, 0, 0],
        [1, 0, 0],
      ],
    },
  }),

  capabilities: {
    selectable: { hitVolume: 'bbox' },
    deletable: true,
    duplicable: true,
    presettable: false,
  },

  dirtyTracking: false,

  renderer: {
    kind: 'parametric',
    module: () => import('./renderer'),
  },
  floorplan: buildMeasurementFloorplan,
  floorplanDependencies: (node) => measurementReferenceNodeIds(node.measurement),
  extensions: {
    'pascal:editor/floorplan': {
      referencedSelectionAnnotationRole: 'measurement',
    } satisfies FloorplanNodeExtension,
  },
  floorplanAffordances: {
    'move-measurement-vertex': measurementMoveVertexAffordance,
  },
  affordanceTools: {
    selection: () => import('./selection'),
  },
  tool: () => import('./tool-router'),
  toolHints: [
    { key: 'Left click', label: 'Posicionar ponto de medição' },
    { key: 'Enter', label: 'Concluir medição' },
    { key: 'Backspace', label: 'Remover último ponto' },
    { key: 'Esc', label: 'Concluir e continuar' },
  ],

  presentation: {
    label: 'Medição',
    description: 'Uma anotação persistente de distância, ângulo, área, perímetro ou volume.',
    icon: { kind: 'iconify', name: 'lucide:ruler' },
    hidden: true,
    actionMenu: false,
  },

  mcp: {
    description:
      'A persistent level-local distance, angle, area, perimeter, or volume measurement.',
  },
}
