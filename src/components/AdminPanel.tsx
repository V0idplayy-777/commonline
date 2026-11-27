import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  BellRing,
  Eraser,
  Ghost,
  Hammer,
  Heart,
  Info,
  Lock,
  LockKeyhole,
  Megaphone,
  MessageSquareX,
  Pin,
  PinOff,
  RefreshCw,
  Search,
  ShieldCheck,
  Shuffle,
  Snowflake,
  Timer,
  Trash2,
  TriangleAlert,
  UserPlus,
  UserRoundPen,
  Wand2,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { SHREK_URL } from "./admin/Overlays";

type OverviewData = NonNullable<FunctionReturnType<typeof api.admin.overview>>;
type MemberRow = OverviewData["members"][number];
type PostRow = OverviewData["posts"][number];

const TOKEN_KEY = "cl.admin.token";
const SESSION_NOTE = "admin session";

const FEATURES = [
  "Global announcement",
  "Direct member alert",
  "Rename member",
  "Rewrite role & bio",
  "Verified flair",
  "Suspend / reinstate",
  "Inject followers",
  "Delete member",
  "Delete any update",
  "Pin update",
  "Purge replies",
  "Wipe feed",
  "Topic locks",
  "Freeze network",
  "Slow mode",
  "Chaos shuffle",
  "Mass-like",
  "Hamburbur bomb",
  "Upside-down mode",
  "The Great Renaming",
];

function readToken(): string {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeToken(token: string) {
  try {
    if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
    else window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode — session simply won't persist */
  }
}

function stamp(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function messageOf(error: unknown) {
  if (error instanceof Error) return error.message;
  return "That action failed.";
}

function FeatureCard({
  index,
  title,
  description,
  icon,
  danger,
  children,
}: {
  index: number;
  title: string;
  description: string;
  icon: ReactNode;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`cl-admin-card ${danger ? "is-danger" : ""}`}>
      <header className="cl-admin-card-head">
        <span className="cl-admin-card-icon">{icon}</span>
        <div>
          <span className="cl-admin-card-index">FEATURE {String(index).padStart(2, "0")}</span>
          <h3>{title}</h3>
        </div>
      </header>
      <p className="cl-admin-card-desc">{description}</p>
      <div className="cl-admin-card-body">{children}</div>
    </section>
  );
}

function MiniToggle({ on }: { on: boolean }) {
  return <span className={`cl-admin-flag ${on ? "is-on" : ""}`}>{on ? "ON" : "OFF"}</span>;
}

function UnlockGate({
  onUnlocked,
  onExit,
  message,
}: {
  onUnlocked: (token: string) => void;
  onExit: () => void;
  message: string;
}) {
  const unlock = useMutation(api.admin.unlock);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(message);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (message) setError(message);
  }, [message]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const result = await unlock({ password });
      onUnlocked(result.token);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="cl-admin-gate">
      <section className="cl-admin-gate-card">
        <span className="cl-admin-shield"><ShieldCheck size={25} /></span>
        <span className="cl-eyebrow"><span className="cl-eyebrow-dot" /> RESTRICTED CONSOLE</span>
        <h1>Admin access only.</h1>
        <p>
          This console is limited to the Commonline staff allow-list. Every action is
          re-checked against that allow-list on the server before it is allowed to run.
        </p>
        <form className="cl-admin-gate-form" onSubmit={submit}>
          <label className="cl-field">
            <span>Console password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Enter the admin password"
              required
            />
          </label>
          {error && <div className="cl-form-error" role="alert">{error}</div>}
          <button className="cl-button cl-button-primary" type="submit" disabled={pending || !password}>
            <Lock size={14} /> {pending ? "Checking…" : "Unlock console"}
          </button>
        </form>
        <button type="button" className="cl-admin-text-button" onClick={onExit}>Return to Commonline</button>
      </section>
    </div>
  );
}

export function AdminPanel({
  viewerName,
  onExit,
  onFlash,
}: {
  viewerName: string;
  onExit: () => void;
  onFlash: (message: string) => void;
}) {
  const [token, setToken] = useState(readToken);
  const [gateMessage, setGateMessage] = useState("");
  const overview = useQuery(api.admin.overview, token ? { token } : "skip");
  const lock = useMutation(api.admin.lock);

  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [roleDraft, setRoleDraft] = useState("");
  const [bioDraft, setBioDraft] = useState("");
  const [alertTitle, setAlertTitle] = useState("");
  const [alertBody, setAlertBody] = useState("");
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annMood, setAnnMood] = useState<"info" | "warning" | "party">("info");
  const [annParty, setAnnParty] = useState(false);
  const [followerCount, setFollowerCount] = useState(10);
  const [selectedPostId, setSelectedPostId] = useState("");
  const [likeCount, setLikeCount] = useState(25);
  const [topicInput, setTopicInput] = useState("");
  const [slowDraft, setSlowDraft] = useState(0);
  const [bombMessage, setBombMessage] = useState("hamburbur");
  const [bombSeconds, setBombSeconds] = useState(45);

  const setAnnouncement = useMutation(api.admin.setAnnouncement);
  const clearAnnouncement = useMutation(api.admin.clearAnnouncement);
  const alertMember = useMutation(api.admin.alertMember);
  const renameMember = useMutation(api.admin.renameMember);
  const editMemberProfile = useMutation(api.admin.editMemberProfile);
  const toggleFlair = useMutation(api.admin.toggleFlair);
  const setSuspended = useMutation(api.admin.setSuspended);
  const grantFollowers = useMutation(api.admin.grantFollowers);
  const deleteMember = useMutation(api.admin.deleteMember);
  const deletePost = useMutation(api.admin.deletePost);
  const togglePin = useMutation(api.admin.togglePin);
  const purgeReplies = useMutation(api.admin.purgeReplies);
  const wipeFeed = useMutation(api.admin.wipeFeed);
  const toggleTopicLock = useMutation(api.admin.toggleTopicLock);
  const setReadOnly = useMutation(api.admin.setReadOnly);
  const setSlowMode = useMutation(api.admin.setSlowMode);
  const setChaos = useMutation(api.admin.setChaos);
  const massLike = useMutation(api.admin.massLike);
  const triggerShrekBomb = useMutation(api.admin.triggerShrekBomb);
  const cancelShrekBomb = useMutation(api.admin.cancelShrekBomb);
  const setUpsideDown = useMutation(api.admin.setUpsideDown);
  const renameEveryone = useMutation(api.admin.renameEveryone);

  useEffect(() => {
    if (!token) return;
    if (overview === null) {
      writeToken("");
      setToken("");
      setGateMessage("Your admin session ended — unlock the console again.");
    }
  }, [token, overview]);

  useEffect(() => {
    if (!overview) return;
    setSlowDraft(overview.settings.slowModeSeconds);
  }, [overview?.settings.slowModeSeconds]);

  const member: MemberRow | undefined = useMemo(
    () => overview?.members.find((row) => row.id === selectedMemberId),
    [overview?.members, selectedMemberId],
  );
  const post: PostRow | undefined = useMemo(
    () => overview?.posts.find((row) => row.id === selectedPostId),
    [overview?.posts, selectedPostId],
  );

  useEffect(() => {
    if (!member) return;
    setNameDraft(member.name);
    setRoleDraft(member.role);
    setBioDraft(member.bio);
  }, [member?.id]);

  const run = async (label: string, task: () => Promise<unknown>, success: string) => {
    setBusy(label);
    setFeedback(null);
    try {
      await task();
      setFeedback({ tone: "ok", text: success });
      onFlash(success);
    } catch (cause) {
      const message = messageOf(cause);
      if (message.toLowerCase().includes(SESSION_NOTE) || message.toLowerCase().includes("admin access")) {
        writeToken("");
        setToken("");
        setGateMessage(message);
      } else {
        setFeedback({ tone: "error", text: message });
      }
    } finally {
      setBusy("");
    }
  };

  const lockConsole = async () => {
    const current = token;
    writeToken("");
    setToken("");
    setGateMessage("Console locked. Unlock it again to continue.");
    if (current) {
      try {
        await lock({ token: current });
      } catch {
        /* the session is gone either way */
      }
    }
  };

  if (!token) {
    return (
      <UnlockGate
        onUnlocked={(value) => {
          writeToken(value);
          setGateMessage("");
          setToken(value);
        }}
        onExit={onExit}
        message={gateMessage}
      />
    );
  }

  if (overview === undefined) {
    return (
      <div className="cl-admin-loading">
        <RefreshCw size={18} className="cl-admin-spin" />
        Verifying admin session…
      </div>
    );
  }

  if (overview === null) {
    return (
      <UnlockGate
        onUnlocked={(value) => {
          writeToken(value);
          setGateMessage("");
          setToken(value);
        }}
        onExit={onExit}
        message={gateMessage || "Your admin session ended — unlock the console again."}
      />
    );
  }

  const settings = overview.settings;
  const filteredMembers = overview.members.filter((row) => {
    const needle = memberSearch.trim().toLowerCase();
    if (!needle) return true;
    return `${row.name} ${row.handle} ${row.role}`.toLowerCase().includes(needle);
  });
  const lockedTopics = new Set(settings.lockedTopics.map((topic) => topic.toLowerCase()));

  return (
    <div className="cl-admin">
      <header className="cl-admin-header">
        <div>
          <span className="cl-eyebrow"><span className="cl-eyebrow-dot" /> STAFF CONSOLE <span className="cl-eyebrow-separator" /> {overview.admin.allowList.join(" · ")}</span>
          <h1>Admin control room.</h1>
          <p>
            Signed in as <strong>{overview.admin.name}</strong> (@{overview.admin.username}).
            Every request below re-verifies your account against the allow-list and this
            session token on the server.
          </p>
        </div>
        <div className="cl-admin-header-actions">
          <span className="cl-admin-session"><LockKeyhole size={13} /> Session until {stamp(overview.admin.expiresAt)}</span>
          <button type="button" className="cl-button cl-button-secondary" onClick={() => void lockConsole()}>
            <Lock size={14} /> Lock console
          </button>
          <button type="button" className="cl-button cl-button-secondary" onClick={onExit}>Exit</button>
        </div>
      </header>

      <div className="cl-admin-stats">
        <div><strong>{overview.stats.members}</strong><span>Members</span></div>
        <div><strong>{overview.stats.posts}</strong><span>Updates</span></div>
        <div><strong>{overview.stats.pinned}</strong><span>Pinned</span></div>
        <div><strong>{overview.stats.verified}</strong><span>Verified</span></div>
        <div><strong>{overview.stats.suspended}</strong><span>Suspended</span></div>
        <div><strong>{settings.slowModeSeconds ? `${settings.slowModeSeconds}s` : "off"}</strong><span>Slow mode</span></div>
      </div>

      <section className="cl-admin-capabilities">
        <div className="cl-admin-capabilities-head">
          <span className="cl-section-label">{FEATURES.length} FEATURES ARMED</span>
          <span className="cl-admin-capabilities-note">Announcements · moderation · network switches · trolls</span>
        </div>
        <div className="cl-admin-chip-grid">
          {FEATURES.map((feature, index) => (
            <span className="cl-admin-chip" key={feature}>
              <em>{String(index + 1).padStart(2, "0")}</em>{feature}
            </span>
          ))}
        </div>
      </section>

      {feedback && (
        <div className={`cl-admin-feedback is-${feedback.tone}`} role="status">
          {feedback.tone === "error" ? <AlertTriangle size={14} /> : <BadgeCheck size={14} />}
          {feedback.text}
        </div>
      )}

      <section className="cl-admin-network">
        <div className="cl-admin-network-title">
          <span className="cl-section-label">LIVE NETWORK STATE</span>
          <span className="cl-admin-network-id">viewer {viewerName}</span>
        </div>
        <div className="cl-admin-network-flags">
          <span className={settings.readOnly ? "is-on" : ""}><Snowflake size={13} /> Frozen <MiniToggle on={settings.readOnly} /></span>
          <span className={settings.chaos ? "is-on" : ""}><Shuffle size={13} /> Chaos <MiniToggle on={settings.chaos} /></span>
          <span className={settings.upsideDown ? "is-on" : ""}><Ghost size={13} /> Upside-down <MiniToggle on={settings.upsideDown} /></span>
          <span className={settings.announcement ? "is-on" : ""}><Megaphone size={13} /> Announcement <MiniToggle on={Boolean(settings.announcement)} /></span>
          <span className={settings.shrekBomb ? "is-on" : ""}><TriangleAlert size={13} /> Hamburbur <MiniToggle on={Boolean(settings.shrekBomb)} /></span>
          <span className={settings.lockedTopics.length ? "is-on" : ""}><Lock size={13} /> {settings.lockedTopics.length} locked topic{settings.lockedTopics.length === 1 ? "" : "s"}</span>
        </div>
      </section>

      <div className="cl-admin-section-title"><Megaphone size={15} /><span>Broadcast</span></div>
      <div className="cl-admin-grid">
        <FeatureCard index={1} title="Global announcement" icon={<Megaphone size={16} />} description="Pin a banner to the top of every member's stream. Party mode also fires confetti for everyone online.">
          <div className="cl-admin-form">
            <label className="cl-field"><span>Title</span><input value={annTitle} onChange={(event) => setAnnTitle(event.target.value)} maxLength={90} placeholder="Scheduled maintenance tonight" /></label>
            <label className="cl-field"><span>Message</span><textarea value={annBody} onChange={(event) => setAnnBody(event.target.value)} maxLength={400} rows={2} placeholder="The network will slow down for a bit at 9pm." /></label>
            <div className="cl-admin-inline">
              <label className="cl-field"><span>Mood</span>
                <select value={annMood} onChange={(event) => setAnnMood(event.target.value as typeof annMood)}>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="party">Party</option>
                </select>
              </label>
              <label className="cl-admin-check">
                <input type="checkbox" checked={annParty} onChange={(event) => setAnnParty(event.target.checked)} />
                <span>Fire confetti everywhere</span>
              </label>
            </div>
            <div className="cl-admin-actions">
              <button
                type="button"
                className="cl-button cl-button-primary"
                disabled={busy !== "" || annTitle.trim().length < 2 || annBody.trim().length < 2}
                onClick={() => void run("announce", () => setAnnouncement({ token, title: annTitle, body: annBody, mood: annMood, party: annParty }), "Announcement is live for everyone.")}
              >
                {busy === "announce" ? "Publishing…" : "Publish announcement"}
              </button>
              <button
                type="button"
                className="cl-button cl-button-secondary"
                disabled={busy !== "" || !settings.announcement}
                onClick={() => void run("clear-ann", () => clearAnnouncement({ token }), "Announcement taken down.")}
              >
                Take down
              </button>
            </div>
            {settings.announcement && (
              <p className="cl-admin-hint">Live now: “{settings.announcement.title}” · {stamp(settings.announcement.createdAt)}</p>
            )}
          </div>
        </FeatureCard>

        <FeatureCard index={2} title="Direct member alert" icon={<BellRing size={16} />} description="Drop a system notification straight into one member's activity drawer.">
          <p className="cl-admin-target">
            {member ? <>Target: <strong>{member.name}</strong> <span>@{member.handle}</span></> : "Pick a member from the directory below first."}
          </p>
          <div className="cl-admin-form">
            <label className="cl-field"><span>Title</span><input value={alertTitle} onChange={(event) => setAlertTitle(event.target.value)} maxLength={80} placeholder="A word from the staff" /></label>
            <label className="cl-field"><span>Message</span><textarea value={alertBody} onChange={(event) => setAlertBody(event.target.value)} maxLength={400} rows={2} placeholder="Your profile just got promoted on the front page." /></label>
            <div className="cl-admin-actions">
              <button
                type="button"
                className="cl-button cl-button-primary"
                disabled={busy !== "" || !member || alertTitle.trim().length < 2 || alertBody.trim().length < 2}
                onClick={() => {
                  if (!member) return;
                  void run("alert", () => alertMember({ token, targetId: member.id as Id<"users">, title: alertTitle, body: alertBody }), `Alert delivered to ${member.name}.`);
                }}
              >
                {busy === "alert" ? "Sending…" : "Send alert"}
              </button>
            </div>
          </div>
        </FeatureCard>
      </div>

      <div className="cl-admin-section-title"><UserRoundPen size={15} /><span>Member management</span><em>{overview.members.length} members</em></div>
      <section className="cl-admin-directory">
        <label className="cl-directory-search cl-admin-search">
          <Search size={15} />
          <input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Search members by name, handle or role" aria-label="Search members" />
        </label>
        <div className="cl-admin-member-list">
          {filteredMembers.length === 0 && <p className="cl-admin-hint">No members match that search.</p>}
          {filteredMembers.map((row) => (
            <button
              key={row.id}
              type="button"
              className={`cl-admin-member ${row.id === selectedMemberId ? "is-selected" : ""}`}
              onClick={() => setSelectedMemberId(row.id)}
            >
              <span className="cl-admin-member-avatar" style={{ background: row.avatar }}>{row.name.slice(0, 2).toUpperCase()}</span>
              <span className="cl-admin-member-copy">
                <strong>{row.name}{row.verified && <BadgeCheck size={12} className="cl-verified-icon" />}</strong>
                <small>@{row.handle || "no-handle"}{row.role ? ` · ${row.role}` : ""}</small>
              </span>
              {row.suspended && <span className="cl-admin-tag is-danger">Suspended</span>}
            </button>
          ))}
        </div>
      </section>

      <div className="cl-admin-grid">
        <FeatureCard index={3} title="Rename member" icon={<UserRoundPen size={16} />} description="Change the display name that appears everywhere this member posts." danger>
          <div className="cl-admin-form">
            <label className="cl-field"><span>New display name</span><input value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} maxLength={80} disabled={!member} placeholder="Pick a member first" /></label>
            <button
              type="button"
              className="cl-button cl-button-primary"
              disabled={busy !== "" || !member || nameDraft.trim().length < 2}
              onClick={() => {
                if (!member) return;
                void run("rename", () => renameMember({ token, targetId: member.id as Id<"users">, name: nameDraft }), `Renamed ${member.name} to ${nameDraft.trim()}.`);
              }}
            >
              {busy === "rename" ? "Renaming…" : "Save name"}
            </button>
          </div>
        </FeatureCard>

        <FeatureCard index={4} title="Rewrite role & bio" icon={<Wand2 size={16} />} description="Rewrite any member's headline and short introduction. Yes, they will notice." danger>
          <div className="cl-admin-form">
            <label className="cl-field"><span>Role</span><input value={roleDraft} onChange={(event) => setRoleDraft(event.target.value)} maxLength={80} disabled={!member} /></label>
            <label className="cl-field"><span>Bio</span><textarea value={bioDraft} onChange={(event) => setBioDraft(event.target.value)} maxLength={280} rows={2} disabled={!member} /></label>
            <button
              type="button"
              className="cl-button cl-button-primary"
              disabled={busy !== "" || !member}
              onClick={() => {
                if (!member) return;
                void run("profile", () => editMemberProfile({ token, targetId: member.id as Id<"users">, role: roleDraft, bio: bioDraft }), `Rewrote ${member.name}'s profile.`);
              }}
            >
              {busy === "profile" ? "Saving…" : "Overwrite profile"}
            </button>
          </div>
        </FeatureCard>

        <FeatureCard index={5} title="Verified flair" icon={<BadgeCheck size={16} />} description="Hand out (or strip) the verified badge beside a member's name.">
          <p className="cl-admin-target">
            {member ? <>{member.name} is currently <strong>{member.verified ? "verified" : "unverified"}</strong>.</> : "Pick a member to toggle their flair."}
          </p>
          <button
            type="button"
            className="cl-button cl-button-secondary"
            disabled={busy !== "" || !member}
            onClick={() => {
              if (!member) return;
              void run("flair", () => toggleFlair({ token, targetId: member.id as Id<"users"> }), `Flair ${member.verified ? "removed" : "granted"} for ${member.name}.`);
            }}
          >
            {member?.verified ? <><Ban size={14} /> Remove flair</> : <><BadgeCheck size={14} /> Grant flair</>}
          </button>
        </FeatureCard>

        <FeatureCard index={6} title="Suspend / reinstate" icon={<Ban size={16} />} description="Suspended members cannot post, reply, like, bookmark or follow until you let them back in." danger>
          <p className="cl-admin-target">
            {member ? <>{member.name} is <strong>{member.suspended ? "suspended" : "active"}</strong>.</> : "Pick a member to change their access."}
          </p>
          <button
            type="button"
            className="cl-button cl-button-secondary"
            disabled={busy !== "" || !member}
            onClick={() => {
              if (!member) return;
              void run("suspend", () => setSuspended({ token, targetId: member.id as Id<"users">, suspended: !member.suspended }), `${member.name} is now ${member.suspended ? "reinstated" : "suspended"}.`);
            }}
          >
            {member?.suspended ? "Reinstate member" : "Suspend member"}
          </button>
        </FeatureCard>

        <FeatureCard index={7} title="Inject followers" icon={<UserPlus size={16} />} description="Quietly attach existing members as followers of the selected account. Pure vanity, zero consent." danger>
          <div className="cl-admin-inline">
            <label className="cl-field"><span>How many</span><input type="number" min={1} max={100} value={followerCount} onChange={(event) => setFollowerCount(Number(event.target.value))} /></label>
            <button
              type="button"
              className="cl-button cl-button-primary"
              disabled={busy !== "" || !member}
              onClick={() => {
                if (!member) return;
                void run("followers", () => grantFollowers({ token, targetId: member.id as Id<"users">, count: followerCount }), `Followers delivered to ${member.name}.`);
              }}
            >
              {busy === "followers" ? "Injecting…" : "Inject followers"}
            </button>
          </div>
        </FeatureCard>

        <FeatureCard index={8} title="Delete member" icon={<Trash2 size={16} />} description="Nuke an account and everything it owns: updates, replies, likes, bookmarks, follows and notifications." danger>
          <p className="cl-admin-target">
            {member ? <>This cannot be undone for <strong>{member.name}</strong>.</> : "Pick a member to delete."}
          </p>
          <button
            type="button"
            className="cl-button cl-admin-danger-button"
            disabled={busy !== "" || !member}
            onClick={() => {
              if (!member) return;
              if (!window.confirm(`Delete ${member.name} (@${member.handle}) and all of their content? This cannot be undone.`)) return;
              void run("delete-member", () => deleteMember({ token, targetId: member.id as Id<"users"> }), `${member.name} was deleted.`);
            }}
          >
            {busy === "delete-member" ? "Deleting…" : <><Trash2 size={14} /> Delete member</>}
          </button>
        </FeatureCard>
      </div>

      <div className="cl-admin-section-title"><Eraser size={15} /><span>Stream moderation</span></div>
      <section className="cl-admin-directory">
        <div className="cl-admin-post-list">
          {overview.posts.length === 0 && <p className="cl-admin-hint">No updates in the stream.</p>}
          {overview.posts.map((row) => (
            <button
              key={row.id}
              type="button"
              className={`cl-admin-post ${row.id === selectedPostId ? "is-selected" : ""}`}
              onClick={() => setSelectedPostId(row.id)}
            >
              <span className="cl-admin-post-meta">
                <strong>{row.authorName}</strong> @{row.authorHandle} · #{row.topic} · {row.likes} likes · {row.comments} replies
                {row.pinned && <span className="cl-admin-tag">Pinned</span>}
              </span>
              <span className="cl-admin-post-body">{row.body}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="cl-admin-grid">
        <FeatureCard index={9} title="Delete any update" icon={<Trash2 size={16} />} description="Remove any update, with its replies, likes, bookmarks and notifications." danger>
          <p className="cl-admin-target">{post ? <>Selected: “{post.body.slice(0, 80)}”</> : "Pick an update from the list above."}</p>
          <button
            type="button"
            className="cl-button cl-admin-danger-button"
            disabled={busy !== "" || !post}
            onClick={() => {
              if (!post) return;
              if (!window.confirm("Delete this update and every reply, like and bookmark attached to it?")) return;
              void run("delete-post", () => deletePost({ token, postId: post.id as Id<"posts"> }), "Update deleted.");
            }}
          >
            <Trash2 size={14} /> Delete update
          </button>
        </FeatureCard>

        <FeatureCard index={10} title="Pin update" icon={<Pin size={16} />} description="Float an update to the very top of every member's feed until you unpin it.">
          <button
            type="button"
            className="cl-button cl-button-secondary"
            disabled={busy !== "" || !post}
            onClick={() => {
              if (!post) return;
              void run("pin", () => togglePin({ token, postId: post.id as Id<"posts"> }), post.pinned ? "Update unpinned." : "Update pinned to the top of the feed.");
            }}
          >
            {post?.pinned ? <><PinOff size={14} /> Unpin update</> : <><Pin size={14} /> Pin update</>}
          </button>
        </FeatureCard>

        <FeatureCard index={11} title="Purge replies" icon={<MessageSquareX size={16} />} description="Wipe every reply on the selected update in one go, keeping the update itself." danger>
          <button
            type="button"
            className="cl-button cl-button-secondary"
            disabled={busy !== "" || !post}
            onClick={() => {
              if (!post) return;
              if (!window.confirm(`Delete all ${post.comments} replies on this update?`)) return;
              void run("purge", () => purgeReplies({ token, postId: post.id as Id<"posts"> }), "Replies purged.");
            }}
          >
            <MessageSquareX size={14} /> Purge {post ? post.comments : 0} replies
          </button>
        </FeatureCard>

        <FeatureCard index={12} title="Wipe the feed" icon={<Hammer size={16} />} description="Delete every update on the network at once. Accounts survive; the stream does not." danger>
          <button
            type="button"
            className="cl-button cl-admin-danger-button"
            disabled={busy !== ""}
            onClick={() => {
              if (!window.confirm(`Delete all ${overview.stats.posts} updates across Commonline? This cannot be undone.`)) return;
              void run("wipe", () => wipeFeed({ token }), "The feed was wiped.");
            }}
          >
            {busy === "wipe" ? "Wiping…" : <><Eraser size={14} /> Wipe every update</>}
          </button>
        </FeatureCard>

        <FeatureCard index={13} title="Topic locks" icon={<Lock size={16} />} description="Lock a topic so nobody can post into it until you unlock it again.">
          <div className="cl-admin-inline">
            <label className="cl-field"><span>Topic</span><input value={topicInput} onChange={(event) => setTopicInput(event.target.value)} maxLength={40} placeholder="General" /></label>
            <button
              type="button"
              className="cl-button cl-button-secondary"
              disabled={busy !== "" || !topicInput.trim()}
              onClick={() => {
                const topic = topicInput.trim();
                void run("topic", () => toggleTopicLock({ token, topic }), `#${topic} toggled.`);
              }}
            >
              <Lock size={14} /> Toggle lock
            </button>
          </div>
          <div className="cl-admin-topic-row">
            {overview.topics.map((topic) => (
              <button
                key={topic.name}
                type="button"
                className={`cl-admin-topic ${lockedTopics.has(topic.name.toLowerCase()) ? "is-locked" : ""}`}
                onClick={() => void run("topic", () => toggleTopicLock({ token, topic: topic.name }), `#${topic.name} toggled.`)}
                disabled={busy !== ""}
              >
                {lockedTopics.has(topic.name.toLowerCase()) ? <Lock size={11} /> : null}#{topic.name} <em>{topic.count}</em>
              </button>
            ))}
            {overview.topics.length === 0 && <p className="cl-admin-hint">No topics yet.</p>}
          </div>
          {settings.lockedTopics.length > 0 && (
            <p className="cl-admin-hint">Locked: {settings.lockedTopics.map((topic) => `#${topic}`).join(", ")}</p>
          )}
        </FeatureCard>
      </div>

      <div className="cl-admin-section-title"><Timer size={15} /><span>Network switches</span></div>
      <div className="cl-admin-grid">
        <FeatureCard index={14} title="Freeze network" icon={<Snowflake size={16} />} description="Read-only mode. Every member can browse, but posting, replying, liking, saving and following are blocked server-side.">
          <p className="cl-admin-target">Currently <strong>{settings.readOnly ? "frozen" : "open for business"}</strong>.</p>
          <button
            type="button"
            className={`cl-button ${settings.readOnly ? "cl-button-primary" : "cl-button-secondary"}`}
            disabled={busy !== ""}
            onClick={() => void run("freeze", () => setReadOnly({ token, value: !settings.readOnly }), settings.readOnly ? "Network thawed." : "Network frozen.")}
          >
            <Snowflake size={14} /> {settings.readOnly ? "Thaw network" : "Freeze network"}
          </button>
        </FeatureCard>

        <FeatureCard index={15} title="Slow mode" icon={<Timer size={16} />} description="Force a cooldown between every member's posts and replies.">
          <div className="cl-admin-inline">
            <label className="cl-field"><span>Cooldown (seconds)</span><input type="number" min={0} max={600} value={slowDraft} onChange={(event) => setSlowDraft(Number(event.target.value))} /></label>
            <button
              type="button"
              className="cl-button cl-button-primary"
              disabled={busy !== ""}
              onClick={() => void run("slow", () => setSlowMode({ token, seconds: Number(slowDraft) }), slowDraft > 0 ? `Slow mode set to ${slowDraft}s.` : "Slow mode disabled.")}
            >
              Save cooldown
            </button>
          </div>
          <p className="cl-admin-hint">0 disables slow mode. Members see a countdown when they try to post too soon.</p>
        </FeatureCard>

        <FeatureCard index={16} title="Chaos shuffle" icon={<Shuffle size={16} />} description="Reshuffle everybody's feed every minute. Nobody's timeline means anything while this is on.">
          <p className="cl-admin-target">Chaos is <strong>{settings.chaos ? "on" : "off"}</strong>.</p>
          <button
            type="button"
            className="cl-button cl-button-secondary"
            disabled={busy !== ""}
            onClick={() => void run("chaos", () => setChaos({ token, value: !settings.chaos }), settings.chaos ? "Feed order restored." : "Chaos shuffle enabled.")}
          >
            <Shuffle size={14} /> {settings.chaos ? "Restore order" : "Unleash chaos"}
          </button>
        </FeatureCard>
      </div>

      <div className="cl-admin-section-title"><TriangleAlert size={15} /><span>Troll cabinet</span></div>
      <div className="cl-admin-grid">
        <FeatureCard index={17} title="Mass-like" icon={<Heart size={16} />} description="Pump hundreds of likes onto any update using real member accounts." danger>
          <div className="cl-admin-inline">
            <label className="cl-field"><span>Likes to add</span><input type="number" min={1} max={250} value={likeCount} onChange={(event) => setLikeCount(Number(event.target.value))} /></label>
            <button
              type="button"
              className="cl-button cl-button-primary"
              disabled={busy !== "" || !post}
              onClick={() => {
                if (!post) return;
                void run("mass-like", () => massLike({ token, postId: post.id as Id<"posts">, count: likeCount }), "Likes pumped.");
              }}
            >
              <Heart size={14} /> Inflate likes
            </button>
          </div>
          {!post && <p className="cl-admin-hint">Select an update above first.</p>}
        </FeatureCard>

        <FeatureCard index={18} title="Hamburbur bomb" icon={<Ghost size={16} />} description="Take over every screen with the cursed portrait and your message for a set number of seconds." danger>
          <div className="cl-admin-form">
            <label className="cl-field"><span>Overlay message</span><input value={bombMessage} onChange={(event) => setBombMessage(event.target.value)} maxLength={120} /></label>
            <div className="cl-admin-inline">
              <label className="cl-field"><span>Duration (seconds)</span><input type="number" min={5} max={600} value={bombSeconds} onChange={(event) => setBombSeconds(Number(event.target.value))} /></label>
              <button
                type="button"
                className="cl-button cl-button-primary"
                disabled={busy !== ""}
                onClick={() => void run("bomb", () => triggerShrekBomb({ token, message: bombMessage, durationSeconds: Number(bombSeconds) }), "Hamburbur deployed across the network.")}
              >
                <Ghost size={14} /> Drop hamburbur
              </button>
            </div>
            <button
              type="button"
              className="cl-button cl-button-secondary"
              disabled={busy !== "" || !settings.shrekBomb}
              onClick={() => void run("bomb-cancel", () => cancelShrekBomb({ token }), "Hamburbur called off.")}
            >
              Cancel it
            </button>
            <img className="cl-admin-bomb-preview" src={SHREK_URL} alt="The hamburbur portrait preview" loading="lazy" />
          </div>
        </FeatureCard>

        <FeatureCard index={19} title="Upside-down mode" icon={<RefreshCw size={16} />} description="Rotate the entire interface 180° for everyone. Buttons still work; dignity does not." danger>
          <p className="cl-admin-target">Interface is <strong>{settings.upsideDown ? "upside down" : "upright"}</strong>.</p>
          <button
            type="button"
            className="cl-button cl-button-secondary"
            disabled={busy !== ""}
            onClick={() => void run("flip", () => setUpsideDown({ token, value: !settings.upsideDown }), settings.upsideDown ? "Network turned back upright." : "Everyone is now upside down.")}
          >
            <RefreshCw size={14} /> {settings.upsideDown ? "Turn upright" : "Flip everyone"}
          </button>
        </FeatureCard>

        <FeatureCard index={20} title="The Great Renaming" icon={<Hammer size={16} />} description="Rename every single member to “hamburbur”. No exceptions, no undo button." danger>
          <button
            type="button"
            className="cl-button cl-admin-danger-button"
            disabled={busy !== ""}
            onClick={() => {
              if (!window.confirm("Rename every member on Commonline to “hamburbur”? This is a one-way trip.")) return;
              void run("rename-all", () => renameEveryone({ token }), "Everyone is hamburbur now.");
            }}
          >
            {busy === "rename-all" ? "Renaming…" : "Rename everyone"}
          </button>
        </FeatureCard>
      </div>

      <section className="cl-admin-log">
        <div className="cl-admin-log-head">
          <span className="cl-section-label">AUDIT TRAIL</span>
          <span className="cl-admin-hint">Every admin action is logged with the acting account.</span>
        </div>
        {overview.log.length === 0 && <p className="cl-admin-hint">No admin actions yet.</p>}
        <ul>
          {overview.log.map((entry) => (
            <li key={entry.id}>
              <span className={`cl-admin-log-dot ${/delete|wipe|suspend|bomb|renaming|flip/i.test(entry.action) ? "is-danger" : ""}`} />
              <span className="cl-admin-log-actor">@{entry.actor}</span>
              <span className="cl-admin-log-detail">{entry.detail}</span>
              <span className="cl-admin-log-time">{stamp(entry.createdAt)}</span>
            </li>
          ))}
        </ul>
      </section>

      <figure className="cl-admin-shrek">
        <img src={SHREK_URL} alt="A cursed portrait of Shrek fused with Harvey" loading="lazy" />
        <figcaption>
          <strong>hamburbur</strong>
          <span><Info size={11} /> Mandatory staff morale imagery.</span>
        </figcaption>
      </figure>
    </div>
  );
}
