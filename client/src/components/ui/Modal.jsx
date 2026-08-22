import React, { useEffect } from "react";
import { X } from "lucide-react";
import Card from "./Card";
import Button from "./Button";

/**
 * ponytail: plain overlay, no dialog library — shadcn/ui was never installed.
 * Keeps the accessibility basics: role/aria, Esc to close, backdrop click.
 */
const Modal = ({ open, title, onClose, children }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <Card
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-bold text-lg text-[#1C1917]">{title}</h3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X size={20} />
          </Button>
        </div>
        {children}
      </Card>
    </div>
  );
};

export default Modal;
