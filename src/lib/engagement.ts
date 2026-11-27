import type { Post } from "../types";

export const DAILY_ACTION_TARGET = 3;

export type Tier = {
  name: string;
  minXp: number;
  accent: string;
};

export const TIERS: Tier[] = [
  { name: "Observer", minXp: 0, accent: "#6d887c" },
  { name: "Signal", minXp: 60, accent: "#1d6253" },
  { name: "Contributor", minXp: 160, accent: "#227863" },
  { name: "Connector", minXp: 350, accent: "#b56a42" },
  { name: "Catalyst", minXp: 650, accent: "#9e4d3a" },
  { name: "Luminary", minXp: 1100, accent: "#c58a2d" },
];

export type EngagementAction = "like" | "reply" | "post" | "save" | "follow" | "read";

export type DailyQuest = {
  id: string;
  action: EngagementAction;
  title: string;
  target: number;
  rewardXp: number;
};

export type DailyPrompt = {
  question: string;
  topic: string;
  starter: string;
};

const QUEST_POOL: DailyQuest[] = [
  { id: "like-2", action: "like", title: "Like 2 updates that catch your eye", target: 2, rewardXp: 15 },
  { id: "reply-1", action: "reply", title: "Drop a reply in any active thread", target: 1, rewardXp: 15 },
  { id: "save-1", action: "save", title: "Save 1 sharp idea to your vault", target: 1, rewardXp: 15 },
  { id: "read-3", action: "read", title: "Read 3 updates in the stream", target: 3, rewardXp: 15 },
  { id: "follow-1", action: "follow", title: "Follow 1 new person in the network", target: 1, rewardXp: 15 },
  { id: "post-1", action: "post", title: "Share a thought, link, or question", target: 1, rewardXp: 20 },
];

const DAILY_PROMPTS: DailyPrompt[] = [
  {
    question: "What’s one tool, habit, or shortcut that saved you real time this week?",
    topic: "Resources",
    starter: "Something that saved me hours recently: ",
  },
  {
    question: "What’s an idea you changed your mind about over the last year?",
    topic: "General",
    starter: "I used to think ",
  },
  {
    question: "What are you quietly building right now that deserves more eyes?",
    topic: "Projects",
    starter: "Currently working on ",
  },
  {
    question: "What’s the most underrated question in your field right now?",
    topic: "Questions",
    starter: "A question I keep coming back to: ",
  },
  {
    question: "Share one small win from the last 48 hours.",
    topic: "Field notes",
    starter: "Small win today: ",
  },
  {
    question: "What’s one article, paper, or rabbit hole you couldn’t stop thinking about?",
    topic: "Research",
    starter: "Still thinking about this: ",
  },
  {
    question: "If you could pair with someone here for an hour this week, what would you tackle?",
    topic: "Opportunities",
    starter: "Would love to compare notes on ",
  },
  {
    question: "What’s a mistake that taught you something permanently useful?",
    topic: "Field notes",
    starter: "Lesson learned the hard way: ",
  },
  {
    question: "What’s one contrarian take you actually stand behind?",
    topic: "General",
    starter: "Unpopular opinion I stand by: ",
  },
  {
    question: "Drop a resource you wish someone had handed you six months ago.",
    topic: "Resources",
    starter: "Wish I had found this sooner: ",
  },
];

export type EngagementState = {
  xp: number;
  streak: number;
  longestStreak: number;
  lastActiveDay: string | null;
  todayKey: string;
  todayActions: number;
  streakLockedToday: boolean;
  activeDays: string[];
  weekKey: string;
  readPostIds: string[];
  topicAffinity: Record<string, number>;
  authorAffinity: Record<string, number>;
  lastVisitAt: number;
  totalLikes: number;
  totalReplies: number;
  totalPosts: number;
  dismissedProfileNudge: boolean;
  todayQuestCounts: Record<EngagementAction, number>;
  completedQuestIds: string[];
  allQuestsBonusClaimed: boolean;
};

export type ActionOutcome = {
  state: EngagementState;
  xpEarned: number;
  combo: number;
  streakJustLocked: boolean;
  tierUp: Tier | null;
  weeklyGoalJustHit: boolean;
  questCompleted: DailyQuest | null;
  allQuestsSweep: boolean;
};

export function localDayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function localWeekKey(date = new Date()): string {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay();
  const diff = (day + 6) % 7;
  copy.setDate(copy.getDate() - diff);
  return localDayKey(copy);
}

function dayOffsetKey(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return localDayKey(d);
}

function dayNumber(dayKey: string): number {
  let n = 0;
  for (let i = 0; i < dayKey.length; i += 1) {
    n = (n * 31 + dayKey.charCodeAt(i)) >>> 0;
  }
  return n;
}

export function getDailyQuests(todayKey: string): DailyQuest[] {
  const seed = dayNumber(todayKey);
  // Always include 1 low-friction consumption/reaction quest + 2 varied engagement quests
  const first = QUEST_POOL[seed % 2 === 0 ? 0 : 3]; // like-2 or read-3
  const remaining = QUEST_POOL.filter((q) => q.id !== first.id);
  const second = remaining[seed % remaining.length];
  const rest = remaining.filter((q) => q.id !== second.id);
  const third = rest[(seed >> 2) % rest.length];
  return [first, second, third];
}

export function getDailyPrompt(todayKey: string): DailyPrompt {
  const seed = dayNumber(todayKey);
  return DAILY_PROMPTS[seed % DAILY_PROMPTS.length];
}

function emptyQuestCounts(): Record<EngagementAction, number> {
  return { like: 0, reply: 0, post: 0, save: 0, follow: 0, read: 0 };
}

function storageKey(userId: string) {
  return `commonline:engagement:v1:${userId}`;
}

function draftKey(userId: string) {
  return `commonline:draft:v1:${userId}`;
}

export function defaultEngagementState(): EngagementState {
  const today = localDayKey();
  return {
    xp: 0,
    streak: 0,
    longestStreak: 0,
    lastActiveDay: null,
    todayKey: today,
    todayActions: 0,
    streakLockedToday: false,
    activeDays: [],
    weekKey: localWeekKey(),
    readPostIds: [],
    topicAffinity: {},
    authorAffinity: {},
    lastVisitAt: Date.now(),
    totalLikes: 0,
    totalReplies: 0,
    totalPosts: 0,
    dismissedProfileNudge: false,
    todayQuestCounts: emptyQuestCounts(),
    completedQuestIds: [],
    allQuestsBonusClaimed: false,
  };
}

export function normalizeForToday(raw: EngagementState): EngagementState {
  const today = localDayKey();
  const yesterday = dayOffsetKey(1);
  const week = localWeekKey();
  let next: EngagementState = {
    ...raw,
    todayQuestCounts: { ...emptyQuestCounts(), ...(raw.todayQuestCounts ?? {}) },
    completedQuestIds: Array.isArray(raw.completedQuestIds) ? raw.completedQuestIds : [],
    allQuestsBonusClaimed: Boolean(raw.allQuestsBonusClaimed),
  };

  if (next.todayKey !== today) {
    const streakStillAlive = next.lastActiveDay === yesterday || next.lastActiveDay === today;
    next = {
      ...next,
      todayKey: today,
      todayActions: 0,
      streakLockedToday: false,
      streak: streakStillAlive ? next.streak : 0,
      todayQuestCounts: emptyQuestCounts(),
      completedQuestIds: [],
      allQuestsBonusClaimed: false,
    };
  }

  if (next.weekKey !== week) {
    next = {
      ...next,
      weekKey: week,
      readPostIds: [],
    };
  }

  return next;
}

export function loadEngagementState(userId: string): EngagementState {
  if (typeof window === "undefined") return defaultEngagementState();
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return defaultEngagementState();
    const parsed = JSON.parse(raw) as Partial<EngagementState>;
    const merged: EngagementState = { ...defaultEngagementState(), ...parsed };
    return normalizeForToday(merged);
  } catch {
    return defaultEngagementState();
  }
}

export function saveEngagementState(userId: string, state: EngagementState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    // ignore storage quota failures
  }
}

export function loadDraft(userId: string): { body: string; topic: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(draftKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { body?: string; topic?: string };
    if (!parsed.body?.trim()) return null;
    return { body: parsed.body, topic: parsed.topic || "General" };
  } catch {
    return null;
  }
}

export function saveDraft(userId: string, body: string, topic: string): void {
  if (typeof window === "undefined") return;
  try {
    if (!body.trim()) {
      window.localStorage.removeItem(draftKey(userId));
    } else {
      window.localStorage.setItem(draftKey(userId), JSON.stringify({ body, topic }));
    }
  } catch {
    // ignore storage errors
  }
}

export function getTierInfo(xp: number): {
  current: Tier;
  next: Tier | null;
  progress: number;
  xpToNext: number;
} {
  let idx = 0;
  for (let i = 0; i < TIERS.length; i += 1) {
    if (xp >= TIERS[i].minXp) idx = i;
  }
  const current = TIERS[idx];
  const next = TIERS[idx + 1] ?? null;
  if (!next) {
    return { current, next: null, progress: 1, xpToNext: 0 };
  }
  const span = Math.max(1, next.minXp - current.minXp);
  const progress = Math.min(1, Math.max(0, (xp - current.minXp) / span));
  return { current, next, progress, xpToNext: Math.max(0, next.minXp - xp) };
}

export function getLastSevenDays(activeDays: string[], todayKey: string): { key: string; label: string; active: boolean; isToday: boolean }[] {
  const activeSet = new Set(activeDays);
  const result = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = localDayKey(d);
    const label = d.toLocaleDateString(undefined, { weekday: "narrow" });
    result.push({
      key,
      label,
      active: activeSet.has(key),
      isToday: key === todayKey,
    });
  }
  return result;
}

const ACTION_XP: Record<EngagementAction, number> = {
  post: 25,
  reply: 15,
  follow: 10,
  like: 5,
  save: 5,
  read: 2,
};

export function recordEngagementAction(
  prevRaw: EngagementState,
  action: EngagementAction,
  meta: {
    topic?: string;
    authorId?: string;
    postId?: string;
    combo?: number;
    weeklyGoal?: number;
  } = {},
): ActionOutcome {
  const prev = normalizeForToday(prevRaw);
  const beforeTier = getTierInfo(prev.xp).current;
  const combo = Math.max(1, meta.combo ?? 1);

  if (action === "read" && meta.postId && prev.readPostIds.includes(meta.postId)) {
    return {
      state: prev,
      xpEarned: 0,
      combo: 1,
      streakJustLocked: false,
      tierUp: null,
      weeklyGoalJustHit: false,
      questCompleted: null,
      allQuestsSweep: false,
    };
  }

  const baseXp = ACTION_XP[action];
  const comboBonus = action === "like" && combo > 1 ? Math.min(10, (combo - 1) * 2) : 0;
  const xpEarned = baseXp + comboBonus;

  const nextReadIds =
    action === "read" && meta.postId
      ? [...prev.readPostIds.slice(-199), meta.postId]
      : prev.readPostIds;

  const weeklyGoal = meta.weeklyGoal ?? 8;
  const weeklyGoalJustHit =
    action === "read" &&
    prev.readPostIds.length < weeklyGoal &&
    nextReadIds.length >= weeklyGoal;

  const countsTowardDaily = action !== "read" || nextReadIds.length % 3 === 0;
  const nextTodayActions = prev.todayActions + (countsTowardDaily ? 1 : 0);

  // Daily micro-quest progress
  const nextQuestCounts: Record<EngagementAction, number> = {
    ...prev.todayQuestCounts,
    [action]: (prev.todayQuestCounts[action] ?? 0) + 1,
  };
  const dailyQuests = getDailyQuests(prev.todayKey);
  const nextCompletedQuests = [...prev.completedQuestIds];
  let questCompleted: DailyQuest | null = null;
  let questBonusXp = 0;

  for (const quest of dailyQuests) {
    if (!nextCompletedQuests.includes(quest.id) && (nextQuestCounts[quest.action] ?? 0) >= quest.target) {
      nextCompletedQuests.push(quest.id);
      questCompleted = quest;
      questBonusXp += quest.rewardXp;
    }
  }

  let allQuestsSweep = false;
  let nextAllQuestsBonus = prev.allQuestsBonusClaimed;
  if (!nextAllQuestsBonus && dailyQuests.every((q) => nextCompletedQuests.includes(q.id))) {
    allQuestsSweep = true;
    nextAllQuestsBonus = true;
    questBonusXp += 40;
  }

  let nextStreak = prev.streak;
  let nextLongest = prev.longestStreak;
  let nextLocked = prev.streakLockedToday;
  let nextLastActive = prev.lastActiveDay;
  let nextActiveDays = prev.activeDays;
  let streakJustLocked = false;

  if (!prev.streakLockedToday && nextTodayActions >= DAILY_ACTION_TARGET) {
    const yesterday = dayOffsetKey(1);
    nextStreak = prev.lastActiveDay === yesterday ? prev.streak + 1 : Math.max(1, prev.streak + (prev.lastActiveDay === prev.todayKey ? 0 : 1));
    nextLongest = Math.max(prev.longestStreak, nextStreak);
    nextLocked = true;
    nextLastActive = prev.todayKey;
    if (!prev.activeDays.includes(prev.todayKey)) {
      nextActiveDays = [...prev.activeDays.slice(-30), prev.todayKey];
    }
    streakJustLocked = true;
  }

  const nextTopicAffinity = { ...prev.topicAffinity };
  if (meta.topic) {
    const weight = action === "post" ? 4 : action === "reply" ? 3 : action === "save" ? 2.5 : action === "like" ? 2 : 0.6;
    nextTopicAffinity[meta.topic] = Math.min(50, (nextTopicAffinity[meta.topic] ?? 0) + weight);
  }

  const nextAuthorAffinity = { ...prev.authorAffinity };
  if (meta.authorId) {
    const weight = action === "follow" ? 5 : action === "reply" ? 3 : action === "like" ? 2 : 0.4;
    nextAuthorAffinity[meta.authorId] = Math.min(50, (nextAuthorAffinity[meta.authorId] ?? 0) + weight);
  }

  const bonusXp = (streakJustLocked ? 20 : 0) + (weeklyGoalJustHit ? 30 : 0) + questBonusXp;
  const nextXp = prev.xp + xpEarned + bonusXp;
  const afterTier = getTierInfo(nextXp).current;
  const tierUp = afterTier.minXp > beforeTier.minXp ? afterTier : null;

  const state: EngagementState = {
    ...prev,
    xp: nextXp,
    streak: nextStreak,
    longestStreak: nextLongest,
    lastActiveDay: nextLastActive,
    todayActions: nextTodayActions,
    streakLockedToday: nextLocked,
    activeDays: nextActiveDays,
    readPostIds: nextReadIds,
    topicAffinity: nextTopicAffinity,
    authorAffinity: nextAuthorAffinity,
    totalLikes: prev.totalLikes + (action === "like" ? 1 : 0),
    totalReplies: prev.totalReplies + (action === "reply" ? 1 : 0),
    totalPosts: prev.totalPosts + (action === "post" ? 1 : 0),
    todayQuestCounts: nextQuestCounts,
    completedQuestIds: nextCompletedQuests,
    allQuestsBonusClaimed: nextAllQuestsBonus,
  };

  return {
    state,
    xpEarned: xpEarned + bonusXp,
    combo,
    streakJustLocked,
    tierUp,
    weeklyGoalJustHit,
    questCompleted,
    allQuestsSweep,
  };
}

function hashSeed(str: string, sessionSalt: number): number {
  let h = sessionSalt | 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return ((h >>> 0) % 1000) / 1000;
}

export function rankPosts(
  posts: Post[],
  tab: "For You" | "Rising" | "Following" | "Latest",
  engagement: EngagementState,
  sessionSalt: number,
): Post[] {
  if (tab === "Latest" || tab === "Following") return posts;
  const now = Date.now();
  const readSet = new Set(engagement.readPostIds);

  return [...posts].sort((a, b) => {
    const ageHoursA = Math.max(0.25, (now - a.createdAt) / 3_600_000);
    const ageHoursB = Math.max(0.25, (now - b.createdAt) / 3_600_000);

    const engA = a.likes * 1.4 + a.commentCount * 3.2;
    const engB = b.likes * 1.4 + b.commentCount * 3.2;

    if (tab === "Rising") {
      const velA = (engA + 1) / Math.pow(ageHoursA + 1.5, 1.25);
      const velB = (engB + 1) / Math.pow(ageHoursB + 1.5, 1.25);
      return velB - velA;
    }

    const affinityA =
      (engagement.topicAffinity[a.topic] ?? 0) * 0.45 +
      (engagement.authorAffinity[a.author.id] ?? 0) * 0.55;
    const affinityB =
      (engagement.topicAffinity[b.topic] ?? 0) * 0.45 +
      (engagement.authorAffinity[b.author.id] ?? 0) * 0.55;

    const unseenA = readSet.has(a.id) ? 0 : 2.2;
    const unseenB = readSet.has(b.id) ? 0 : 2.2;

    const serendipityA = hashSeed(a.id, sessionSalt) * 1.8;
    const serendipityB = hashSeed(b.id, sessionSalt) * 1.8;

    const scoreA = (engA + 2 + affinityA + unseenA + serendipityA) / Math.pow(ageHoursA + 2, 0.85);
    const scoreB = (engB + 2 + affinityB + unseenB + serendipityB) / Math.pow(ageHoursB + 2, 0.85);

    return scoreB - scoreA;
  });
}

export function getRelatedPosts(post: Post, allPosts: Post[], limit = 2): Post[] {
  return allPosts
    .filter((candidate) => candidate.id !== post.id)
    .map((candidate) => {
      let score = 0;
      if (candidate.topic === post.topic) score += 5;
      if (candidate.author.id === post.author.id) score += 3;
      score += Math.min(4, candidate.likes * 0.5 + candidate.commentCount * 1.2);
      return { candidate, score };
    })
    .filter((entry) => entry.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

export function getWeeklyRecap(engagement: EngagementState, weeklyGoal: number) {
  const topics = Object.entries(engagement.topicAffinity).sort((a, b) => b[1] - a[1]);
  const topTopic = topics[0]?.[0] ?? "General";
  const tier = getTierInfo(engagement.xp);
  const reads = engagement.readPostIds.length;
  const readPct = Math.min(100, Math.round((reads / Math.max(1, weeklyGoal)) * 100));
  return {
    reads,
    weeklyGoal,
    readPct,
    likes: engagement.totalLikes,
    replies: engagement.totalReplies,
    posts: engagement.totalPosts,
    streak: engagement.streak,
    longestStreak: engagement.longestStreak,
    topTopic,
    tierName: tier.current.name,
    xp: engagement.xp,
  };
}

export function getTimeGreeting(name: string): string {
  const first = name.trim().split(/\s+/)[0] || name;
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${first}`;
  if (hour < 18) return `Good afternoon, ${first}`;
  return `Good evening, ${first}`;
}
