import { useEffect, useState } from "react";
import { Megaphone, PartyPopper, ShieldAlert, X } from "lucide-react";
import type { Announcement, ShrekBomb } from "../../types";

/**
 * The cursed portrait requested for the console footer / hamburbur bomb.
 * Served straight from the Fandom CDN.
 */
export const SHREK_URL =
  "https://static.wikia.nocookie.net/cursed-images-inspiration/images/b/b5/ShrekHarvey.jpg/revision/latest?cb=20251013200432";

const MOOD_LABEL: Record<Announcement["mood"], string> = {
  info: "Network notice",
  warning: "Heads up",
  party: "Party announcement",
};

export function AnnouncementBanner({
  announcement,
  onDismiss,
}: {
  announcement: Announcement;
  onDismiss: () => void;
}) {
  const Icon = announcement.mood === "warning" ? ShieldAlert : announcement.mood === "party" ? PartyPopper : Megaphone;
  return (
    <aside className={`cl-announcement is-${announcement.mood}`} role="status" aria-live="polite">
      <span className="cl-announcement-icon"><Icon size={17} /></span>
      <div className="cl-announcement-copy">
        <span className="cl-announcement-kicker">
          {MOOD_LABEL[announcement.mood]} · via {announcement.author}
        </span>
        <strong>{announcement.title}</strong>
        <p>{announcement.body}</p>
      </div>
      <button type="button" className="cl-icon-button" onClick={onDismiss} aria-label="Dismiss announcement">
        <X size={15} />
      </button>
    </aside>
  );
}

export function ShrekBombOverlay({ bomb, onDismiss }: { bomb: ShrekBomb; onDismiss: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.ceil((bomb.expiresAt - Date.now()) / 1000)));

  useEffect(() => {
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((bomb.expiresAt - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [bomb.expiresAt]);

  return (
    <div className="cl-shrek-bomb" role="alertdialog" aria-label="hamburbur" aria-modal="true">
      <div className="cl-shrek-card">
        <span className="cl-shrek-kicker">AN ADMIN HAS DEPLOYED A HAMBURBUR</span>
        <img src={SHREK_URL} alt="A cursed Shrek and Harvey portrait" />
        <strong className="cl-shrek-word">hamburbur</strong>
        <p>{bomb.message}</p>
        <div className="cl-shrek-foot">
          <span>{secondsLeft}s remaining</span>
          <button type="button" className="cl-button cl-button-secondary" onClick={onDismiss}>
            I accept hamburbur
          </button>
        </div>
      </div>
    </div>
  );
}
