import { type CSSProperties, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CircleCheck, CircleX, Info, TriangleAlert, X, type LucideIcon } from "lucide-react";

/* ══ Toast stack ══════════════════════════════════════════
   At most three real notifications, newest in front, the two before it
   tucked behind with a sliver of each showing above it, a step
   smaller each and a barely-there grey (the reference's tones). Point at the stack and it
   fans out into a list; move away and it gathers back up. Content is
   supplied by the application; this component invents no activity.

   ── ONE SPRING, THREE PLACES ────────────────────────────
   A toast's place is worked out from how far back it is and
   whether the stack is open, and Framer springs it there. Opening,
   closing, a toast leaving and the next arriving are all the same
   move — every toast heading for its new place on the same spring,
   a touch under critical so it settles with a hint of give.

   ── HOVER IS THE WHOLE FRAME ────────────────────────────
   The stack opens about its middle, so the front toast moves when
   it opens. Hovering the toasts themselves would let the list slide
   out from under the pointer and close again; the frame is the
   list's own size, so hovering it is hovering the list. Pointer
   over/out with a containment test rather than enter/leave, so the
   wall's demonstration — which dispatches its own pointer events,
   and leaves with no relatedTarget — opens and closes it too (the
   tilt card's note has the long version).

   ── ONLY REAL ACTIVITY ──────────────────────────────────
   Dismissing or marking one read calls the parent handler. The
   notification remains in the stack until the data source confirms
   that change; there is no local pool or fabricated replacement. */

type Kind = "success" | "info" | "error" | "warning";
export type ToastStackItem = { id: string; kind: Kind; title: string; body: string; action?: string };

const ICON: Record<Kind, LucideIcon> = {
  success: CircleCheck,
  info: Info,
  error: CircleX,
  warning: TriangleAlert,
};

const W = 300;
const H = 64;
const SHOWN = 3;
/* a touch under critical: it settles with a hint of give, no wobble */
const SPRING = { type: "spring", stiffness: 380, damping: 34, mass: 1 } as const;

export function ToastStack({
  items = [],
  onRead = () => undefined,
  peek = 14,
  gap = 10,
  corner = 20,
}: {
  items?: ToastStackItem[];
  onRead?: (id: string) => void;
  peek?: number;
  gap?: number;
  corner?: number;
}) {
  const stack = items.slice(0, SHOWN);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  /* the frame is the open list's size; both states sit in its middle */
  const count = stack.length;
  const listH = count * H + Math.max(0, count - 1) * gap;
  const stackH = count ? H + (count - 1) * peek : 0;
  const FH = Math.max(H, listH);

  const place = (k: number) => {
    if (open) {
      /* the list: front at the bottom, the rest above it */
      const top = (FH - listH) / 2;
      return { y: top + (count - 1 - k) * (H + gap), scale: 1 };
    }
    /* the stack: front at the bottom, each one behind a peek higher
       and a step smaller, hanging from its top edge */
    const top = (FH - stackH) / 2;
    const d = Math.min(k, count - 1);
    return { y: top + (count - 1 - d) * peek, scale: 1 - d * 0.05 };
  };

  const dismiss = (id: string) => {
    if (leaving !== null) return;
    setLeaving(id);
    timer.current = window.setTimeout(() => {
      onRead(id);
      setLeaving(null);
      timer.current = null;
    }, 220);
  };

  if (!stack.length) return null;

  return (
    <div
      ref={root}
      className="tst"
      role="region"
      aria-label="Notifications"
      data-open={open || undefined}
      style={{ width: W, height: FH, ["--tst-r" as string]: `${corner}px` } as CSSProperties}
      onPointerOver={() => setOpen(true)}
      onPointerOut={(e) => {
        const to = e.relatedTarget as Node | null;
        if (!to || !root.current?.contains(to)) setOpen(false);
      }}
      onFocus={() => setOpen(true)}
      onBlur={(e) => { if (!root.current?.contains(e.relatedTarget as Node | null)) setOpen(false); }}
    >
      <AnimatePresence initial={false}>
      {stack.map((t, k) => {
        const Icon = ICON[t.kind];
        const out = leaving === t.id;
        const p = place(k);
        const front = k === 0;
        return (
          <motion.div
            key={t.id}
            className="tst-toast"
            data-kind={t.kind}
            data-front={front || undefined}
            style={{ height: H, zIndex: count - k }}
            /* a new one rises in from below the front */
            initial={{ y: place(0).y + 24, scale: 1, opacity: 0, x: 0 }}
            animate={out
              ? { y: p.y, scale: p.scale, opacity: 0, x: 60 }
              : { y: p.y, scale: p.scale, opacity: 1, x: 0 }}
            transition={out ? { duration: 0.22, ease: [0.4, 0, 1, 1] } : SPRING}
            aria-hidden={!open && !front ? true : undefined}
          >
            <span className="tst-icon"><Icon size={18} strokeWidth={2} aria-hidden="true" /></span>
            <span className="tst-text">
              <b>{t.title}</b>
              <span>{t.body}</span>
            </span>
            {t.action && (
              <button type="button" className="tst-act" tabIndex={open || front ? 0 : -1} onClick={() => dismiss(t.id)}>
                {t.action}
              </button>
            )}
            <button
              type="button"
              className="tst-x"
              aria-label={`Dismiss ${t.title}`}
              tabIndex={open || front ? 0 : -1}
              onClick={() => dismiss(t.id)}
            >
              <X size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          </motion.div>
        );
      })}
      </AnimatePresence>
    </div>
  );
}
