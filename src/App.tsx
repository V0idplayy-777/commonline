import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowRight,
  Bell,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronDown,
  Compass,
  Copy,
  FileText,
  Hash,
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
  UsersRound,
  X,
} from "lucide-react";
import { useSignInWithUsernamePassword } from "@convex-dev/auth/methods/username-password/react";
import { useSignUpWithUsernamePassword } from "@convex-dev/auth/methods/username-password/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { CardSwap } from "./components/bencho/CardSwap";
import { LabelInput } from "./components/bencho/LabelInput";
import { Like } from "./components/bencho/Like";
import { Particles } from "./components/bencho/Particles";
import { RollingCounter } from "./components/bencho/RollingCounter";
import { ToastStack } from "./components/bencho/ToastStack";
import type { Member, NotificationItem, Post, Topic } from "./types";

type Page = "home" | "explore" | "network" | "saved" | "settings";
type FeedScope = "Everyone" | "Following";
type Profile = Doc<"users"> & { username: string };

const PAGE_LABEL: Record<Page, string> = {
  home: "Home",
  explore: "Explore",
  network: "Members",
  saved: "Saved",
  settings: "Settings",
};

const TOPIC_OPTIONS = ["General", "Field notes", "Projects", "Questions", "Research", "Opportunities", "Resources"];

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

function relativeTime(value: number) {
  const elapsed = Math.max(0, Date.now() - value);
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "short" }).format(value);
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
          <span><strong>COMMONLINE</strong><small>AOTEAROA NETWORK</small></span>
        </div>
        <span className="cl-auth-region">NEW ZEALAND</span>
      </div>
      <div className="cl-auth-content">
        <section className="cl-auth-intro">
          <div className="cl-eyebrow"><span className="cl-eyebrow-dot" /> A PROFESSIONAL NETWORK</div>
          <h1>Good work is<br /><em>worth sharing.</em></h1>
          <p>Commonline brings people and useful ideas together across Aotearoa.</p>
          <div className="cl-auth-points">
            <span><Check size={15} /> Share work and questions</span>
            <span><Check size={15} /> Follow people, not a popularity feed</span>
            <span><Check size={15} /> Keep useful posts for later</span>
          </div>
        </section>
        <section className="cl-auth-card" aria-labelledby="auth-title">
          <div className="cl-auth-tabs" role="tablist" aria-label="Account access">
            <button type="button" role="tab" aria-selected={mode === "signIn"} className={mode === "signIn" ? "is-selected" : ""} onClick={() => { setMode("signIn"); setError(""); }}>Sign in</button>
            <button type="button" role="tab" aria-selected={mode === "signUp"} className={mode === "signUp" ? "is-selected" : ""} onClick={() => { setMode("signUp"); setError(""); }}>Create account</button>
          </div>
          <div className="cl-auth-card-body">
            <div className="cl-auth-card-kicker">{mode === "signIn" ? "YOUR ACCOUNT" : "JOIN COMMONLINE"}</div>
            <h2 id="auth-title">{mode === "signIn" ? "Welcome back" : "Create your account"}</h2>
            <p>{mode === "signIn" ? "Sign in to see your network and saved work." : "Choose a username and password to get started."}</p>
            <form className="cl-auth-form" onSubmit={submit}>
              <LabelInput field="Username" autoComplete="username" name="username" onValueChange={setUsername} required />
              <LabelInput field="Password" autoComplete={mode === "signIn" ? "current-password" : "new-password"} name="password" onValueChange={setPassword} required minLength={8} />
              {error && <div className="cl-form-error" role="alert">{error}</div>}
              <button className="cl-button cl-button-primary cl-auth-submit" type="submit" disabled={pending || !username.trim() || !password}>
                {pending ? "Please wait…" : mode === "signIn" ? "Sign in" : "Create account"}
                <ArrowRight size={16} />
              </button>
            </form>
            <p className="cl-auth-note">Accounts use a username and password. Email addresses are not collected; password recovery is not enabled yet.</p>
          </div>
        </section>
      </div>
      <footer className="cl-auth-footer"><span>COMMONLINE</span><span>Useful connections across Aotearoa.</span><span>© 2026</span></footer>
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
        <span><strong>COMMONLINE</strong><small>AOTEAROA NETWORK</small></span>
      </div>
      <section className="cl-onboarding-card">
        <div className="cl-eyebrow"><span className="cl-eyebrow-dot" /> PROFILE SETUP</div>
        <h1>Set up your profile.</h1>
        <p>Your username is <strong>@{username}</strong>. Add the name and details you want other members to see.</p>
        <form onSubmit={submit} className="cl-profile-form">
          <label className="cl-field"><span>Display name</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required autoComplete="name" /></label>
          <label className="cl-field"><span>Role <small>Optional</small></span><input value={role} onChange={(event) => setRole(event.target.value)} maxLength={80} placeholder="For example, researcher or project lead" /></label>
          <label className="cl-field"><span>Short introduction <small>Optional</small></span><textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={280} rows={3} placeholder="A few words about your work or interests" /></label>
          {error && <div className="cl-form-error" role="alert">{error}</div>}
          <button className="cl-button cl-button-primary" type="submit" disabled={saving || name.trim().length < 2}>{saving ? "Saving…" : "Save profile"}<ArrowRight size={16} /></button>
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
  onLike,
  onBookmark,
  onReply,
  onShare,
  onRemove,
}: {
  post: Post;
  viewerId: string;
  onLike: (post: Post) => void;
  onBookmark: (post: Post) => void;
  onReply: (postId: string, body: string) => Promise<void>;
  onShare: (post: Post) => void;
  onRemove: (post: Post) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const submitReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reply.trim() || sending) return;
    setSending(true);
    await onReply(post.id, reply);
    setReply("");
    setSending(false);
  };
  const likesBeforeThis = Math.max(0, post.likes - (post.liked ? 1 : 0));

  return (
    <article className="cl-post-card" id={`post-${post.id}`}>
      <div className="cl-post-header">
        <Avatar name={post.author.name} colour={post.author.avatar} />
        <div className="cl-post-author">
          <div className="cl-post-name"><strong>{post.author.name}</strong><span>@{post.author.handle}</span></div>
          <div className="cl-post-meta">{post.author.role || "Commonline member"}<span>·</span>{relativeTime(post.createdAt)}</div>
        </div>
        {post.author.id === viewerId && <button type="button" className="cl-icon-button cl-post-remove" onClick={() => onRemove(post)} aria-label="Remove your update" title="Remove your update"><Trash2 size={16} /></button>}
      </div>
      <div className="cl-post-copy">{post.body}</div>
      <div className="cl-post-topic"><Hash size={13} />{post.topic}</div>
      {(post.likes > 0 || post.commentCount > 0) && (
        <div className="cl-post-response-line">
          <span>{post.likes} {post.likes === 1 ? "like" : "likes"}</span>
          <button type="button" onClick={() => setOpen((value) => !value)}>{post.commentCount} {post.commentCount === 1 ? "reply" : "replies"}</button>
        </div>
      )}
      <div className="cl-post-actions">
        <Like start={likesBeforeThis} liked={post.liked} onToggle={() => onLike(post)} burst={30} corner={8} />
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
          ) : <p className="cl-quiet-note">No replies yet. Add the first one.</p>}
          <form className="cl-reply-form" onSubmit={submitReply}>
            <Avatar name="You" colour="#9fb9aa" size="sm" />
            <input value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write a reply" maxLength={500} aria-label="Write a reply" />
            <button type="submit" aria-label="Send reply" disabled={!reply.trim() || sending}><Send size={15} /></button>
          </form>
        </div>
      )}
    </article>
  );
}

function MemberCard({ member, onFollow }: { member: Member; onFollow: (member: Member) => void }) {
  return (
    <article className="cl-member-card">
      <Avatar name={member.name} colour={member.avatar} size="lg" />
      <div className="cl-member-detail">
        <strong>{member.name}</strong>
        <span>@{member.handle}</span>
        {member.role && <p className="cl-member-role">{member.role}</p>}
        {member.bio && <p className="cl-member-bio">{member.bio}</p>}
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
      <label className="cl-field"><span>Role <small>Optional</small></span><input value={role} onChange={(event) => setRole(event.target.value)} maxLength={80} /></label>
      <label className="cl-field"><span>Short introduction <small>Optional</small></span><textarea value={bio} onChange={(event) => setBio(event.target.value)} rows={4} maxLength={280} /></label>
      <div className="cl-form-bottom"><span>{bio.length}/280</span><button className="cl-button cl-button-primary" type="submit" disabled={saving || name.trim().length < 2}>{saving ? "Saving…" : "Save changes"}</button></div>
      {error && <div className="cl-form-error" role="alert">{error}</div>}
    </form>
  );
}

function Workspace({ profile }: { profile: Profile }) {
  const [page, setPage] = useState<Page>("home");
  const [scope, setScope] = useState<FeedScope>("Everyone");
  const [postSearch, setPostSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [body, setBody] = useState("");
  const [topic, setTopic] = useState("General");
  const [posting, setPosting] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [flash, setFlash] = useState("");
  const flashTimer = useRef<number | null>(null);
  const goalTimer = useRef<number | null>(null);
  const [weeklyGoal, setWeeklyGoal] = useState(8);
  const [goalStatus, setGoalStatus] = useState("A private target. No streaks or public rankings.");
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

  const deck = useMemo(() => (posts ?? []).slice(0, 4).map((post) => ({ id: post.id, title: post.topic, body: post.body })), [posts]);

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

  const showFlash = (message: string) => {
    setFlash(message);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(""), 3000);
  };

  const changePage = (next: Page) => {
    setPage(next);
    setMobileNavOpen(false);
    setPostSearch("");
    setSearchInput("");
  };

  const submitPost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!body.trim() || posting) return;
    setPosting(true);
    try {
      await createPost({ body, topic });
      setBody("");
      setComposerOpen(false);
      setPage("home");
      setScope("Everyone");
      showFlash("Update published.");
    } catch (cause) {
      showFlash(errorText(cause));
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (post: Post) => {
    try {
      await toggleLike({ postId: post.id as Id<"posts"> });
    } catch (cause) {
      showFlash(errorText(cause));
    }
  };

  const handleBookmark = async (post: Post) => {
    try {
      const result = await toggleBookmark({ postId: post.id as Id<"posts"> });
      showFlash(result.saved ? "Saved for later." : "Removed from saved posts.");
    } catch (cause) {
      showFlash(errorText(cause));
    }
  };

  const handleReply = async (postId: string, replyBody: string) => {
    try {
      await replyToPost({ postId: postId as Id<"posts">, body: replyBody });
      showFlash("Reply posted.");
    } catch (cause) {
      showFlash(errorText(cause));
    }
  };

  const handleFollow = async (member: Member) => {
    try {
      const result = await toggleFollow({ targetId: member.id as Id<"users"> });
      showFlash(result.followed ? `Following ${member.name}.` : `Unfollowed ${member.name}.`);
    } catch (cause) {
      showFlash(errorText(cause));
    }
  };

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
      showFlash("Post link copied.");
    } catch {
      showFlash("Your browser could not copy the link. You can copy it from the address bar.");
    }
  };

  const handleShareCommonline = async () => {
    const url = window.location.origin;
    try {
      if (navigator.share) await navigator.share({ title: "Commonline", text: "A professional network for Aotearoa.", url });
      else {
        await navigator.clipboard.writeText(url);
        showFlash("Commonline link copied.");
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      showFlash("Use your browser's share menu to copy the Commonline link.");
    }
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPostSearch(searchInput.trim());
    setPage("home");
    setScope("Everyone");
  };

  const changeGoal = (value: number) => {
    setWeeklyGoal(value);
    setGoalStatus("Saving…");
    if (goalTimer.current) window.clearTimeout(goalTimer.current);
    goalTimer.current = window.setTimeout(() => {
      void saveWeeklyGoal({ weeklyGoal: value })
        .then(() => setGoalStatus("Saved to your preferences."))
        .catch((cause) => setGoalStatus(errorText(cause)));
    }, 650);
  };

  const markNotificationRead = async (id: string) => {
    try {
      await markRead({ notificationId: id as Id<"notifications"> });
    } catch (cause) {
      showFlash(errorText(cause));
    }
  };

  const currentPosts = posts ?? [];
  const unreadCount = notifications?.length ?? 0;

  return (
    <div className="cl-app">
      <aside className={`cl-sidebar ${mobileNavOpen ? "is-open" : ""}`}>
        <button className="cl-brand-lockup" type="button" onClick={() => changePage("home")} aria-label="Commonline home">
          <span className="cl-brand-mark" aria-hidden="true"><span /><span /></span>
          <span><strong>COMMONLINE</strong><small>AOTEAROA NETWORK</small></span>
        </button>
        <div className="cl-nav-label">WORKSPACE</div>
        <nav className="cl-primary-nav" aria-label="Main navigation">
          <NavButton icon={<House size={18} />} label="Home" page="home" current={page} onClick={changePage} />
          <NavButton icon={<Compass size={18} />} label="Explore" page="explore" current={page} onClick={changePage} />
          <NavButton icon={<UsersRound size={18} />} label="Members" page="network" current={page} onClick={changePage} />
          <NavButton icon={<Bookmark size={18} />} label="Saved" page="saved" current={page} onClick={changePage} />
        </nav>
        <div className="cl-sidebar-rule" />
        <div className="cl-nav-label">YOUR ACCOUNT</div>
        <NavButton icon={<Settings size={18} />} label="Settings" page="settings" current={page} onClick={changePage} />
        <div className="cl-sidebar-bottom">
          <button className="cl-share-card" type="button" onClick={handleShareCommonline}>
            <span className="cl-share-card-icon"><Copy size={16} /></span>
            <strong>Share Commonline</strong>
            <small>Invite a colleague with a link.</small>
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
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search updates, topics, people" aria-label="Search Commonline" />
            {searchInput && <button type="button" aria-label="Clear search" onClick={() => { setSearchInput(""); setPostSearch(""); }}><X size={14} /></button>}
            <button type="submit" className="cl-search-submit" aria-label="Submit search"><ArrowRight size={15} /></button>
          </form>
          <div className="cl-topbar-actions">
            <button type="button" className="cl-share-button" onClick={handleShareCommonline}>Share <ArrowRight size={14} /></button>
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
                  <div className="cl-eyebrow"><span className="cl-eyebrow-dot" /> AOTEAROA NETWORK <span className="cl-eyebrow-separator">/</span> HOME</div>
                  <h1>Keep up with the work.</h1>
                  <p>Share useful updates and stay connected to the people behind them.</p>
                </div>
                <div className="cl-heading-actions"><span className="cl-live-count"><strong>{summary?.members ?? "—"}</strong> members</span><button type="button" className="cl-button cl-button-primary" onClick={() => setComposerOpen(true)}><Plus size={16} /> New update</button></div>
              </section>
              <div className="cl-home-grid">
                <section className="cl-feed-column" aria-label="Network updates">
                  <div className="cl-feed-topline">
                    <div><span className="cl-section-label">UPDATES</span><span className="cl-section-separator" /><span className="cl-secondary-label">{summary?.posts ?? "—"} in the network</span></div>
                    {postSearch && <button type="button" className="cl-clear-search" onClick={() => { setPostSearch(""); setSearchInput(""); }}>Clear search <X size={13} /></button>}
                  </div>
                  <div className="cl-feed-tabs" role="tablist" aria-label="Feed view">
                    {(["Everyone", "Following"] as FeedScope[]).map((item) => <button type="button" key={item} role="tab" aria-selected={scope === item} className={scope === item ? "is-selected" : ""} onClick={() => setScope(item)}>{item}</button>)}
                  </div>
                  <section className={`cl-composer ${composerOpen ? "is-open" : ""}`}>
                    <Avatar name={profile.displayName} colour={profile.avatarColor} size="sm" />
                    {!composerOpen ? (
                      <button className="cl-composer-prompt" type="button" onClick={() => setComposerOpen(true)}>Share an update with the network <Plus size={16} /></button>
                    ) : (
                      <form className="cl-composer-form" onSubmit={submitPost}>
                        <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="What are you working on? Share a project update, a question or a useful resource." maxLength={1000} autoFocus aria-label="Write an update" />
                        <div className="cl-composer-footer">
                          <label className="cl-topic-select"><Hash size={14} /><select value={topic} onChange={(event) => setTopic(event.target.value)} aria-label="Choose a topic">{TOPIC_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown size={13} /></label>
                          <span className="cl-character-count">{body.length}/1000</span>
                          <button type="button" className="cl-text-button" onClick={() => { setComposerOpen(false); setBody(""); }}>Cancel</button>
                          <button type="submit" className="cl-button cl-button-primary cl-publish-button" disabled={!body.trim() || posting}>{posting ? "Publishing…" : "Publish"}<ArrowRight size={14} /></button>
                        </div>
                      </form>
                    )}
                  </section>

                  {posts === undefined ? <div className="cl-loading-card"><span /><span /><span /></div> : currentPosts.length === 0 ? (
                    <EmptyState
                      icon={postSearch ? "search" : "posts"}
                      title={postSearch ? "No matching updates" : scope === "Following" ? "No updates from people you follow" : "No updates yet"}
                      body={postSearch ? "Try another word or topic." : scope === "Following" ? "Follow a member to see their updates here." : "Start the conversation with a project note, question or useful resource."}
                      action={postSearch ? { label: "Clear search", onClick: () => { setPostSearch(""); setSearchInput(""); } } : scope === "Following" ? { label: "Explore members", onClick: () => changePage("network") } : { label: "Write the first update", onClick: () => setComposerOpen(true) }}
                    />
                  ) : (
                    <div className="cl-post-list">
                      {currentPosts.map((post) => <PostCard key={post.id} post={post} viewerId={profile._id} onLike={handleLike} onBookmark={handleBookmark} onReply={handleReply} onShare={handleSharePost} onRemove={handleRemove} />)}
                    </div>
                  )}
                </section>
                <aside className="cl-home-rail">
                  <section className="cl-panel cl-rail-posts">
                    <div className="cl-panel-heading"><div><span className="cl-section-label">RECENT WORK</span><h2>From the network</h2></div><FileText size={17} /></div>
                    {deck.length ? <><div className="cl-card-swap"><CardSwap cards={deck} /></div><p className="cl-card-hint">Select or drag a card to see another recent update.</p></> : <div className="cl-rail-empty"><p>Updates from members will appear here.</p><button type="button" onClick={() => setComposerOpen(true)}>Share an update <ArrowRight size={14} /></button></div>}
                  </section>
                  <section className="cl-panel cl-rail-topics">
                    <div className="cl-panel-heading"><div><span className="cl-section-label">TOPICS</span><h2>What people are discussing</h2></div><Hash size={17} /></div>
                    {topics === undefined ? <p className="cl-quiet-note">Loading topics…</p> : topics.length ? topics.slice(0, 5).map((item, index) => <button className="cl-topic-row" type="button" key={item.name} onClick={() => { setSearchInput(item.name); setPostSearch(item.name); setPage("home"); setScope("Everyone"); }}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.name}</strong><small>{item.count}</small><ArrowRight size={14} /></button>) : <p className="cl-quiet-note">Topics appear here as members share updates.</p>}
                  </section>
                  <div className="cl-network-note"><Sparkles size={15} /><p>People across Aotearoa, connected by the work they share.</p></div>
                </aside>
              </div>
            </>
          )}

          {page === "explore" && (
            <>
              <section className="cl-page-heading cl-explore-heading">
                <div><div className="cl-eyebrow"><span className="cl-eyebrow-dot" /> DISCOVERY <span className="cl-eyebrow-separator">/</span> AOTEAROA</div><h1>Explore the network.</h1><p>Find people, topics and updates worth following.</p></div>
                <div className="cl-explore-art" aria-hidden="true"><Particles shape="Circle" force={25} grain="Fine" /></div>
              </section>
              <div className="cl-explore-grid">
                <section className="cl-panel cl-explore-topics">
                  <div className="cl-panel-heading"><div><span className="cl-section-label">FROM RECENT UPDATES</span><h2>Topics</h2></div><Hash size={17} /></div>
                  {topics === undefined ? <p className="cl-quiet-note">Loading topics…</p> : topics.length ? topics.map((item, index) => <button className="cl-topic-row" type="button" key={item.name} onClick={() => { setSearchInput(item.name); setPostSearch(item.name); setPage("home"); }}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.name}</strong><small>{item.count} {item.count === 1 ? "update" : "updates"}</small><ArrowRight size={14} /></button>) : <EmptyState icon="search" title="No topics yet" body="Topics will appear as members publish updates." />}
                </section>
                <section className="cl-panel cl-explore-members">
                  <div className="cl-panel-heading"><div><span className="cl-section-label">MEMBER DIRECTORY</span><h2>People to follow</h2></div><UsersRound size={17} /></div>
                  <label className="cl-directory-search"><Search size={15} /><input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Search names, roles or bios" aria-label="Search members" /></label>
                  {members === undefined ? <div className="cl-loading-card"><span /><span /></div> : members.length ? <div className="cl-member-list">{members.map((member) => <MemberCard key={member.id} member={member} onFollow={handleFollow} />)}</div> : <EmptyState icon="members" title={memberSearch ? "No members found" : "No other members yet"} body={memberSearch ? "Try another name or role." : "Share Commonline with a colleague to grow the network."} action={!memberSearch ? { label: "Share Commonline", onClick: handleShareCommonline } : undefined} />}
                </section>
              </div>
            </>
          )}

          {page === "network" && (
            <>
              <section className="cl-page-heading">
                <div><div className="cl-eyebrow"><span className="cl-eyebrow-dot" /> YOUR NETWORK <span className="cl-eyebrow-separator">/</span> MEMBERS</div><h1>People behind the work.</h1><p>Follow members to make your feed more relevant.</p></div>
                <button type="button" className="cl-button cl-button-secondary" onClick={handleShareCommonline}>Share Commonline <ArrowRight size={14} /></button>
              </section>
              <section className="cl-panel cl-directory-panel">
                <div className="cl-panel-heading"><div><span className="cl-section-label">DIRECTORY</span><h2>{members?.length ?? "—"} other members</h2></div><UsersRound size={17} /></div>
                <label className="cl-directory-search"><Search size={15} /><input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Search names, roles or bios" aria-label="Search members" /></label>
                {members === undefined ? <div className="cl-loading-card"><span /><span /><span /></div> : members.length ? <div className="cl-member-list">{members.map((member) => <MemberCard key={member.id} member={member} onFollow={handleFollow} />)}</div> : <EmptyState icon="members" title={memberSearch ? "No members found" : "No other members yet"} body={memberSearch ? "Try a different search." : "Share Commonline with a colleague when you're ready."} action={!memberSearch ? { label: "Share Commonline", onClick: handleShareCommonline } : undefined} />}
              </section>
            </>
          )}

          {page === "saved" && (
            <>
              <section className="cl-page-heading">
                <div><div className="cl-eyebrow"><span className="cl-eyebrow-dot" /> YOUR LIBRARY <span className="cl-eyebrow-separator">/</span> PRIVATE</div><h1>Saved for later.</h1><p>Only you can see the updates you save.</p></div>
                <BookmarkCheck size={25} className="cl-heading-icon" />
              </section>
              {posts === undefined ? <div className="cl-loading-card"><span /><span /></div> : currentPosts.length ? <div className="cl-post-list cl-saved-list">{currentPosts.map((post) => <PostCard key={post.id} post={post} viewerId={profile._id} onLike={handleLike} onBookmark={handleBookmark} onReply={handleReply} onShare={handleSharePost} onRemove={handleRemove} />)}</div> : <EmptyState icon="saved" title="Nothing saved yet" body="Save an update to keep it close at hand." action={{ label: "Explore updates", onClick: () => changePage("home") }} />}
            </>
          )}

          {page === "settings" && (
            <>
              <section className="cl-page-heading">
                <div><div className="cl-eyebrow"><span className="cl-eyebrow-dot" /> YOUR ACCOUNT <span className="cl-eyebrow-separator">/</span> SETTINGS</div><h1>Profile and preferences.</h1><p>Choose what other members see and set your own reading pace.</p></div>
              </section>
              <div className="cl-settings-grid">
                <section className="cl-panel cl-settings-panel">
                  <div className="cl-panel-heading"><div><span className="cl-section-label">PROFILE</span><h2>Member details</h2></div><Avatar name={profile.displayName} colour={profile.avatarColor} size="sm" /></div>
                  <div className="cl-handle-note">Username <strong>@{profile.handle || profile.username}</strong> · managed with your account</div>
                  <ProfileSettings profile={profile} onSaved={showFlash} />
                </section>
                <aside className="cl-settings-side">
                  <section className="cl-panel cl-goal-panel">
                    <div className="cl-section-label">PERSONAL READING GOAL</div>
                    <h2>Choose a weekly target.</h2>
                    <p>A private reminder of how many updates you want to catch up on. It does not affect your feed or profile.</p>
                    {preferences === undefined ? <div className="cl-preference-loading">Loading preferences…</div> : <div className="cl-counter-wrap"><RollingCounter start={weeklyGoal} onValueChange={changeGoal} corner={12} bounce={35} /></div>}
                    <div className="cl-goal-status"><span />{goalStatus}</div>
                  </section>
                  <section className="cl-panel cl-account-panel">
                    <div className="cl-section-label">ACCOUNT ACCESS</div>
                    <p>Signed in as <strong>@{profile.handle || profile.username}</strong></p>
                    <button type="button" className="cl-button cl-button-secondary" onClick={() => void signOut()}><LogOut size={15} /> Sign out</button>
                  </section>
                </aside>
              </div>
            </>
          )}

          <footer className="cl-footer"><span>COMMONLINE</span><span>A professional network for Aotearoa.</span><span>© 2026</span></footer>
        </div>
      </main>

      {notificationsOpen && (
        <>
          <button type="button" className="cl-drawer-backdrop" aria-label="Close notifications" onClick={() => setNotificationsOpen(false)} />
          <aside className="cl-notifications-drawer" aria-label="Notifications">
            <div className="cl-drawer-header"><div><span className="cl-section-label">ACTIVITY</span><h2>Notifications</h2></div><button type="button" className="cl-icon-button" onClick={() => setNotificationsOpen(false)} aria-label="Close notifications"><X size={18} /></button></div>
            <p className="cl-drawer-intro">Replies and new follows from your network.</p>
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
            ) : <div className="cl-notification-empty"><span><Bell size={19} /></span><strong>You're all caught up.</strong><p>New replies and follows will appear here.</p></div>}
          </aside>
        </>
      )}

      {flash && <div className="cl-toast-message" role="status"><span><Check size={13} /></span>{flash}</div>}
    </div>
  );
}

function NavButton({ icon, label, page, current, onClick }: { icon: React.ReactNode; label: string; page: Page; current: Page; onClick: (page: Page) => void }) {
  return <button type="button" className={`cl-nav-item ${current === page ? "is-current" : ""}`} onClick={() => onClick(page)} aria-current={current === page ? "page" : undefined}>{icon}<span>{label}</span></button>;
}

export default function App() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const profile = useQuery(api.users.current, isAuthenticated ? {} : "skip") as Profile | null | undefined;
  if (isLoading || (isAuthenticated && profile === undefined)) return <LoadingScreen />;
  if (!isAuthenticated || profile == null) return <AuthScreen />;
  if (!profile.displayName.trim()) return <ProfileSetup username={profile.username || profile.handle} />;
  return <Workspace profile={profile} />;
}
