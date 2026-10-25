import { useEffect, useRef, type ReactNode } from 'react';
export function Modal({
  titleId,
  onClose,
  children,
  className = '',
}: {
  titleId: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close.current();
      }
      if (event.key !== 'Tab') return;
      const nodes = Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]',
        ) ?? [],
      );
      if (!nodes.length) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === nodes[0] || document.activeElement === ref.current)
      ) {
        event.preventDefault();
        nodes.at(-1)?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === nodes.at(-1) || document.activeElement === ref.current)
      ) {
        event.preventDefault();
        nodes[0].focus();
      }
    };
    document.addEventListener('keydown', keys);
    return () => {
      document.removeEventListener('keydown', keys);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div className="review-shade">
      <section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={className}
      >
        {children}
      </section>
    </div>
  );
}
