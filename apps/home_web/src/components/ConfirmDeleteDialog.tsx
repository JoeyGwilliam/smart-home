import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ConfirmDeleteDialogProps {
  /** The question to ask, such as "Delete this reminder?". */
  question: string
  /** What the person calls the thing that would be deleted, such as a reminder's title. */
  itemName: string
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  /** Called when the person confirms. The dialog closes by itself. */
  onConfirm: () => void
}

/** Asks the person to confirm deleting something, since it can't be undone. */
export function ConfirmDeleteDialog({ question, itemName, isOpen, onOpenChange, onConfirm }: ConfirmDeleteDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-4xl border-[3px] border-panel-edge bg-popover/95 p-6 shadow-2xl shadow-shade">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl font-semibold">{question}</AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            <span className="font-bold text-foreground">{itemName}</span> will be gone for good.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-10 rounded-full px-5 font-bold">Keep it</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="h-10 rounded-full bg-destructive px-5 font-bold text-white hover:bg-destructive/90">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
