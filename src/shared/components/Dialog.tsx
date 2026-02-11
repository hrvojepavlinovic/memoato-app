import React from "react";
import { twJoin } from "tailwind-merge";

interface DialogProps extends React.PropsWithChildren {
  open: boolean;
  onClose: () => void;
  closeOnClickOutside?: boolean;
}

export function Dialog({
  open,
  onClose,
  children,
  closeOnClickOutside = true,
}: DialogProps) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);

  React.useEffect(
    function handleShowOrCloseDialog() {
      const dialog = dialogRef.current;
      if (!dialog) return;

      if (open && !dialog.open) {
        dialog.showModal();
      } else if (!open && dialog.open) {
        dialog.close();
      }
    },
    [open],
  );

  React.useEffect(
    function handlePreventScroll() {
      if (!open) return;

      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    },
    [open],
  );

  return (
    <dialog
      ref={dialogRef}
      className={twJoin(
        "m-0 w-full max-w-none border-0 bg-transparent p-0",
        "backdrop:bg-black/50 backdrop:backdrop-blur-sm",
      )}
      onClick={(e) => {
        if (!closeOnClickOutside) return;
        if (e.target !== e.currentTarget) return;
        onClose();
      }}
      onCancel={(e) => {
        // Prevent the dialog from closing itself so `open` stays the source of truth.
        e.preventDefault();
        onClose();
      }}
    >
      {children}
    </dialog>
  );
}
