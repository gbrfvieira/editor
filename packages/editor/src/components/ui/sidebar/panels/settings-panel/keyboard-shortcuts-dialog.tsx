import { Keyboard } from 'lucide-react'
import { Button } from './../../../../../components/ui/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './../../../../../components/ui/primitives/dialog'
import {
  ShortcutToken,
  shortcutDisplayValue,
} from './../../../../../components/ui/primitives/shortcut-token'

type Shortcut = {
  keys: string[]
  action: string
  note?: string
}

type ShortcutCategory = {
  title: string
  shortcuts: Shortcut[]
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    title: 'Navegação do editor',
    shortcuts: [
      { keys: ['1'], action: 'Alternar para a etapa Terreno' },
      { keys: ['2'], action: 'Alternar para a etapa Construir' },
      { keys: ['3'], action: 'Alternar para a etapa Mobiliar' },
      { keys: ['F'], action: 'Alternar para a camada de mobiliário' },
      { keys: ['Z'], action: 'Alternar para a camada de ambientes' },
      {
        keys: ['Cmd/Ctrl', 'Arrow Up'],
        action: 'Selecionar o próximo nível da edificação ativa',
      },
      {
        keys: ['Cmd/Ctrl', 'Arrow Down'],
        action: 'Selecionar o nível anterior da edificação ativa',
      },
      { keys: ['Cmd/Ctrl', 'B'], action: 'Alternar barra lateral' },
    ],
  },
  {
    title: 'Modos e histórico',
    shortcuts: [
      { keys: ['V'], action: 'Alternar para o modo Selecionar' },
      { keys: ['B'], action: 'Alternar para o modo Construir' },
      { keys: ['M'], action: 'Ativar a última ferramenta de medição' },
      { keys: ['X'], action: 'Alternar para o modo Excluir' },
      {
        keys: ['Esc'],
        action: 'Cancelar a ferramenta ativa e voltar ao modo Selecionar',
        note: 'Mid-draw it cancels only the chain in progress and keeps the tool armed; press it again to leave the tool.',
      },
      { keys: ['Delete / Backspace'], action: 'Excluir objetos selecionados' },
      { keys: ['Cmd/Ctrl', 'Z'], action: 'Desfazer' },
      { keys: ['Cmd/Ctrl', 'Shift', 'Z'], action: 'Refazer' },
    ],
  },
  {
    title: 'Seleção',
    shortcuts: [
      {
        keys: ['Cmd/Ctrl', 'C'],
        action: 'Copiar objetos selecionados',
        note: 'The copied selection can be pasted into another level, project, or browser tab.',
      },
      {
        keys: ['Cmd/Ctrl', 'X'],
        action: 'Recortar objetos selecionados',
        note: 'Copies the selection to the clipboard, then removes it from this scene.',
      },
      {
        keys: ['Cmd/Ctrl', 'V'],
        action: 'Colar e posicionar objetos copiados',
        note:
          'Carries a preview under the cursor. Click to place it, or press Escape to cancel.',
      },
      {
        keys: ['Cmd/Ctrl', 'Left click'],
        action: 'Adicionar ou remover um objeto da seleção múltipla',
        note: 'Works in Select mode on the 3D canvas, the 2D floor plan, and the scene graph.',
      },
      {
        keys: ['Shift', 'Left click'],
        action: 'Adicionar ou remover um objeto da seleção múltipla na área de desenho',
        note: 'In the scene graph, Shift-click selects the visible range like a file browser.',
      },
      {
        keys: ['Left click'],
        action: 'Mover toda a seleção múltipla',
        note:
          'With 2+ objects selected, in 2D and 3D alike: drag the selection (or its dashed box) to slide it; click it to pick it up and place with the next click.',
      },
      {
        keys: ['R', 'T'],
        action: 'Girar uma seleção múltipla em ±45° em torno do seu centro',
        note: 'Also works mid-move while carrying the selection.',
      },
      {
        keys: ['Cmd/Ctrl', 'G'],
        action: 'Agrupar a seleção múltipla (somente nesta sessão)',
        note:
          'Editor-only. Plain click a member later to reselect the whole group. Not saved with the project.',
      },
      {
        keys: ['Cmd/Ctrl', 'Shift', 'G'],
        action: 'Desagrupar a seleção da sessão',
        note: 'Keeps the current selection; only dissolves the session group.',
      },
      {
        keys: ['Esc'],
        action: 'Limpar seleção',
        note: 'Clicking empty space does the same.',
      },
    ],
  },
  {
    title: 'Manipulação direta',
    shortcuts: [
      {
        keys: ['Cmd/Ctrl', 'Left click'],
        action: 'Mover o objeto móvel selecionado sob o cursor',
        note: 'Drag in Select mode with a single object selected. Guided snapping and guides are enabled by default.',
      },
      {
        keys: ['Cmd/Ctrl', 'Right click'],
        action: 'Girar o objeto selecionado sob o cursor',
        note: 'Drag left or right in Select mode with a single object selected. Rotation snaps to 15° increments by default.',
      },
      {
        keys: ['Cmd/Ctrl', 'Shift', 'Right click'],
        action: 'Girar livremente',
        note: 'Hold Shift during the drag to bypass the 15° rotation increment.',
      },
    ],
  },
  {
    title: 'Ferramentas de desenho',
    shortcuts: [
      // Shift and Ctrl each mean one thing held and another tapped, and only
      // the hold was documented — which read as the taps not existing. Both
      // taps are listed first because they are the ones nobody discovers.
      {
        keys: ['Shift'],
        action: 'Alternar o modo de encaixe',
        note: 'Tap and release without pressing anything else, while a drawing or move gesture is available.',
      },
      {
        keys: ['Cmd/Ctrl'],
        action: 'Alternar o passo da grade: 0,5 m → 0,25 m → 0,1 m → 0,05 m',
        note: 'Tap and release on its own. Use it when the default half-metre grid is too coarse — placing a window, for instance.',
      },
      {
        keys: ['Shift'],
        action: 'Ignorar encaixes guiados e restrições de ângulo',
        note: 'Hold during the active gesture. Passive guide or measurement feedback may stay visible.',
      },
      {
        keys: ['Shift'],
        action: 'Girar livremente, ignorando o encaixe padrão de rotação de 15°',
        note: 'Hold while dragging a rotate handle or direct-rotation gesture.',
      },
    ],
  },
  {
    title: 'Posicionamento de itens',
    shortcuts: [
      {
        keys: ['R', 'T'],
        action: 'Girar item; com uma porta selecionada, R alterna entre aberta e fechada e T fecha',
      },
      {
        keys: ['E'],
        action: 'Acionar o elemento selecionado — portas, janelas e portas/gavetas de armário abrem e fecham com animação',
      },
      {
        keys: ['Shift'],
        action: 'Ignorar temporariamente as restrições de validação do posicionamento',
        note: 'Hold while placing.',
      },
    ],
  },
  {
    title: 'Câmera',
    shortcuts: [
      {
        keys: ['W', 'A', 'S', 'D'],
        action: 'Deslocar câmera',
        note: 'Moves in screen space, similar to dragging the camera view.',
      },
      {
        keys: ['Middle click'],
        action: 'Deslocar câmera',
        note: 'Drag with the middle mouse button, or hold Space while dragging with the left mouse button.',
      },
      {
        keys: ['Right click'],
        action: 'Orbitar câmera',
        note: 'Drag with the right mouse button.',
      },
    ],
  },
]

function ShortcutKeys({ keys }: { keys: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {keys.map((key, index) => (
        <div className="flex items-center gap-1" key={`${key}-${index}`}>
          {index > 0 ? <span className="text-[10px] text-muted-foreground">+</span> : null}
          <ShortcutToken displayValue={shortcutDisplayValue(key)} value={key} />
        </div>
      ))}
    </div>
  )
}

export function KeyboardShortcutsDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="w-full justify-start gap-2" variant="outline">
          <Keyboard className="size-4" />
          Atalhos de teclado
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>Atalhos de teclado</DialogTitle>
          <DialogDescription>
            Os atalhos dependem do contexto. As restrições guiadas estão ativadas por padrão; segure Shift durante um gesto para construir livremente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
          {SHORTCUT_CATEGORIES.map((category) => (
            <section className="space-y-2" key={category.title}>
              <h3 className="font-medium text-sm">{category.title}</h3>
              <div className="overflow-hidden rounded-md border border-border/80">
                {category.shortcuts.map((shortcut, index) => (
                  <div
                    className="grid grid-cols-[minmax(130px,220px)_1fr] gap-3 px-3 py-2"
                    key={`${category.title}-${shortcut.action}`}
                  >
                    <ShortcutKeys keys={shortcut.keys} />
                    <div>
                      <p className="text-sm">{shortcut.action}</p>
                      {shortcut.note ? (
                        <p className="text-muted-foreground text-xs">{shortcut.note}</p>
                      ) : null}
                    </div>
                    {index < category.shortcuts.length - 1 ? (
                      <div className="col-span-2 border-border/60 border-b" />
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
