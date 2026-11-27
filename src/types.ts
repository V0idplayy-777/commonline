export type Member = {
  id: string;
  name: string;
  handle: string;
  role: string;
  bio: string;
  avatar: string;
  verified?: boolean;
  followed: boolean;
};

export type Comment = {
  id: string;
  body: string;
  createdAt: number;
  name: string;
  handle: string;
  initials: string;
  avatar: string;
};

export type Post = {
  id: string;
  body: string;
  topic: string;
  createdAt: number;
  likes: number;
  liked: boolean;
  saved: boolean;
  commentCount: number;
  pinned?: boolean;
  author: Omit<Member, "bio" | "followed">;
  comments: Comment[];
};

export type Topic = { name: string; count: number };

export type NotificationItem = {
  id: string;
  kind: "reply" | "follow" | "system";
  actorName: string;
  actorHandle: string;
  postId?: string;
  postExcerpt: string;
  title?: string;
  message?: string;
  createdAt: number;
};

export type AnnouncementMood = "info" | "warning" | "party";

export type Announcement = {
  title: string;
  body: string;
  mood: AnnouncementMood;
  author: string;
  createdAt: number;
  burst: number;
};

export type ShrekBomb = {
  message: string;
  startedAt: number;
  expiresAt: number;
};

/** Network-wide switches an admin can flip. Read by every member's client. */
export type PublicState = {
  announcement: Announcement | null;
  readOnly: boolean;
  slowModeSeconds: number;
  chaos: boolean;
  upsideDown: boolean;
  lockedTopics: string[];
  shrekBomb: ShrekBomb | null;
};
