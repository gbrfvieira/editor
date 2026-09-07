import { afterEach, expect, test } from 'bun:test'
import { LevelNode, useScene } from '@pascal-app/core'
import { reflowRunModules } from '../run-panel'
import { CabinetModuleNode, CabinetNode } from '../schema'

function seed(
  level: ReturnType<typeof LevelNode.parse>,
  run: ReturnType<typeof CabinetNode.parse>,
  modules: ReturnType<typeof CabinetModuleNode.parse>[],
) {
  useScene.setState({
    nodes: Object.fromEntries([level, run, ...modules].map((node) => [node.id, node])),
    rootNodeIds: [level.id],
  } as never)
}

afterEach(() => useScene.setState({ nodes: {}, rootNodeIds: [] } as never))

test('keeps a single module valid when its width changes', () => {
  const level = LevelNode.parse({ id: 'level_reflow-regression-single' })
  const run = CabinetNode.parse({
    id: 'cabinet_reflow-regression-single',
    parentId: level.id,
    children: ['cabinet-module_reflow-regression-single'],
  })
  const module = CabinetModuleNode.parse({
    id: 'cabinet-module_reflow-regression-single',
    parentId: run.id,
    width: 0.5,
  })
  seed(level, run, [module])
  expect(
    reflowRunModules({
      modules: [module],
      parentRun: run,
      patch: { width: 0.3 },
      scene: useScene.getState(),
      selected: module,
    }),
  ).toBe(true)
  expect(
    (useScene.getState().nodes[module.id] as ReturnType<typeof CabinetModuleNode.parse>).width,
  ).toBeGreaterThanOrEqual(0.3)
})

test('does not create zero-width modules in a very narrow run', () => {
  const level = LevelNode.parse({ id: 'level_reflow-regression-narrow' })
  const run = CabinetNode.parse({
    id: 'cabinet_reflow-regression-narrow',
    parentId: level.id,
    width: 0.2,
    children: [
      'cabinet-module_reflow-regression-narrow-a',
      'cabinet-module_reflow-regression-narrow-b',
    ],
  })
  const modules = [
    CabinetModuleNode.parse({
      id: 'cabinet-module_reflow-regression-narrow-a',
      parentId: run.id,
      position: [-0.04, 0.1, 0],
      width: 0.08,
    }),
    CabinetModuleNode.parse({
      id: 'cabinet-module_reflow-regression-narrow-b',
      parentId: run.id,
      position: [0.04, 0.1, 0],
      width: 0.08,
    }),
  ]
  seed(level, run, modules)
  expect(
    reflowRunModules({
      modules,
      parentRun: run,
      patch: { width: 0.3 },
      scene: useScene.getState(),
      selected: modules[0]!,
    }),
  ).toBe(true)
  const live = useScene.getState().nodes
  for (const module of modules)
    expect((live[module.id] as ReturnType<typeof CabinetModuleNode.parse>).width).toBeGreaterThan(0)
})
