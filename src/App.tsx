import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowRight,
  ArrowUp,
  Bell,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronDown,
  Compass,
  Copy,
  FileText,
  Flame,
  Globe2,
  Hash,
  Heart,
  House,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  Search,
  Send,
  Settings,
  Share2,
  Sparkles,
  Trash2,
  TrendingUp,
  Trophy,
  UsersRound,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { useSignInWithUsernamePassword } from "@convex-dev/auth/methods/username-password/react";
import { useSignUpWithUsernamePassword } from "@convex-dev/auth/methods/username-password/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { CelebrationBurst, RewardStack, type RewardPop } from "./components/CelebrationBurst";
import { CardSwap } from "./components/bencho/CardSwap";
import { EyeTracker } from "./components/bencho/EyeTracker";
import { LabelInput } from "./components/bencho/LabelInput";
import { Like } from "./components/bencho/Like";
import { Particles } from "./components/bencho/Particles";
import { RollingCounter } from "./components/bencho/RollingCounter";
import { ToastStack } from "./components/bencho/ToastStack";
import {
  DAILY_ACTION_TARGET,
  getLastSevenDays,
  getTierInfo,
  getTimeGreeting,
  loadDraft,
  loadEngagementState,
  rankPosts,
  recordEngagementAction,
  saveDraft,
  saveEngagementState,
  type EngagementAction,
  type EngagementState,
} from "./lib/engagement";
import {
  isSoundEnabled,
  playFollowSound,
  playLikeSound,
  playMilestoneSound,
  playPublishSound,
  playReplySound,
  playSaveSound,
  playTabSound,
  playUnlikeSound,
  setSoundEnabled,
} from "./lib/feedback";
import type { Member, NotificationItem, Post, Topic } from "./types";

type Page = "home" | "explore" | "network" | "saved" | "settings";
type FeedScope = "For You" | "Rising" | "Following" | "Latest";
type Profile = Doc<"users"> & { username: string };

const PAGE_LABEL: Record<Page, string> = {
  home: "Home",
  explore: "Explore",
  network: "Members",
  saved: "Saved",
  settings: "Settings",
};

const TOPIC_OPTIONS = ["General", "Field notes", "Projects", "Questions", "Research", "Opportunities", "Resources"];

const QUICK_REPLIES = [
  "Sharp take — curious how this evolved.",
  "Bookmarking this for later!",
  "Would love to hear more about this.",
];

const COLLAPSE_THRESHOLD = 320;

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
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

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function authErrorText(code: string, detail?: { error: string; minimumLength?: number; maximumLength?: number; retryAfterMs?: number }) {
  switch (code) {
    case "USERNAME_TAKEN": return "That username is already in use.";
    case "USERNAME_TOO_SHORT": return `Choose a username with at least ${detail?.minimumLength ?? 3} characters.`;
    case "USERNAME_TOO_LONG": return `Keep your username under ${detail?.maximumLength ?? 32} characters.`;
    case "USERNAME_HAS_INVALID_CHARACTERS": return "Use letters, numbers, dots, dashes or underscores in your username.";
    case "USERNAME_HAS_SURROUNDING_WHITESPACE": return "Remove spaces from the start or end of your username.";
    case "PASSWORD_TOO_SHORT": return `Use a password with at least ${detail?.minimumLength ?? 8} characters.`;
    case "PASSWORD_TOO_LONG": return `Keep your password under ${detail?.maximumLength ?? 128} characters.`;
    case "PASSWORD_HAS_SURROUNDING_WHITESPACE": return "Remove spaces from the start or end of your password.";
    case "PASSWORD_TOO_COMMON": return "Choose a less common password.";
    case "USER_NOT_FOUND": return "No account was found for that username.";
    case "INVALID_CREDENTIALS": return "The username or password is incorrect.";
    case "RATE_LIMITED": return `Too many attempts. Try again in ${Math.ceil((detail?.retryAfterMs ?? 0) / 1000)} seconds.`;
    case "OTHER_ERROR": return "Could not reach the sign-in service. Please try again.";
    default: return "Could not complete that request. Check your details and try again.";
  }
}

function Avatar({ name, colour, size = "md" }: { name: string; colour: string; size?: "sm" | "md" | "lg" }) {
  return <span className={`cl-avatar cl-avatar-${size}`} style={{ "--avatar-colour": colour } as React.CSSProperties} aria-hidden="true">{initials(name)}</span>;
}

function MomentumRing({
  progress,
  size = 44,
  stroke = 4,
  label,
  complete = false,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  label: string;
  complete?: boolean;
}) {
  const clamped = Math.min(1, Math.max(0, progress));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - clamped);
  return (
    <div className={`cl-ring ${complete ? "is-complete" : ""}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="cl-ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className="cl-ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span>{label}</span>
    </div>
  );
}

function LoadingScreen() {
  return (
    <main className="cl-loading-screen">
      <div className="cl-brand-mark" aria-hidden="true"><span /><span /></div>
      <p>Connecting to Commonline</p>
      <span className="cl-loading-indicator" />
    </main>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const signInFlow = useSignInWithUsernamePassword(api.auth);
  const signUpFlow = useSignUpWithUsernamePassword(api.auth);
  const pending = signInFlow.pending || signUpFlow.pending;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const result = mode === "signIn"
      ? await signInFlow.signIn({ username: username.trim(), password })
      : await signUpFlow.signUp({ username: username.trim(), password });
    if (result.status === "error") {
      setError(authErrorText(result.userError.error, result.userError));
    }
  };

  return (
    <main className="cl-auth-screen">
      <div className="cl-auth-top">
        <div className="cl-brand-lockup">
          <span className="cl-brand-mark" aria-hidden="true"><span /><span /></span>
          <span><strong>COMMONLINE</strong><small>GLOBAL NETWORK</small></span>
        </div>
        <span className="cl-auth-region"><i className="cl-live-dot" /> WORLDWIDE</span>
      </div>
      <div className="cl-auth-content">
        <section className="cl-auth-intro">
          <div className="cl-eyebrow"><span className="cl-eyebrow-dot" /> WHERE SHARP MINDS CONVERGE</div>
          <h1>Good work is<br /><em>hard to ignore.</em></h1>
          <p>Commonline connects curious builders, thinkers, and makers worldwide in a fast, signal-rich stream.</p>
          <div className="cl-auth-points">
            <span><Check size={15} /> A personalized feed that adapts to what sparks your curiosity</span>
            <span><Check size={15} /> Daily streaks, momentum tiers, and real-time threads</span>
            <span><Check size={15} /> Build your private vault of high-signal ideas</span>
          </div>
        </section>
        <section className="cl-auth-card" aria-labelledby="auth-title">
          <div className="cl-auth-tabs" role="tablist" aria-label="Account access">
            <button type="button" role="tab" aria-selected={mode === "signIn"} className={mode === "signIn" ? "is-selected" : ""} onClick={() => { setMode("signIn"); setError(""); }}>Sign in</button>
            <button type="button" role="tab" aria-selected={mode === "signUp"} className={mode === "signUp" ? "is-selected" : ""} onClick={() => { setMode("signUp"); setError(""); }}>Create account</button>
          </div>
          <div className="cl-auth-card-body">
            <div className="cl-auth-card-kicker">{mode === "signIn" ? "PICK UP WHERE YOU LEFT OFF" : "JOIN IN 15 SECONDS"}</div>
            <h2 id="auth-title">{mode === "signIn" ? "Welcome back" : "Claim your handle"}</h2>
            <p>{mode === "signIn" ? "Sign in to check your live feed, replies, and streak." : "Pick a username and password — no email wall required."}</p>
            <form className="cl-auth-form" onSubmit={submit}>
              <LabelInput field="Username" autoComplete="username" name="username" onValueChange={setUsername} required />
              <LabelInput field="Password" autoComplete={mode === "signIn" ? "current-password" : "new-password"} name="password" onValueChange={setPassword} required minLength={8} />
              {error && <div className="cl-form-error" role="alert">{error}</div>}
              <button className="cl-button cl-button-primary cl-auth-submit" type="submit" disabled={pending || !username.trim() || !password}>
                {pending ? "Please wait…" : mode === "signIn" ? "Enter Commonline" : "Claim handle & join"}
                <ArrowRight size={16} />
              </button>
            </form>
            <p className="cl-auth-note">Accounts use a username and password. Email addresses are not collected; password recovery is not enabled yet.</p>
          </div>
        </section>
      </div>
      <footer className="cl-auth-footer"><span>COMMONLINE</span><span>Useful connections, everywhere.</span><span>© 2026</span></footer>
    </main>
  );
}

function ProfileSetup({ username }: { username: string }) {
  const [name, setName] = useState(username.replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()));
  const [role, setRole] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const saveProfile = useMutation(api.users.saveProfile);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await saveProfile({ displayName: name, role, bio });
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="cl-onboarding-screen">
      <div className="cl-brand-lockup">
        <span className="cl-brand-mark" aria-hidden="true"><span /><span /></span>
        <span><strong>COMMONLINE</strong><small>GLOBAL NETWORK</small></span>
      </div>
      <section className="cl-onboarding-card">
        <div className="cl-eyebrow"><span className="cl-eyebrow-dot" /> ONE QUICK STEP</div>
        <h1>Set up your profile.</h1>
        <p>Your handle is <strong>@{username}</strong>. Add the name and details you want people across the network to see.</p>
        <form onSubmit={submit} className="cl-profile-form">
          <label className="cl-field"><span>Display name</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required autoComplete="name" /></label>
          <label className="cl-field"><span>Role <small>Optional</small></span><input value={role} onChange={(event) => setRole(event.target.value)} maxLength={80} placeholder="For example, designer, engineer, or researcher" /></label>
          <label className="cl-field"><span>Short introduction <small>Optional</small></span><textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={280} rows={3} placeholder="A few words about what you build or explore" /></label>
          {error && <div className="cl-form-error" role="alert">{error}</div>}
          <button className="cl-button cl-button-primary" type="submit" disabled={saving || name.trim().length < 2}>{saving ? "Saving…" : "Launch into the feed"}<ArrowRight size={16} /></button>
        </form>
      </section>
    </main>
  );
}

function EmptyState({ icon, title, body, action }: { icon: "posts" | "saved" | "members" | "search"; title: string; body: string; action?: { label: string; onClick: () => void } }) {
  const Icon = icon === "posts" ? FileText : icon === "saved" ? Bookmark : icon === "members" ? UsersRound : Search;
  return (
    <div className="cl-empty-state">
      <span className="cl-empty-icon"><Icon size={21} strokeWidth={1.7} /></span>
      <h3>{title}</h3>
      <p>{body}</p>
      {action && <button type="button" className="cl-button cl-button-secondary" onClick={action.onClick}>{action.label}<ArrowRight size={15} /></button>}
    </div>
  );
}

function PostCard({
  post,
  viewerId,
  isActive,
  isTrending,
  comboCount,
  openRepliesSignal,
  onLike,
  onBookmark,
  onReply,
  onShare,
  onRemove,
  onTopicClick,
  onRead,
}: {
  post: Post;
  viewerId: string;
  isActive?: boolean;
  isTrending?: boolean;
  comboCount: number;
  openRepliesSignal?: number;
  onLike: (post: Post) => void;
  onBookmark: (post: Post) => void;
  onReply: (postId: string, body: string) => Promise<void>;
  onShare: (post: Post) => void;
  onRemove: (post: Post) => void;
  onTopicClick?: (topic: string) => void;
  onRead?: (post: Post) => void;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [heartFlash, setHeartFlash] = useState(0);
  const cardRef = useRef<HTMLElement | null>(null);
  const readRecorded = useRef(false);

  useEffect(() => {
    if (openRepliesSignal && openRepliesSignal > 0) {
      setOpen((value) => !value);
    }
  }, [openRepliesSignal]);

  // Passive read detection for weekly reading goal & affinity learning
  useEffect(() => {
    if (!onRead || readRecorded.current) return;
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let timer: number | null = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !readRecorded.current) {
          timer = window.setTimeout(() => {
            if (!readRecorded.current) {
              readRecorded.current = true;
              onRead(post);
            }
          }, 1100);
        } else if (timer) {
          window.clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: 0.55 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timer) window.clearTimeout(timer);
    };
  }, [onRead, post]);

  const submitReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reply.trim() || sending) return;
    setSending(true);
    await onReply(post.id, reply);
    setReply("");
    setSending(false);
  };

  const handleQuickReply = async (text: string) => {
    if (sending) return;
    setSending(true);
    await onReply(post.id, text);
    setSending(false);
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, input, textarea, a, form")) return;
    setHeartFlash((v) => v + 1);
    if (!post.liked) {
      onLike(post);
    }
  };

  const likesBeforeThis = Math.max(0, post.likes - (post.liked ? 1 : 0));
  const isLong = post.body.length > COLLAPSE_THRESHOLD;
  const isFresh = Date.now() - post.createdAt < 30 * 60_000;
  const isHotThread = post.commentCount >= 2;
  // Variable-reward burst: Firework on combos or milestone likes!
  const useFirework = comboCount >= 2 || post.likes === 0 || (post.likes + 1) % 5 === 0;

  return (
    <article
      ref={cardRef}
      className={`cl-post-card ${isActive ? "is-focused" : ""} ${isTrending ? "is-trending" : ""}`}
      id={`post-${post.id}`}
      onDoubleClick={handleDoubleClick}
    >
      {heartFlash > 0 && (
        <span key={heartFlash} className="cl-doubletap-heart" aria-hidden="true">
          <Heart size={54} fill="currentColor" strokeWidth={1.5} />
        </span>
      )}
      <div className="cl-post-header">
        <Avatar name={post.author.name} colour={post.author.avatar} />
        <div className="cl-post-author">
          <div className="cl-post-name">
            <strong>{post.author.name}</strong>
            <span>@{post.author.handle}</span>
            {isTrending && <span className="cl-post-badge cl-badge-trending"><TrendingUp size={10} /> Trending</span>}
            {!isTrending && isHotThread && <span className="cl-post-badge cl-badge-hot"><Flame size={10} /> Active thread</span>}
            {!isTrending && !isHotThread && isFresh && <span className="cl-post-badge cl-badge-fresh">Fresh</span>}
          </div>
          <div className="cl-post-meta">{post.author.role || "Commonline member"}<span>·</span>{relativeTime(post.createdAt)}</div>
        </div>
        {post.author.id === viewerId && <button type="button" className="cl-icon-button cl-post-remove" onClick={() => onRemove(post)} aria-label="Remove your update" title="Remove your update"><Trash2 size={16} /></button>}
      </div>
      <div className={`cl-post-copy ${isLong && !expanded ? "is-clamped" : ""}`}>
        {post.body}
      </div>
      {isLong && !expanded && (
        <button type="button" className="cl-read-more" onClick={() => setExpanded(true)}>
          Read full update <ArrowRight size={12} />
        </button>
      )}
      <div className="cl-post-tags-row">
        <button
          type="button"
          className="cl-post-topic"
          onClick={() => onTopicClick?.(post.topic)}
          title={`Explore #${post.topic}`}
        >
          <Hash size={13} />{post.topic}
        </button>
        <span className="cl-doubletap-hint">Double-click to like</span>
      </div>
      {(post.likes > 0 || post.commentCount > 0) && (
        <div className="cl-post-response-line">
          <span>{post.likes} {post.likes === 1 ? "like" : "likes"}</span>
          <button type="button" onClick={() => setOpen((value) => !value)}>{post.commentCount} {post.commentCount === 1 ? "reply" : "replies"}</button>
        </div>
      )}
      <div className="cl-post-actions">
        <Like
          start={likesBeforeThis}
          liked={post.liked}
          onToggle={() => onLike(post)}
          effect={useFirework ? "Firework" : "Bloom"}
          burst={useFirework ? 55 : 32}
          corner={8}
        />
        <button type="button" className={`cl-post-action ${open ? "is-active" : ""}`} onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          <MessageCircle size={16} /><span>Reply</span>
        </button>
        <button type="button" className="cl-post-action" onClick={() => onShare(post)}><Share2 size={15} /><span>Share</span></button>
        <button type="button" className={`cl-post-action cl-post-save ${post.saved ? "is-saved" : ""}`} onClick={() => onBookmark(post)} aria-pressed={post.saved}>
          {post.saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}<span>{post.saved ? "Saved" : "Save"}</span>
        </button>
      </div>
      {open && (
        <div className="cl-comments-panel">
          {post.comments.length > 0 ? (
            <div className="cl-comment-list">
              {post.comments.map((comment) => (
                <div className="cl-comment" key={comment.id}>
                  <Avatar name={comment.name} colour={comment.avatar} size="sm" />
                  <div><p><strong>{comment.name}</strong><span>· {relativeTime(comment.createdAt)}</span></p><div>{comment.body}</div></div>
                </div>
              ))}
            </div>
          ) : <p className="cl-quiet-note">No replies yet — start the conversation.</p>}
          <div className="cl-quick-replies" aria-label="Quick replies">
            {QUICK_REPLIES.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="cl-quick-reply-chip"
                disabled={sending}
                onClick={() => void handleQuickReply(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
          <form className="cl-reply-form" onSubmit={submitReply}>
            <Avatar name="You" colour="#9fb9aa" size="sm" />
            <input value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write a reply…" maxLength={500} aria-label="Write a reply" />
            <button type="submit" aria-label="Send reply" disabled={!reply.trim() || sending}><Send size={15} /></button>
          </form>
        </div>
      )}
    </article>
  );
}

function MemberCard({ member, onFollow, compact = false }: { member: Member; onFollow: (member: Member) => void; compact?: boolean }) {
  return (
    <article className={`cl-member-card ${compact ? "is-compact" : ""}`}>
      <Avatar name={member.name} colour={member.avatar} size={compact ? "sm" : "lg"} />
      <div className="cl-member-detail">
        <strong>{member.name}</strong>
        <span>@{member.handle}</span>
        {member.role && <p className="cl-member-role">{member.role}</p>}
        {!compact && member.bio && <p className="cl-member-bio">{member.bio}</p>}
      </div>
      <button type="button" className={`cl-follow-button ${member.followed ? "is-following" : ""}`} onClick={() => onFollow(member)} aria-pressed={member.followed}>
        {member.followed ? <Check size={14} /> : <Plus size={14} />}{member.followed ? "Following" : "Follow"}
      </button>
    </article>
  );
}

function ProfileSettings({ profile, onSaved }: { profile: Profile; onSaved: (message: string) => void }) {
  const [name, setName] = useState(profile.displayName);
  const [role, setRole] = useState(profile.role);
  const [bio, setBio] = useState(profile.bio);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const saveProfile = useMutation(api.users.saveProfile);
  useEffect(() => {
    setName(profile.displayName);
    setRole(profile.role);
    setBio(profile.bio);
  }, [profile.displayName, profile.role, profile.bio]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await saveProfile({ displayName: name, role, bio });
      onSaved("Profile saved.");
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSaving(false);
    }
  };
  return (
    <form className="cl-settings-form" onSubmit={submit}>
      <label className="cl-field"><span>Display name</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required /></label>
      <label className="cl-field"><span>Role <small>Optional</small></span><input value={role} onChange={(event) => setRole(event.target.value)} maxLength={80} placeholder="What do you work on?" /></label>
      <label className="cl-field"><span>Short introduction <small>Optional</small></span><textarea value={bio} onChange={(event) => setBio(event.target.value)} rows={4} maxLength={280} placeholder="Share what you're curious about or building" /></label>
      <div className="cl-form-bottom"><span>{bio.length}/280</span><button className="cl-button cl-button-primary" type="submit" disabled={saving || name.trim().length < 2}>{saving ? "Saving…" : "Save changes"}</button></div>
      {error && <div className="cl-form-error" role="alert">{error}</div>}
    </form>
  );
}

function Workspace({ profile }: { profile: Profile }) {
  const [page, setPage] = useState<Page>("home");
  const [scope, setScope] = useState<FeedScope>("For You");
  const [postSearch, setPostSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [body, setBody] = useState(() => loadDraft(profile._id)?.body ?? "");
  const [topic, setTopic] = useState(() => loadDraft(profile._id)?.topic ?? "General");
  const [posting, setPosting] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [flash, setFlash] = useState("");
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());
  const [engagement, setEngagement] = useState<EngagementState>(() => loadEngagementState(profile._id));
  const [rewards, setRewards] = useState<RewardPop[]>([]);
  const [celebrationId, setCelebrationId] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [replySignal, setReplySignal] = useState<{ postId: string; count: number }>({ postId: "", count: 0 });
  const [newPostCount, setNewPostCount] = useState(0);

  const sessionSalt = useRef(Math.floor(Math.random() * 100_000));
  const comboRef = useRef<{ count: number; lastAt: number }>({ count: 0, lastAt: 0 });
  const seenFeedIds = useRef<Set<string> | null>(null);
  const rewardIdRef = useRef(1);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const flashTimer = useRef<number | null>(null);
  const goalTimer = useRef<number | null>(null);
  const [weeklyGoal, setWeeklyGoal] = useState(8);
  const [goalStatus, setGoalStatus] = useState("Fills up live as you read updates this week.");
  const goalLoaded = useRef(false);

  const feedMode = page === "saved" ? "saved" : page === "home" && scope === "Following" ? "following" : "all";
  const posts = useQuery(api.posts.feed, { mode: feedMode, search: page === "home" ? postSearch : "" }) as Post[] | undefined;
  const topics = useQuery(api.posts.topics, {}) as Topic[] | undefined;
  const summary = useQuery(api.posts.summary, {});
  const members = useQuery(api.members.list, { search: memberSearch }) as Member[] | undefined;
  const notifications = useQuery(api.notifications.unread, {}) as NotificationItem[] | undefined;
  const preferences = useQuery(api.preferences.current, {});

  const createPost = useMutation(api.posts.create);
  const toggleLike = useMutation(api.posts.toggleLike);
  const toggleBookmark = useMutation(api.posts.toggleBookmark);
  const replyToPost = useMutation(api.posts.reply);
  const removePost = useMutation(api.posts.remove);
  const toggleFollow = useMutation(api.members.toggleFollow);
  const markRead = useMutation(api.notifications.markRead);
  const saveWeeklyGoal = useMutation(api.preferences.saveWeeklyGoal);
  const { signOut } = useAuthActions();

  // Persist engagement state whenever it updates
  useEffect(() => {
    saveEngagementState(profile._id, engagement);
  }, [profile._id, engagement]);

  // Persist unfinished draft (Zeigarnik open-loop recovery)
  useEffect(() => {
    saveDraft(profile._id, body, topic);
  }, [profile._id, body, topic]);

  const rankedPosts = useMemo(() => {
    const base = posts ?? [];
    if (page !== "home") return base;
    return rankPosts(base, scope, engagement, sessionSalt.current);
  }, [posts, page, scope, engagement]);

  const trendingPostId = useMemo(() => {
    const list = posts ?? [];
    if (!list.length) return null;
    let best: Post | null = null;
    let bestScore = 0;
    for (const p of list) {
      const score = p.likes * 1.4 + p.commentCount * 3;
      if (score > bestScore && score >= 2) {
        bestScore = score;
        best = p;
      }
    }
    return best?.id ?? null;
  }, [posts]);

  const suggestedMembers = useMemo(() => {
    return (members ?? []).filter((m) => !m.followed).slice(0, 3);
  }, [members]);

  const deck = useMemo(
    () => (posts ?? []).slice(0, 4).map((post) => ({ id: post.id, title: post.topic, body: post.body })),
    [posts],
  );

  // Detect live incoming posts from others when user has scrolled down
  useEffect(() => {
    if (!posts || page !== "home" || postSearch) return;
    const ids = new Set(posts.map((p) => p.id));
    if (seenFeedIds.current === null) {
      seenFeedIds.current = ids;
      return;
    }
    let fresh = 0;
    for (const p of posts) {
      if (!seenFeedIds.current.has(p.id) && p.author.id !== profile._id) {
        fresh += 1;
      }
    }
    if (fresh > 0 && window.scrollY > 240) {
      setNewPostCount((prev) => prev + fresh);
    }
    seenFeedIds.current = ids;
  }, [posts, page, postSearch, profile._id]);

  useEffect(() => () => {
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    if (goalTimer.current) window.clearTimeout(goalTimer.current);
  }, []);

  useEffect(() => {
    if (!preferences || goalLoaded.current) return;
    setWeeklyGoal(preferences.weeklyGoal);
    goalLoaded.current = true;
  }, [preferences]);

  useEffect(() => {
    const target = window.location.hash.slice(1);
    if (!target.startsWith("post-")) return;
    const timer = window.setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
    return () => window.clearTimeout(timer);
  }, [posts]);

  const unreadCount = notifications?.length ?? 0;

  // Dynamic browser tab title & re-engagement trigger on visibility change
  useEffect(() => {
    const baseTitle = unreadCount > 0 ? `(${unreadCount}) Commonline` : "Commonline";
    const syncTitle = () => {
      if (document.hidden) {
        if (!engagement.streakLockedToday && engagement.streak > 0) {
          document.title = `Keep your ${engagement.streak}-day streak alive · Commonline`;
        } else if (unreadCount > 0) {
          document.title = `(${unreadCount}) New activity waiting · Commonline`;
        } else if (body.trim()) {
          document.title = "Unfinished update saved · Commonline";
        } else {
          document.title = "Fresh updates in the stream · Commonline";
        }
      } else {
        document.title = baseTitle;
      }
    };
    syncTitle();
    document.addEventListener("visibilitychange", syncTitle);
    return () => {
      document.removeEventListener("visibilitychange", syncTitle);
      document.title = "Commonline";
    };
  }, [unreadCount, engagement.streakLockedToday, engagement.streak, body]);

  const pushReward = useCallback((label: string, tone: RewardPop["tone"], sublabel?: string) => {
    const id = rewardIdRef.current++;
    setRewards((prev) => [...prev.slice(-2), { id, label, sublabel, tone }]);
    window.setTimeout(() => {
      setRewards((prev) => prev.filter((item) => item.id !== id));
    }, 2400);
  }, []);

  const triggerCelebration = useCallback(() => {
    setCelebrationId((v) => v + 1);
    playMilestoneSound();
  }, []);

  const applyEngagement = useCallback(
    (action: EngagementAction, meta: { topic?: string; authorId?: string; postId?: string; combo?: number } = {}) => {
      setEngagement((prev) => {
        const outcome = recordEngagementAction(prev, action, { ...meta, weeklyGoal });
        if (outcome.xpEarned > 0) {
          if (outcome.tierUp) {
            pushReward(`Level up: ${outcome.tierUp.name}!`, "tier", `+${outcome.xpEarned} XP`);
            triggerCelebration();
          } else if (outcome.streakJustLocked) {
            pushReward(
              `${outcome.state.streak}-day streak locked!`,
              "streak",
              `+${outcome.xpEarned} XP bonus`,
            );
            triggerCelebration();
          } else if (outcome.weeklyGoalJustHit) {
            pushReward("Weekly reading target hit!", "tier", "+30 XP bonus");
            triggerCelebration();
          } else if (action === "like" && outcome.combo >= 2) {
            pushReward(`Combo ×${outcome.combo}`, "combo", `+${outcome.xpEarned} XP`);
          } else if (action !== "read") {
            pushReward(`+${outcome.xpEarned} XP`, "xp");
          }
        }
        return outcome.state;
      });
    },
    [weeklyGoal, pushReward, triggerCelebration],
  );

  const showFlash = useCallback((message: string) => {
    setFlash(message);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(""), 3000);
  }, []);

  const changePage = (next: Page) => {
    playTabSound();
    setPage(next);
    setMobileNavOpen(false);
    setPostSearch("");
    setSearchInput("");
    setActiveIndex(-1);
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) playTabSound();
    showFlash(next ? "Tactile sound effects on." : "Sound effects muted.");
  };

  const submitPost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!body.trim() || posting) return;
    setPosting(true);
    try {
      await createPost({ body, topic });
      playPublishSound();
      applyEngagement("post", { topic });
      setBody("");
      saveDraft(profile._id, "", topic);
      setComposerOpen(false);
      setPage("home");
      setScope("Latest");
      showFlash("Update published to the stream.");
    } catch (cause) {
      showFlash(errorText(cause));
    } finally {
      setPosting(false);
    }
  };

  const handleLike = useCallback(async (post: Post) => {
    try {
      const result = await toggleLike({ postId: post.id as Id<"posts"> });
      if (result.liked) {
        const now = Date.now();
        const withinCombo = now - comboRef.current.lastAt < 12_000;
        const nextCombo = withinCombo ? comboRef.current.count + 1 : 1;
        comboRef.current = { count: nextCombo, lastAt: now };
        playLikeSound(nextCombo);
        applyEngagement("like", { topic: post.topic, authorId: post.author.id, postId: post.id, combo: nextCombo });
      } else {
        playUnlikeSound();
      }
    } catch (cause) {
      showFlash(errorText(cause));
    }
  }, [toggleLike, applyEngagement, showFlash]);

  const handleBookmark = useCallback(async (post: Post) => {
    try {
      const result = await toggleBookmark({ postId: post.id as Id<"posts"> });
      playSaveSound(result.saved);
      if (result.saved) {
        applyEngagement("save", { topic: post.topic, authorId: post.author.id, postId: post.id });
      }
      showFlash(result.saved ? "Saved to your private vault." : "Removed from saved posts.");
    } catch (cause) {
      showFlash(errorText(cause));
    }
  }, [toggleBookmark, applyEngagement, showFlash]);

  const handleReply = useCallback(async (postId: string, replyBody: string) => {
    try {
      const target = rankedPosts.find((p) => p.id === postId);
      await replyToPost({ postId: postId as Id<"posts">, body: replyBody });
      playReplySound();
      applyEngagement("reply", { topic: target?.topic, authorId: target?.author.id, postId });
      showFlash("Reply posted.");
    } catch (cause) {
      showFlash(errorText(cause));
    }
  }, [rankedPosts, replyToPost, applyEngagement, showFlash]);

  const handleFollow = useCallback(async (member: Member) => {
    try {
      const result = await toggleFollow({ targetId: member.id as Id<"users"> });
      playFollowSound(result.followed);
      if (result.followed) {
        applyEngagement("follow", { authorId: member.id });
      }
      showFlash(result.followed ? `Following ${member.name}.` : `Unfollowed ${member.name}.`);
    } catch (cause) {
      showFlash(errorText(cause));
    }
  }, [toggleFollow, applyEngagement, showFlash]);

  const handleRemove = async (post: Post) => {
    if (!window.confirm("Remove this update? Its replies and likes will also be removed.")) return;
    try {
      await removePost({ postId: post.id as Id<"posts"> });
      showFlash("Update removed.");
    } catch (cause) {
      showFlash(errorText(cause));
    }
  };

  const handleSharePost = async (post: Post) => {
    const url = new URL(window.location.href);
    url.hash = `post-${post.id}`;
    try {
      await navigator.clipboard.writeText(url.toString());
      playSaveSound(true);
      showFlash("Post link copied.");
    } catch {
      showFlash("Your browser could not copy the link. You can copy it from the address bar.");
    }
  };

  const handleShareCommonline = async () => {
    const url = window.location.origin;
    try {
      if (navigator.share) await navigator.share({ title: "Commonline", text: "Join me on Commonline — a global network for people and work worth sharing.", url });
      else {
        await navigator.clipboard.writeText(url);
        playSaveSound(true);
        showFlash("Commonline invite link copied.");
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      showFlash("Use your browser's share menu to copy the Commonline link.");
    }
  };

  const handlePostRead = useCallback((post: Post) => {
    applyEngagement("read", { topic: post.topic, authorId: post.author.id, postId: post.id });
  }, [applyEngagement]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPostSearch(searchInput.trim());
    setPage("home");
    setScope("Latest");
  };

  const changeGoal = (value: number) => {
    setWeeklyGoal(value);
    setGoalStatus("Saving…");
    if (goalTimer.current) window.clearTimeout(goalTimer.current);
    goalTimer.current = window.setTimeout(() => {
      void saveWeeklyGoal({ weeklyGoal: value })
        .then(() => setGoalStatus("Saved — your live reading ring now tracks this target."))
        .catch((cause) => setGoalStatus(errorText(cause)));
    }, 650);
  };

  const markNotificationRead = async (id: string) => {
    try {
      await markRead({ notificationId: id as Id<"notifications"> });
      playTabSound();
    } catch (cause) {
      showFlash(errorText(cause));
    }
  };

  // Keyboard power-browsing (J/K glide, L like, S save, R reply, N compose, / search)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "/") {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (key === "n" && page === "home") {
        event.preventDefault();
        setComposerOpen(true);
        return;
      }
      if ((page === "home" || page === "saved") && rankedPosts.length > 0) {
        if (key === "j") {
          event.preventDefault();
          const next = Math.min(rankedPosts.length - 1, activeIndex + 1);
          setActiveIndex(next);
          document.getElementById(`post-${rankedPosts[next].id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        } else if (key === "k") {
          event.preventDefault();
          const next = Math.max(0, activeIndex <= 0 ? 0 : activeIndex - 1);
          setActiveIndex(next);
          document.getElementById(`post-${rankedPosts[next].id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        } else if (activeIndex >= 0 && rankedPosts[activeIndex]) {
          const currentPost = rankedPosts[activeIndex];
          if (key === "l") {
            event.preventDefault();
            void handleLike(currentPost);
          } else if (key === "s") {
            event.preventDefault();
            void handleBookmark(currentPost);
          } else if (key === "r") {
            event.preventDefault();
            setReplySignal((prev) => ({ postId: currentPost.id, count: prev.postId === currentPost.id ? prev.count + 1 : 1 }));
          }
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [page, rankedPosts, activeIndex, handleLike, handleBookmark]);

  const currentPosts = rankedPosts;
  const tierInfo = getTierInfo(engagement.xp);
  const dailyProgress = Math.min(1, engagement.todayActions / DAILY_ACTION_TARGET);
  const actionsRemaining = Math.max(0, DAILY_ACTION_TARGET - engagement.todayActions);
  const weeklyReadCount = engagement.readPostIds.length;
  const weeklyProgress = Math.min(1, weeklyReadCount / Math.max(1, weeklyGoal));
  const sevenDays = getLastSevenDays(engagement.activeDays, engagement.todayKey);

  // Zeigarnik profile completion calculation
  const followingCount = (members ?? []).filter((m) => m.followed).length;
  const completionChecks = [
    { done: profile.displayName.trim().length >= 2, label: "display name" },
    { done: profile.role.trim().length > 0, label: "add your role", action: () => changePage("settings") },
    { done: profile.bio.trim().length > 0, label: "add a short intro", action: () => changePage("settings") },
    { done: followingCount > 0 || engagement.totalPosts > 0, label: "follow someone or share an update", action: () => setComposerOpen(true) },
  ];
  const completedSteps = completionChecks.filter((c) => c.done).length;
  const completionPct = Math.round((completedSteps / completionChecks.length) * 100);
  const nextIncomplete = completionChecks.find((c) => !c.done);

  const hasDraft = body.trim().length > 0 && !composerOpen;

  return (
    <div className="cl-app">
      <CelebrationBurst burstId={celebrationId} />
      <RewardStack items={rewards} />

      <aside className={`cl-sidebar ${mobileNavOpen ? "is-open" : ""}`}>
        <button className="cl-brand-lockup" type="button" onClick={() => changePage("home")} aria-label="Commonline home">
          <span className="cl-brand-mark" aria-hidden="true"><span /><span /></span>
          <span><strong>COMMONLINE</strong><small>GLOBAL NETWORK</small></span>
        </button>
        <div className="cl-nav-label">WORKSPACE</div>
        <nav className="cl-primary-nav" aria-label="Main navigation">
          <NavButton icon={<House size={18} />} label="Home" page="home" current={page} onClick={changePage} />
          <NavButton icon={<Compass size={18} />} label="Explore" page="explore" current={page} onClick={changePage} />
          <NavButton icon={<UsersRound size={18} />} label="Members" page="network" current={page} onClick={changePage} badge={suggestedMembers.length > 0 ? String(suggestedMembers.length) : undefined} />
          <NavButton icon={<Bookmark size={18} />} label="Saved" page="saved" current={page} onClick={changePage} />
        </nav>
        <div className="cl-sidebar-rule" />
        <div className="cl-nav-label">YOUR MOMENTUM</div>
        <div className="cl-momentum-mini">
          <div className="cl-momentum-mini-top">
            <MomentumRing
              progress={dailyProgress}
              size={40}
              stroke={3.5}
              label={`${Math.min(engagement.todayActions, DAILY_ACTION_TARGET)}/${DAILY_ACTION_TARGET}`}
              complete={engagement.streakLockedToday}
            />
            <div className="cl-momentum-mini-copy">
              <strong>
                <Flame size={12} className={engagement.streakLockedToday ? "is-lit" : ""} />
                {engagement.streak > 0 ? `${engagement.streak}-day streak` : "Start a streak"}
              </strong>
              <small>
                {engagement.streakLockedToday
                  ? "Locked in today!"
                  : `${actionsRemaining} ${actionsRemaining === 1 ? "action" : "actions"} to lock today`}
              </small>
            </div>
          </div>
          <div className="cl-tier-bar-wrap">
            <div className="cl-tier-bar-meta">
              <span><Trophy size={10} /> {tierInfo.current.name}</span>
              <span>{engagement.xp} XP</span>
            </div>
            <div className="cl-progress-track">
              <span className="cl-progress-fill" style={{ width: `${Math.max(8, Math.round(tierInfo.progress * 100))}%`, background: tierInfo.current.accent }} />
            </div>
            {tierInfo.next && <small className="cl-tier-next">{tierInfo.xpToNext} XP to {tierInfo.next.name}</small>}
          </div>
        </div>

        <div className="cl-sidebar-rule" />
        <div className="cl-nav-label">YOUR ACCOUNT</div>
        <NavButton icon={<Settings size={18} />} label="Settings" page="settings" current={page} onClick={changePage} />
        <div className="cl-sidebar-bottom">
          <button className="cl-share-card" type="button" onClick={handleShareCommonline}>
            <span className="cl-share-card-icon"><Copy size={16} /></span>
            <strong>Invite someone sharp</strong>
            <small>Grow your signal with a direct link.</small>
            <span className="cl-share-card-link">Copy or share link <ArrowRight size={14} /></span>
          </button>
          <div className="cl-profile-chip">
            <Avatar name={profile.displayName} colour={profile.avatarColor} size="sm" />
            <div><strong>{profile.displayName}</strong><span>@{profile.handle || profile.username}</span></div>
            <button className="cl-icon-button" type="button" aria-label="Sign out" title="Sign out" onClick={() => void signOut()}><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      <main className="cl-main">
        <header className="cl-topbar">
          <button type="button" className="cl-icon-button cl-mobile-menu" aria-label="Open navigation" onClick={() => setMobileNavOpen((open) => !open)}><Menu size={19} /></button>
          <div className="cl-breadcrumb"><span>COMMONLINE</span><span>/</span><strong>{PAGE_LABEL[page].toUpperCase()}</strong></div>
          <form className="cl-search" onSubmit={submitSearch}>
            <Search size={16} />
            <input ref={searchInputRef} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search updates, topics, people  (/)" aria-label="Search Commonline" />
            {searchInput && <button type="button" aria-label="Clear search" onClick={() => { setSearchInput(""); setPostSearch(""); }}><X size={14} /></button>}
            <button type="submit" className="cl-search-submit" aria-label="Submit search"><ArrowRight size={15} /></button>
          </form>
          <div className="cl-topbar-actions">
            <button
              type="button"
              className={`cl-streak-pill ${engagement.streakLockedToday ? "is-locked" : "is-open-loop"}`}
              onClick={() => changePage("settings")}
              title={engagement.streakLockedToday ? "Daily streak locked!" : `${actionsRemaining} actions left to lock today's streak`}
            >
              <Flame size={14} />
              <span>{engagement.streak}</span>
            </button>
            <button
              type="button"
              className="cl-icon-button"
              onClick={toggleSound}
              aria-label={soundOn ? "Mute sound effects" : "Enable sound effects"}
              title={soundOn ? "Sound effects on" : "Sound effects muted"}
            >
              {soundOn ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </button>
            <button type="button" className="cl-share-button" onClick={handleShareCommonline}>Invite <ArrowRight size={14} /></button>
            <button type="button" className={`cl-icon-button cl-bell-button ${notificationsOpen ? "is-active" : ""}`} aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} onClick={() => setNotificationsOpen(true)}>
              <Bell size={18} />{unreadCount > 0 && <i />}
            </button>
            <button type="button" className="cl-top-avatar" onClick={() => changePage("settings")} aria-label="Open profile settings"><Avatar name={profile.displayName} colour={profile.avatarColor} size="sm" /></button>
          </div>
        </header>

        <div className="cl-page-content">
          {page === "home" && (
            <>
              <section className="cl-page-heading cl-home-heading">
                <div>
                  <div className="cl-eyebrow"><span className="cl-eyebrow-dot" /> LIVE NETWORK <span className="cl-eyebrow-separator">/</span> HOME</div>
                  <h1>{getTimeGreeting(profile.displayName)}.</h1>
                  <p>
                    {!engagement.streakLockedToday
                      ? `${actionsRemaining} quick ${actionsRemaining === 1 ? "interaction" : "interactions"} today ${engagement.streak > 0 ? `keeps your ${engagement.streak}-day streak alive` : "starts your streak"}.`
                      : `You're locked in today (${tierInfo.current.name} · ${engagement.xp} XP). Keep the signal moving.`}
                  </p>
                </div>
                <div className="cl-heading-actions">
                  <span className="cl-live-count"><i className="cl-live-dot" /> <strong>{summary?.members ?? "—"}</strong> worldwide</span>
                  <button type="button" className="cl-button cl-button-primary" onClick={() => setComposerOpen(true)}><Plus size={16} /> New update</button>
                </div>
              </section>

              {completionPct < 100 && !engagement.dismissedProfileNudge && nextIncomplete && (
                <div className="cl-completion-banner">
                  <div className="cl-completion-copy">
                    <span className="cl-completion-tag">{completionPct}% PROFILE COMPLETE</span>
                    <strong>Almost there — {nextIncomplete.label}.</strong>
                  </div>
                  <div className="cl-completion-bar">
                    <span style={{ width: `${completionPct}%` }} />
                  </div>
                  <div className="cl-completion-actions">
                    {nextIncomplete.action && (
                      <button type="button" className="cl-button cl-button-secondary cl-completion-cta" onClick={nextIncomplete.action}>
                        Finish step <ArrowRight size={13} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="cl-icon-button"
                      aria-label="Dismiss profile reminder"
                      onClick={() => setEngagement((prev) => ({ ...prev, dismissedProfileNudge: true }))}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}

              <div className="cl-home-grid">
                <section className="cl-feed-column" aria-label="Network updates">
                  {newPostCount > 0 && (
                    <button
                      type="button"
                      className="cl-new-updates-pill"
                      onClick={() => {
                        setNewPostCount(0);
                        playTabSound();
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      <ArrowUp size={13} /> {newPostCount} new {newPostCount === 1 ? "update" : "updates"} in the stream
                    </button>
                  )}

                  <div className="cl-feed-topline">
                    <div>
                      <span className="cl-section-label">STREAM</span>
                      <span className="cl-section-separator" />
                      <span className="cl-secondary-label">{summary?.posts ?? "—"} updates</span>
                      <span className="cl-section-separator" />
                      <span className="cl-secondary-label">{weeklyReadCount}/{weeklyGoal} read this week</span>
                    </div>
                    {postSearch && <button type="button" className="cl-clear-search" onClick={() => { setPostSearch(""); setSearchInput(""); }}>Clear “{postSearch}” <X size={13} /></button>}
                  </div>
                  <div className="cl-feed-tabs" role="tablist" aria-label="Feed view">
                    {(["For You", "Rising", "Following", "Latest"] as FeedScope[]).map((item) => (
                      <button
                        type="button"
                        key={item}
                        role="tab"
                        aria-selected={scope === item}
                        className={scope === item ? "is-selected" : ""}
                        onClick={() => {
                          playTabSound();
                          setScope(item);
                          setActiveIndex(-1);
                        }}
                      >
                        {item === "For You" && <Sparkles size={11} />}
                        {item === "Rising" && <Zap size={11} />}
                        {item}
                      </button>
                    ))}
                  </div>
                  <section className={`cl-composer ${composerOpen ? "is-open" : ""} ${hasDraft ? "has-draft" : ""}`}>
                    <Avatar name={profile.displayName} colour={profile.avatarColor} size="sm" />
                    {!composerOpen ? (
                      <button className="cl-composer-prompt" type="button" onClick={() => setComposerOpen(true)}>
                        <span>
                          {hasDraft ? (
                            <>
                              <i className="cl-draft-dot" /> Draft saved — finish sharing your update…
                            </>
                          ) : (
                            "Drop a sharp thought, question, or work-in-progress (+25 XP)"
                          )}
                        </span>
                        <Plus size={16} />
                      </button>
                    ) : (
                      <form className="cl-composer-form" onSubmit={submitPost}>
                        <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="What are you building, learning, or questioning right now?" maxLength={1000} autoFocus aria-label="Write an update" />
                        <div className="cl-composer-footer">
                          <label className="cl-topic-select"><Hash size={14} /><select value={topic} onChange={(event) => setTopic(event.target.value)} aria-label="Choose a topic">{TOPIC_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown size={13} /></label>
                          <span className="cl-character-count">{body.length}/1000</span>
                          <button type="button" className="cl-text-button" onClick={() => setComposerOpen(false)}>Keep draft</button>
                          {body.trim() && <button type="button" className="cl-text-button" onClick={() => { setBody(""); setComposerOpen(false); }}>Discard</button>}
                          <button type="submit" className="cl-button cl-button-primary cl-publish-button" disabled={!body.trim() || posting}>{posting ? "Publishing…" : "Publish (+25 XP)"}<ArrowRight size={14} /></button>
                        </div>
                      </form>
                    )}
                  </section>

                  {posts === undefined ? <div className="cl-loading-card"><span /><span /><span /></div> : currentPosts.length === 0 ? (
                    <EmptyState
                      icon={postSearch ? "search" : "posts"}
                      title={postSearch ? "No matching updates" : scope === "Following" ? "No updates from people you follow" : "No updates yet"}
                      body={postSearch ? "Try another word or topic." : scope === "Following" ? "Follow a few members to build your personal feed." : "Start the momentum with a project note, question, or useful discovery."}
                      action={postSearch ? { label: "Clear search", onClick: () => { setPostSearch(""); setSearchInput(""); } } : scope === "Following" ? { label: "Explore members", onClick: () => changePage("network") } : { label: "Write the first update", onClick: () => setComposerOpen(true) }}
                    />
                  ) : (
                    <>
                      <div className="cl-post-list">
                        {currentPosts.map((post, idx) => (
                          <PostCard
                            key={post.id}
                            post={post}
                            viewerId={profile._id}
                            isActive={idx === activeIndex}
                            isTrending={post.id === trendingPostId}
                            comboCount={comboRef.current.count}
                            openRepliesSignal={replySignal.postId === post.id ? replySignal.count : 0}
                            onLike={handleLike}
                            onBookmark={handleBookmark}
                            onReply={handleReply}
                            onShare={handleSharePost}
                            onRemove={handleRemove}
                            onTopicClick={(t) => {
                              playTabSound();
                              setSearchInput(t);
                              setPostSearch(t);
                              setScope("Latest");
                            }}
                            onRead={handlePostRead}
                          />
                        ))}
                      </div>
                      <div className="cl-feed-endcap">
                        <span><Sparkles size={13} /> Caught up on this view</span>
                        <div className="cl-feed-endcap-actions">
                          <button type="button" onClick={() => { playTabSound(); setScope(scope === "Rising" ? "For You" : "Rising"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                            Switch to {scope === "Rising" ? "For You" : "Rising"} <ArrowRight size={12} />
                          </button>
                          <button type="button" onClick={() => changePage("explore")}>
                            Explore more <ArrowRight size={12} />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </section>

                <aside className="cl-home-rail">
                  <section className="cl-panel cl-rail-pulse">
                    <div className="cl-panel-heading">
                      <div>
                        <span className="cl-section-label">DAILY PULSE</span>
                        <h2>{engagement.streakLockedToday ? "Streak locked in" : "Keep it rolling"}</h2>
                      </div>
                      <span className={`cl-live-badge ${engagement.streakLockedToday ? "is-done" : ""}`}>
                        <Flame size={11} /> {engagement.streak}d
                      </span>
                    </div>
                    <div className="cl-watcher-row">
                      <div className="cl-watcher-stage">
                        <EyeTracker size={62} shape="Cube" eyes="Slant" follow={70} bounce={35} within=".cl-rail-pulse" />
                      </div>
                      <div className="cl-watcher-stats">
                        <MomentumRing
                          progress={weeklyProgress}
                          size={44}
                          stroke={4}
                          label={`${Math.round(weeklyProgress * 100)}%`}
                          complete={weeklyProgress >= 1}
                        />
                        <div>
                          <strong>{weeklyReadCount}/{weeklyGoal} read</strong>
                          <small>{weeklyReadCount >= weeklyGoal ? "Weekly target hit!" : `${Math.max(0, weeklyGoal - weeklyReadCount)} more this week`}</small>
                        </div>
                      </div>
                    </div>
                    <div className="cl-week-strip" aria-label="7-day activity streak">
                      {sevenDays.map((day) => (
                        <div key={day.key} className={`cl-week-day ${day.active ? "is-active" : ""} ${day.isToday ? "is-today" : ""}`}>
                          <span />
                          <small>{day.label}</small>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="cl-panel cl-rail-posts">
                    <div className="cl-panel-heading"><div><span className="cl-section-label">SPOTLIGHT DECK</span><h2>Fresh from the stream</h2></div><FileText size={17} /></div>
                    {deck.length ? <><div className="cl-card-swap"><CardSwap cards={deck} auto every={6} /></div><p className="cl-card-hint">Drag or tap a card to flip through recent updates.</p></> : <div className="cl-rail-empty"><p>Updates from members will appear here.</p><button type="button" onClick={() => setComposerOpen(true)}>Share an update <ArrowRight size={14} /></button></div>}
                  </section>

                  {suggestedMembers.length > 0 && (
                    <section className="cl-panel cl-rail-people">
                      <div className="cl-panel-heading"><div><span className="cl-section-label">WHO TO FOLLOW</span><h2>Expand your signal</h2></div><UsersRound size={17} /></div>
                      <div className="cl-member-list">
                        {suggestedMembers.map((member) => (
                          <MemberCard key={member.id} member={member} onFollow={handleFollow} compact />
                        ))}
                      </div>
                    </section>
                  )}

                  <section className="cl-panel cl-rail-topics">
                    <div className="cl-panel-heading"><div><span className="cl-section-label">TRENDING TOPICS</span><h2>What’s moving now</h2></div><Hash size={17} /></div>
                    {topics === undefined ? <p className="cl-quiet-note">Loading topics…</p> : topics.length ? topics.slice(0, 5).map((item, index) => <button className="cl-topic-row" type="button" key={item.name} onClick={() => { playTabSound(); setSearchInput(item.name); setPostSearch(item.name); setPage("home"); setScope("Latest"); }}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.name}</strong><small>{item.count}</small><ArrowRight size={14} /></button>) : <p className="cl-quiet-note">Topics appear here as members share updates.</p>}
                  </section>

                  <div className="cl-network-note">
                    <Globe2 size={15} />
                    <p>People everywhere, connected by the work they share. <span className="cl-kbd-hint">Keys: J/K scroll · L like · N post</span></p>
                  </div>
                </aside>
              </div>
            </>
          )}

          {page === "explore" && (
            <>
              <section className="cl-page-heading cl-explore-heading">
                <div><div className="cl-eyebrow"><span className="cl-eyebrow-dot" /> DISCOVERY <span className="cl-eyebrow-separator">/</span> WORLDWIDE</div><h1>Explore the network.</h1><p>Find sharp people, fast-moving topics, and ideas worth following.</p></div>
                <div className="cl-explore-art" aria-hidden="true"><Particles shape="Circle" force={25} grain="Fine" /></div>
              </section>
              <div className="cl-explore-grid">
                <section className="cl-panel cl-explore-topics">
                  <div className="cl-panel-heading"><div><span className="cl-section-label">FROM RECENT UPDATES</span><h2>Topics</h2></div><Hash size={17} /></div>
                  {topics === undefined ? <p className="cl-quiet-note">Loading topics…</p> : topics.length ? topics.map((item, index) => <button className="cl-topic-row" type="button" key={item.name} onClick={() => { playTabSound(); setSearchInput(item.name); setPostSearch(item.name); setPage("home"); }}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.name}</strong><small>{item.count} {item.count === 1 ? "update" : "updates"}</small><ArrowRight size={14} /></button>) : <EmptyState icon="search" title="No topics yet" body="Topics will appear as members publish updates." />}
                </section>
                <section className="cl-panel cl-explore-members">
                  <div className="cl-panel-heading"><div><span className="cl-section-label">MEMBER DIRECTORY</span><h2>People to follow</h2></div><UsersRound size={17} /></div>
                  <label className="cl-directory-search"><Search size={15} /><input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Search names, roles or bios" aria-label="Search members" /></label>
                  {members === undefined ? <div className="cl-loading-card"><span /><span /></div> : members.length ? <div className="cl-member-list">{members.map((member) => <MemberCard key={member.id} member={member} onFollow={handleFollow} />)}</div> : <EmptyState icon="members" title={memberSearch ? "No members found" : "No other members yet"} body={memberSearch ? "Try another name or role." : "Invite a colleague or friend to grow the network."} action={!memberSearch ? { label: "Share Commonline", onClick: handleShareCommonline } : undefined} />}
                </section>
              </div>
            </>
          )}

          {page === "network" && (
            <>
              <section className="cl-page-heading">
                <div><div className="cl-eyebrow"><span className="cl-eyebrow-dot" /> YOUR NETWORK <span className="cl-eyebrow-separator">/</span> MEMBERS</div><h1>People behind the work.</h1><p>Follow people whose ideas sharpen yours — your feed adapts instantly.</p></div>
                <button type="button" className="cl-button cl-button-secondary" onClick={handleShareCommonline}>Share Commonline <ArrowRight size={14} /></button>
              </section>
              <section className="cl-panel cl-directory-panel">
                <div className="cl-panel-heading"><div><span className="cl-section-label">GLOBAL DIRECTORY</span><h2>{members?.length ?? "—"} other members</h2></div><UsersRound size={17} /></div>
                <label className="cl-directory-search"><Search size={15} /><input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Search names, roles or bios" aria-label="Search members" /></label>
                {members === undefined ? <div className="cl-loading-card"><span /><span /><span /></div> : members.length ? <div className="cl-member-list">{members.map((member) => <MemberCard key={member.id} member={member} onFollow={handleFollow} />)}</div> : <EmptyState icon="members" title={memberSearch ? "No members found" : "No other members yet"} body={memberSearch ? "Try a different search." : "Share Commonline with a colleague when you're ready."} action={!memberSearch ? { label: "Share Commonline", onClick: handleShareCommonline } : undefined} />}
              </section>
            </>
          )}

          {page === "saved" && (
            <>
              <section className="cl-page-heading">
                <div><div className="cl-eyebrow"><span className="cl-eyebrow-dot" /> YOUR VAULT <span className="cl-eyebrow-separator">/</span> PRIVATE</div><h1>Saved for later.</h1><p>Your private library of high-signal ideas and threads.</p></div>
                <BookmarkCheck size={25} className="cl-heading-icon" />
              </section>
              {posts === undefined ? <div className="cl-loading-card"><span /><span /></div> : currentPosts.length ? <div className="cl-post-list cl-saved-list">{currentPosts.map((post, idx) => <PostCard key={post.id} post={post} viewerId={profile._id} isActive={idx === activeIndex} comboCount={comboRef.current.count} onLike={handleLike} onBookmark={handleBookmark} onReply={handleReply} onShare={handleSharePost} onRemove={handleRemove} />)}</div> : <EmptyState icon="saved" title="Your vault is empty" body="Save standout updates to keep them one click away." action={{ label: "Explore updates", onClick: () => changePage("home") }} />}
            </>
          )}

          {page === "settings" && (
            <>
              <section className="cl-page-heading">
                <div><div className="cl-eyebrow"><span className="cl-eyebrow-dot" /> YOUR ACCOUNT <span className="cl-eyebrow-separator">/</span> SETTINGS</div><h1>Profile, pace & momentum.</h1><p>Customize how members see you and tune your reading target and feedback.</p></div>
              </section>
              <div className="cl-settings-grid">
                <section className="cl-panel cl-settings-panel">
                  <div className="cl-panel-heading"><div><span className="cl-section-label">PROFILE</span><h2>Member details</h2></div><Avatar name={profile.displayName} colour={profile.avatarColor} size="sm" /></div>
                  <div className="cl-handle-note">Username <strong>@{profile.handle || profile.username}</strong> · managed with your account</div>
                  <ProfileSettings profile={profile} onSaved={showFlash} />
                </section>
                <aside className="cl-settings-side">
                  <section className="cl-panel cl-momentum-card">
                    <div className="cl-section-label">YOUR MOMENTUM STATS</div>
                    <h2>{tierInfo.current.name} · {engagement.xp} XP</h2>
                    <div className="cl-stats-mini-grid">
                      <div><strong>{engagement.streak}d</strong><span>Current streak</span></div>
                      <div><strong>{engagement.longestStreak}d</strong><span>Best streak</span></div>
                      <div><strong>{weeklyReadCount}/{weeklyGoal}</strong><span>Read this week</span></div>
                    </div>
                  </section>
                  <section className="cl-panel cl-goal-panel">
                    <div className="cl-section-label">WEEKLY READING TARGET</div>
                    <h2>Set your weekly pace.</h2>
                    <p>Your reading ring fills up live as you read updates through the week.</p>
                    {preferences === undefined ? <div className="cl-preference-loading">Loading preferences…</div> : <div className="cl-counter-wrap"><RollingCounter start={weeklyGoal} onValueChange={changeGoal} corner={12} bounce={35} /></div>}
                    <div className="cl-goal-status"><span />{goalStatus}</div>
                  </section>
                  <section className="cl-panel cl-account-panel">
                    <div className="cl-section-label">EXPERIENCE & ACCESS</div>
                    <p>Signed in as <strong>@{profile.handle || profile.username}</strong></p>
                    <div className="cl-account-actions">
                      <button type="button" className="cl-button cl-button-secondary" onClick={toggleSound}>
                        {soundOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
                        {soundOn ? "Sound effects: On" : "Sound effects: Off"}
                      </button>
                      <button type="button" className="cl-button cl-button-secondary" onClick={() => void signOut()}><LogOut size={15} /> Sign out</button>
                    </div>
                  </section>
                </aside>
              </div>
            </>
          )}

          <footer className="cl-footer"><span>COMMONLINE</span><span>Where great work finds its people.</span><span>© 2026</span></footer>
        </div>
      </main>

      {notificationsOpen && (
        <>
          <button type="button" className="cl-drawer-backdrop" aria-label="Close notifications" onClick={() => setNotificationsOpen(false)} />
          <aside className="cl-notifications-drawer" aria-label="Notifications">
            <div className="cl-drawer-header"><div><span className="cl-section-label">ACTIVITY</span><h2>Notifications</h2></div><button type="button" className="cl-icon-button" onClick={() => setNotificationsOpen(false)} aria-label="Close notifications"><X size={18} /></button></div>
            <p className="cl-drawer-intro">Replies and new follows from across your network.</p>
            {notifications === undefined ? <div className="cl-loading-card"><span /><span /></div> : notifications.length ? (
              <ToastStack
                items={notifications.map((item) => ({
                  id: item.id,
                  kind: item.kind === "reply" ? "info" as const : "success" as const,
                  title: item.kind === "reply" ? `${item.actorName} replied` : `${item.actorName} followed you`,
                  body: item.kind === "reply" ? (item.postExcerpt ? `“${item.postExcerpt}”` : "A reply was added to your update.") : `@${item.actorHandle} joined your network.`,
                  action: "Mark read",
                }))}
                onRead={markNotificationRead}
              />
            ) : <div className="cl-notification-empty"><span><Bell size={19} /></span><strong>You're all caught up.</strong><p>New replies and follows will appear here live.</p></div>}
          </aside>
        </>
      )}

      {flash && <div className="cl-toast-message" role="status"><span><Check size={13} /></span>{flash}</div>}
    </div>
  );
}

function NavButton({ icon, label, page, current, onClick, badge }: { icon: React.ReactNode; label: string; page: Page; current: Page; onClick: (page: Page) => void; badge?: string }) {
  return (
    <button type="button" className={`cl-nav-item ${current === page ? "is-current" : ""}`} onClick={() => onClick(page)} aria-current={current === page ? "page" : undefined}>
      {icon}
      <span>{label}</span>
      {badge && <em className="cl-nav-badge">{badge}</em>}
    </button>
  );
}

export default function App() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const profile = useQuery(api.users.current, isAuthenticated ? {} : "skip") as Profile | null | undefined;
  if (isLoading || (isAuthenticated && profile === undefined)) return <LoadingScreen />;
  if (!isAuthenticated || profile == null) return <AuthScreen />;
  if (!profile.displayName.trim()) return <ProfileSetup username={profile.username || profile.handle} />;
  return <Workspace profile={profile} />;
}
