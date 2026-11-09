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

interface DeleteReminderDialogProps {
  reminderTitle: string
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  /** Called when the person confirms. The dialog closes by itself. */
  onConfirm: () => void
}

/** Asks the person to confirm deleting a reminder, since it can't be undone. */
export function DeleteReminderDialog({ reminderTitle, isOpen, onOpenChange, onConfirm }: DeleteReminderDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-4xl border border-white/80 bg-popover/95 p-6 shadow-2xl shadow-primary/25 backdrop-blur-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl font-semibold">Delete this reminder?</AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            <span className="font-bold text-foreground">{reminderTitle}</span> will be gone for good.
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
