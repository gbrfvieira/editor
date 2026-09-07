'use client'

import { useEffect } from 'react'
import useDeleteConfirmation from '../../store/use-delete-confirmation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/primitives/dialog'

export function DeleteConfirmationDialog() {
  const request = useDeleteConfirmation((state) => state.request)
  const cancel = useDeleteConfirmation((state) => state.cancel)
  const confirm = useDeleteConfirmation((state) => state.confirm)

  useEffect(() => cancel, [cancel])

  return (
    <Dialog onOpenChange={(open) => !open && cancel()} open={request !== null}>
      <DialogContent
        className="border-border/70 bg-background/95 shadow-2xl backdrop-blur-xl sm:max-w-md"
        data-delete-confirmation-dialog
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>Excluir {request?.count ?? 0} elementos?</DialogTitle>
          <DialogDescription>
            Remove todos os elementos selecionados. Você pode desfazer a exclusão enquanto ela
            permanecer no histórico do editor.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            className="rounded-full border border-border px-4 py-2 text-sm transition-colors hover:bg-accent"
            onClick={cancel}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="rounded-full bg-red-600 px-4 py-2 text-sm text-white transition-colors hover:bg-red-700"
            onClick={confirm}
            type="button"
          >
            Excluir
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
