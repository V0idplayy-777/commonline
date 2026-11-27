import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Hash,
  MessageCircle,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { Like } from "./bencho/Like";
import type { Post } from "../types";

const FLOW_QUICK_REPLIES = [
  "Sharp point — love this.",
  "Saving this for later!",
  "Curious to hear more on this.",
];

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function relativeTime(value: number) {
  const elapsed = Math.max(0, Date.now() - value);
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(value);
}

export function RapidFlowModal({
  posts,
  initialIndex = 0,
  comboCount,
  onClose,
  onLike,
  onBookmark,
  onReply,
  onRead,
  onOpenAuthor,
}: {
  posts: Post[];
  initialIndex?: number;
  comboCount: number;
  onClose: () => void;
  onLike: (post: Post) => void;
  onBookmark: (post: Post) => void;
  onReply: (postId: string, body: string) => Promise<void>;
  onRead: (post: Post) => void;
  onOpenAuthor: (authorId: string) => void;
}) {
  const [index, setIndex] = useState(() => Math.min(Math.max(0, initialIndex), Math.max(0, posts.length - 1)));
  const [direction, setDirection] = useState(1);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const dragStartX = useRef<number | null>(null);

  const safeIndex = Math.min(index, Math.max(0, posts.length - 1));
  const post = posts[safeIndex];

  useEffect(() => {
    if (!post) return;
    const timer = window.setTimeout(() => onRead(post), 700);
    return () => window.clearTimeout(timer);
  }, [post, onRead]);

  const go = (delta: number) => {
    const next = safeIndex + delta;
    if (next < 0 || next >= posts.length) return;
    setDirection(delta > 0 ? 1 : -1);
    setIndex(next);
    setReplyOpen(false);
    setReplyText("");
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        if (event.key === "Escape") onClose();
        return;
      }
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        go(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      } else if (event.key.toLowerCase() === "l" && post) {
        onLike(post);
      } else if (event.key.toLowerCase() === "s" && post) {
        onBookmark(post);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!post) return null;

  const likesBeforeThis = Math.max(0, post.likes - (post.liked ? 1 : 0));
  const useFirework = comboCount >= 2 || post.likes === 0 || (post.likes + 1) % 5 === 0;

  const submitReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!replyText.trim() || sending) return;
    setSending(true);
    await onReply(post.id, replyText);
    setReplyText("");
    setReplyOpen(false);
    setSending(false);
  };

  const quickReply = async (text: string) => {
    if (sending) return;
    setSending(true);
    await onReply(post.id, text);
    setReplyOpen(false);
    setSending(false);
  };

  return (
    <div className="cl-flow-backdrop" role="dialog" aria-modal="true" aria-label="Rapid Flow mode">
      <div className="cl-flow-shell">
        <div className="cl-flow-top">
          <div className="cl-flow-bars" aria-hidden="true">
            {posts.slice(0, 16).map((item, idx) => (
              <span
                key={item.id}
                className={idx < safeIndex ? "is-seen" : idx === safeIndex ? "is-current" : ""}
                onClick={() => {
                  setDirection(idx >= safeIndex ? 1 : -1);
                  setIndex(idx);
                }}
              />
            ))}
          </div>
          <div className="cl-flow-meta">
            <span><Sparkles size={13} /> RAPID FLOW · {safeIndex + 1} / {posts.length}</span>
            <button type="button" className="cl-icon-button cl-flow-close" onClick={onClose} aria-label="Close Rapid Flow">
              <X size={18} />
            </button>
          </div>
        </div>

        <div
          className="cl-flow-stage"
          onPointerDown={(e) => { dragStartX.current = e.clientX; }}
          onPointerUp={(e) => {
            if (dragStartX.current === null) return;
            const dx = e.clientX - dragStartX.current;
            dragStartX.current = null;
            if (Math.abs(dx) > 65) go(dx < 0 ? 1 : -1);
          }}
        >
          <button
            type="button"
            className="cl-flow-nav cl-flow-prev"
            disabled={safeIndex === 0}
            onClick={() => go(-1)}
            aria-label="Previous update"
          >
            <ChevronLeft size={20} />
          </button>

          <AnimatePresence mode="wait" initial={false}>
            <motion.article
              key={post.id}
              className="cl-flow-card"
              initial={{ opacity: 0, x: direction * 38, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: direction * -38, scale: 0.97 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onDoubleClick={() => { if (!post.liked) onLike(post); }}
            >
              <div className="cl-flow-card-head">
                <button
                  type="button"
                  className="cl-author-trigger"
                  onClick={() => { onClose(); onOpenAuthor(post.author.id); }}
                >
                  <span className="cl-avatar cl-avatar-md" style={{ "--avatar-colour": post.author.avatar } as React.CSSProperties}>
                    {initials(post.author.name)}
                  </span>
                  <div>
                    <strong>{post.author.name}</strong>
                    <small>@{post.author.handle} · {relativeTime(post.createdAt)}</small>
                  </div>
                </button>
                <span className="cl-post-topic"><Hash size={12} />{post.topic}</span>
              </div>

              <div className="cl-flow-card-body">{post.body}</div>

              {post.comments.length > 0 && (
                <div className="cl-flow-teaser">
                  <strong>Latest reply · {post.comments[post.comments.length - 1].name}:</strong>{" "}
                  <span>{post.comments[post.comments.length - 1].body}</span>
                </div>
              )}

              <div className="cl-flow-card-actions">
                <Like
                  start={likesBeforeThis}
                  liked={post.liked}
                  onToggle={() => onLike(post)}
                  effect={useFirework ? "Firework" : "Bloom"}
                  burst={useFirework ? 55 : 32}
                  corner={8}
                />
                <button type="button" className={`cl-post-action ${replyOpen ? "is-active" : ""}`} onClick={() => setReplyOpen((v) => !v)}>
                  <MessageCircle size={16} /><span>{post.commentCount > 0 ? `${post.commentCount} replies` : "Reply"}</span>
                </button>
                <button type="button" className={`cl-post-action cl-post-save ${post.saved ? "is-saved" : ""}`} onClick={() => onBookmark(post)}>
                  {post.saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}<span>{post.saved ? "Saved" : "Save"}</span>
                </button>
              </div>

              {replyOpen && (
                <div className="cl-flow-reply-box">
                  <div className="cl-quick-replies">
                    {FLOW_QUICK_REPLIES.map((prompt) => (
                      <button key={prompt} type="button" className="cl-quick-reply-chip" disabled={sending} onClick={() => void quickReply(prompt)}>
                        {prompt}
                      </button>
                    ))}
                  </div>
                  <form className="cl-reply-form" onSubmit={submitReply}>
                    <input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Drop a quick reply…" maxLength={500} autoFocus />
                    <button type="submit" disabled={!replyText.trim() || sending} aria-label="Send reply"><Send size={15} /></button>
                  </form>
                </div>
              )}
            </motion.article>
          </AnimatePresence>

          <button
            type="button"
            className="cl-flow-nav cl-flow-next"
            disabled={safeIndex >= posts.length - 1}
            onClick={() => go(1)}
            aria-label="Next update"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="cl-flow-footer">
          <span>Use ← / → or swipe · L to like · S to save · Esc to exit</span>
        </div>
      </div>
    </div>
  );
}
