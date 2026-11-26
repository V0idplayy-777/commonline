import { AnimatePresence, motion } from "framer-motion";
import { Flame, Sparkles, Trophy, Zap } from "lucide-react";

export type RewardPop = {
  id: number;
  label: string;
  sublabel?: string;
  tone: "xp" | "combo" | "streak" | "tier";
};

const CONFETTI_COLORS = ["#1d6253", "#e2b57d", "#b56a42", "#47a87d", "#d9895b", "#71b59a"];

export function CelebrationBurst({ burstId }: { burstId: number }) {
  if (burstId <= 0) return null;
  return (
    <div key={burstId} className="cl-celebration-layer" aria-hidden="true">
      {Array.from({ length: 24 }, (_, idx) => {
        const angle = (idx / 24) * Math.PI * 2;
        const distance = 90 + ((idx * 37) % 130);
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance - 55;
        const rotate = ((idx * 73) % 360) - 180;
        return (
          <span
            key={idx}
            className="cl-confetti-bit"
            style={
              {
                "--cx": `${tx.toFixed(1)}px`,
                "--cy": `${ty.toFixed(1)}px`,
                "--cr": `${rotate}deg`,
                "--cc": CONFETTI_COLORS[idx % CONFETTI_COLORS.length],
                "--cd": `${(idx % 6) * 28}ms`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

export function RewardStack({ items }: { items: RewardPop[] }) {
  return (
    <div className="cl-reward-stack" aria-live="polite">
      <AnimatePresence initial={false}>
        {items.map((item) => {
          const Icon =
            item.tone === "streak"
              ? Flame
              : item.tone === "tier"
                ? Trophy
                : item.tone === "combo"
                  ? Zap
                  : Sparkles;
          return (
            <motion.div
              key={item.id}
              className={`cl-reward-pill cl-reward-${item.tone}`}
              initial={{ opacity: 0, y: 14, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.94 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
            >
              <span className="cl-reward-icon">
                <Icon size={13} />
              </span>
              <div>
                <strong>{item.label}</strong>
                {item.sublabel && <small>{item.sublabel}</small>}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
