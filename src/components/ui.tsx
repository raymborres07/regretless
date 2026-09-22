import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDownLeft, X } from "lucide-react";
import ProductArt from "../ProductArt";
import { statusInfo } from "../lib/format";

export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">
        <ArrowDownLeft size={18} strokeWidth={2.5} />
      </span>
      regretless
    </span>
  );
}

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  kind?: "primary" | "secondary" | "ghost";
  type?: "button" | "submit";
  full?: boolean;
}

export function Button({ children, onClick, disabled = false, kind = "primary", type = "button", full = false }: ButtonProps) {
  return (
    <button type={type} className={`btn btn-${kind}${full ? " btn-full" : ""}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function StatusPill({ status }: { status: string }) {
  const info = statusInfo(status);
  return <span className={`pill pill-${info.tone}`}>{info.label}</span>;
}

interface ModalProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}

export function Modal({ title, children, onClose, wide = false }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal${wide ? " modal-wide" : ""}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-inner">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

interface ProductImageProps {
  src?: string;
  category: string;
  size?: "card" | "detail";
}

/** Store photo when available; a drawn illustration when not. */
export function ProductImage({ src, category, size = "card" }: ProductImageProps) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`product-image product-image-${size}`}>
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        <ProductArt category={category} />
      )}
    </div>
  );
}

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [message, onClose]);
  return (
    <div role="status" className="toast">
      <span>{message}</span>
      <button className="icon-btn" onClick={onClose} aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
}
