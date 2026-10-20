import {
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export type Choice = { value: string; label: string; detail?: string; badge?: string };
export function Select({
  label,
  value,
  onChange,
  options,
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Choice[];
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(0),
    [position, setPosition] = useState<CSSProperties>({});
  const trigger = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null),
    id = useId();
  const selected = options.find((o) => o.value === value) ?? options[0];
  const search = useRef(''),
    lastKey = useRef(0);
  function close() {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }
  function choose(i: number) {
    onChange(options[i].value);
    close();
  }
  function show() {
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
    setOpen(true);
  }
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = trigger.current!.getBoundingClientRect();
      const width = Math.min(Math.max(r.width, compact ? 185 : 270), innerWidth - 24);
      const availableBelow = innerHeight - r.bottom - 16;
      const above = availableBelow < 180 && r.top > availableBelow;
      setPosition({
        position: 'fixed',
        width,
        left: Math.max(12, Math.min(r.left, innerWidth - width - 12)),
        ...(above ? { bottom: innerHeight - r.top + 8 } : { top: r.bottom + 8 }),
        maxHeight: Math.min(340, above ? r.top - 24 : availableBelow),
      });
    };
    place();
    menu.current?.focus({ preventScroll: true });
    const outside = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !trigger.current?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, compact]);
  useEffect(() => {
    if (!open) return;
    const item = document.getElementById(`${id}-${active}`),
      container = menu.current;
    if (!item || !container) return;
    if (item.offsetTop < container.scrollTop + 36)
      container.scrollTop = Math.max(0, item.offsetTop - 36);
    else if (item.offsetTop + item.offsetHeight > container.scrollTop + container.clientHeight)
      container.scrollTop = item.offsetTop + item.offsetHeight - container.clientHeight;
  }, [active, open, id]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`custom-select ${compact ? 'compact' : ''}`}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? close() : show())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            show();
          }
        }}
      >
        <span className="select-value">
          {selected?.badge && <i>{selected.badge}</i>}
          <span>{selected?.label}</span>
        </span>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={id}
            role="listbox"
            aria-label={label}
            tabIndex={-1}
            aria-activedescendant={`${id}-${active}`}
            className="custom-options"
            style={position}
            onKeyDown={(e) => {
              if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' ', 'Escape'].includes(e.key))
                e.preventDefault();
              if (e.key === 'Escape') {
                close();
                return;
              }
              if (e.key === 'Tab') {
                setOpen(false);
                trigger.current?.focus({ preventScroll: true });
                return;
              }
              if (e.key === 'Enter' || e.key === ' ') {
                choose(active);
                return;
              }
              if (e.key === 'ArrowDown') setActive((i) => (i + 1) % options.length);
              else if (e.key === 'ArrowUp')
                setActive((i) => (i - 1 + options.length) % options.length);
              else if (e.key === 'Home') setActive(0);
              else if (e.key === 'End') setActive(options.length - 1);
              else if (e.key.length === 1) {
                const now = Date.now();
                search.current = now - lastKey.current > 700 ? e.key : search.current + e.key;
                lastKey.current = now;
                const i = options.findIndex((o) =>
                  o.label.toLowerCase().startsWith(search.current.toLowerCase()),
                );
                if (i >= 0) setActive(i);
              }
            }}
          >
            <div className="options-heading">{label}</div>
            {options.map((o, i) => (
              <div
                id={`${id}-${i}`}
                role="option"
                aria-selected={o.value === value}
                key={o.value}
                className={`custom-option ${i === active ? 'highlighted' : ''}`}
                onPointerMove={() => setActive(i)}
                onClick={() => choose(i)}
              >
                {o.badge && <span className="option-badge">{o.badge}</span>}
                <span className="option-copy">
                  <strong>{o.label}</strong>
                  {o.detail && <small>{o.detail}</small>}
                </span>
                {o.value === value && <span className="option-check">✓</span>}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

export function Slider({
  value,
  max,
  onChange,
  label,
  valueText,
}: {
  value: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
  valueText: string;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  function at(x: number) {
    const r = rail.current!.getBoundingClientRect();
    onChange(Math.max(0, Math.min(max, Math.round(((x - r.left) / r.width) * max * 10) / 10)));
  }
  return (
    <div
      ref={rail}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Number(value.toFixed(1))}
      aria-valuetext={valueText}
      className={`custom-slider ${dragging ? 'dragging' : ''}`}
      style={{ '--seek': `${(value / max) * 100}%` } as CSSProperties}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        e.currentTarget.focus();
        setDragging(true);
        at(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) at(e.clientX);
      }}
      onPointerUp={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          at(e.clientX);
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
        setDragging(false);
      }}
      onPointerCancel={() => setDragging(false)}
      onKeyDown={(e) => {
        const steps: Record<string, number> = {
          ArrowLeft: -0.1,
          ArrowDown: -0.1,
          ArrowRight: 0.1,
          ArrowUp: 0.1,
          PageDown: -1,
          PageUp: 1,
        };
        if (e.key in steps) {
          e.preventDefault();
          onChange(Math.max(0, Math.min(max, Math.round((value + steps[e.key]) * 10) / 10)));
        } else if (e.key === 'Home' || e.key === 'End') {
          e.preventDefault();
          onChange(e.key === 'Home' ? 0 : max);
        }
      }}
    >
      <span className="slider-track">
        <span />
      </span>
      <span className="slider-thumb">
        <span className="slider-tooltip">{valueText}</span>
      </span>
    </div>
  );
}

export function Disclosure({
  open,
  title,
  children,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(open);
  const id = useId();
  useEffect(() => setExpanded(open), [open]);
  return (
    <section className="evidence-details">
      <button
        className="disclosure-trigger"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setExpanded(!expanded)}
      >
        {title}
        <span>{expanded ? '−' : '+'}</span>
      </button>
      <div id={id} hidden={!expanded} className="disclosure-content">
        {children}
      </div>
    </section>
  );
}
