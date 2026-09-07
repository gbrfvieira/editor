# Agent Instructions — `pascalorg/editor`

Public, open-source home of `@pascal-app/{core,viewer,editor,mcp}` and the standalone editor app. Consumed both as npm packages and (in `pascalorg/private-editor`) as a git submodule.

## Repo Shape

| Path | Purpose |
|---|---|
| `packages/core` | Scene graph, node schemas, stores, event bus, core systems — pure logic, no Three.js |
| `packages/viewer` | Standalone 3D canvas: renderers, viewer systems, presentation state |
| `packages/editor` | Editor UI components reused by the standalone app and embedders |
| `packages/mcp` | MCP server and scene storage adapters |
| `apps/editor` | Standalone editor app — composes `viewer` + `editor` + tools |

## Where to look

- **Architecture rules** — `wiki/architecture/` (read on demand; index in `wiki/architecture/README.md`).
- **Skills (ready workflows)** — `.agents/skills/<name>/SKILL.md`. Same content is reachable as `.claude/skills/`, `.cursor/skills/`, `.codex/skills/` (symlinks to `.agents/skills/`).
- **Repo orientation for humans** — `README.md`, `SETUP.md`, `CONTRIBUTING.md`.

`CLAUDE.md`, `GEMINI.md`, and `.github/copilot-instructions.md` are symlinks to this file. Codex reads this file directly.

## Layer Boundaries (read once, internalise)

- **`packages/core`** owns domain data and pure logic. It must not import Three.js, `packages/viewer`, `apps/editor`, rendering/UI concepts, tools, modes, phases, or view-specific concepts such as floorplan or paint preview.
- **`packages/viewer`** owns the standalone 3D canvas, renderers, viewer systems, and genuine presentation state. It must not know about `useEditor`, editor tools, phases, modes, paint mode, floorplan state, or editor-only presentation vocabulary.
- **`apps/editor`** owns the editing experience: tools, `useEditor`, panels, floorplan helpers, paint mode, keyboard shortcuts, command palette, action menus, cursor badges, and editor-only overlays. Editor features are injected into `<Viewer>` via props and children.

Details, examples, and rationale live in `wiki/architecture/layers.md`, `wiki/architecture/viewer-isolation.md`, `wiki/architecture/systems.md`, `wiki/architecture/renderers.md`, `wiki/architecture/tools.md`.

## When making architecture-sensitive changes

Read the relevant page in `wiki/architecture/` **before** writing code. The page list lives in `wiki/architecture/README.md`. As a minimum:

- Adding a node type → `node-schemas.md`, `renderers.md`, `systems.md`
- Adding a tool → `tools.md`, `spatial-queries.md`, `events.md`
- Adding / changing a placement or move interaction → `tools.md` ("2D ↔ 3D behavioral parity": applicable behaviors must exist in both views; port the change to the sibling 2D/3D file in the same PR)
- Adding a system → `systems.md`, `scene-registry.md`
- Anything in `packages/viewer` → `viewer-isolation.md`, `layers.md`
- Anything touching selection → `selection-managers.md`, `scene-registry.md`, `events.md`

## When reviewing a PR

Invoke the `review-architecture` skill (`.agents/skills/review-architecture/SKILL.md`). It loads the required architecture pages, fetches the diff, classifies each new file by layer, and reports findings grouped by severity.

## Operating rules

- Read the full file before editing. Plan all changes, then make one complete edit.
- When the user corrects you, stop and re-read their message.
- After two consecutive tool failures, stop and change approach.
- Don't introduce backwards-compatibility shims, dead code, or speculative abstractions.
- Don't write new comments unless they explain a non-obvious *why*.

## Fork scope

This is a personal fork pruned to what a Brazilian architecture practice actually
uses: floor-plan import (DXF/DWG/PDF) and parametric marcenaria (cabinetry).
Roof, MEP (HVAC/plumbing/electrical), lineset, structural-grid and block were
removed as unrelated domains. Hosted third-party catalog assets (models under
`apps/editor/public/items/`, the MCP catalog in `packages/mcp/src/tools/asset-catalog.ts`)
were emptied — they are not redistributable; callers already degrade
gracefully (`place_item` falls back to a placeholder box, `furnish_room` skips
unresolved placements with a reason).

The maintained scene-node vocabulary: `site`, `building`, `level`, `wall`,
`slab`, `zone`, `item`, `door`, `window`, `guide`, `cabinet` + `cabinet-module`,
`shelf`, `measurement`, `construction-dimension`, `stair` + `stair-segment`,
`spawn`, `column`, `fence`, `elevator`, `scan`. Each of `spawn`, `column`,
`fence`, `elevator`, `scan` and `construction-dimension` was deliberately kept
after review — they looked like they might be prunable domain cruft but turned
out to be real, non-trivial features relevant to residential architecture
practice (first-person walkthrough spawn, structural columns, site boundaries,
multi-story access, 3D as-built capture reference, and technical dimensioning
respectively). Don't remove any of these without re-confirming scope first.

The intended workflow is `DXF/DWG/PDF vectors -> wall detection ->
floorplan-import patches -> scene walls -> cabinet runs/modules ->
cutlist/nesting -> quote`. DWG is converted to DXF via a local, free ODA File
Converter install (`packages/dwg-convert`) — no paid conversion API.

Keep generic utilities (`packages/dxf-vector-extract`, `packages/pdf-vector-extract`,
`packages/wall-detect`, `packages/floorplan-import`, `packages/cutlist`,
`packages/quote`, `packages/dwg-convert`) decoupled from `@pascal-app/*`. Scene
integration uses injected APIs or type-only imports, and inherited MIT notices
remain intact.
