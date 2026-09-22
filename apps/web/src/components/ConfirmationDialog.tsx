import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

interface ConfirmationDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: "default" | "danger";
}

const focusableSelector = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export function ConfirmationDialog({
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  tone = "default",
}: ConfirmationDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    const returnFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const appRoot = document.getElementById("root");
    const rootWasInert = appRoot?.inert ?? false;
    const previousAriaHidden = appRoot?.getAttribute("aria-hidden") ?? null;

    if (appRoot) {
      appRoot.inert = true;
      appRoot.setAttribute("aria-hidden", "true");
    }
    cancelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCancelRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector)]
        .filter((element) => !element.hidden);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      if (appRoot) {
        appRoot.inert = rootWasInert;
        if (previousAriaHidden === null) appRoot.removeAttribute("aria-hidden");
        else appRoot.setAttribute("aria-hidden", previousAriaHidden);
      }
      const disabledButton = returnFocus instanceof HTMLButtonElement && returnFocus.disabled;
      if (returnFocus?.isConnected && !disabledButton) returnFocus.focus();
    };
  }, []);

  return createPortal(
    <div className="confirmation-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <section
        ref={dialogRef}
        className="confirmation-dialog"
        role={tone === "danger" ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
        <div className="confirmation-actions">
          <button ref={cancelRef} className="button-secondary" type="button" onClick={onCancel}>{cancelLabel}</button>
          <button
            className={tone === "danger" ? "confirmation-danger" : "button-primary"}
            type="button"
            onClick={onConfirm}
          >{confirmLabel}</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
