import {
  useEffect,
  useRef,
  useId,
  type ReactNode,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
} from 'react';
import { X, LoaderCircle, CircleAlert, PackageOpen } from 'lucide-react';
export function Button({
  children,
  className = '',
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
}) {
  return (
    <button className={`button button-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function Input({
  label,
  error,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...props}
      />
      {error && (
        <p className="field-error" id={`${inputId}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
export function Modal({
  title,
  onClose,
  children,
  drawer = false,
  busy = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  drawer?: boolean;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${drawer ? 'drawer' : ''}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current && !busy) {
          const rect = ref.current.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-header">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Закрити"
          onClick={onClose}
          disabled={busy}
        >
          <X size={22} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function LoadingState() {
  return (
    <div className="state" role="status">
      <LoaderCircle className="animate-spin" size={30} />
      <p>Завантажуємо добірку…</p>
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="state" role="alert">
      <CircleAlert size={30} />
      <p>{message}</p>
      <Button variant="secondary" onClick={retry}>
        Спробувати ще раз
      </Button>
    </div>
  );
}
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="state">
      <PackageOpen size={36} />
      {children}
    </div>
  );
}
