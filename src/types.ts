export type Member = {
  id: string;
  name: string;
  handle: string;
  role: string;
  bio: string;
  avatar: string;
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
  author: Omit<Member, "bio" | "followed">;
  comments: Comment[];
};

export type Topic = { name: string; count: number };

export type NotificationItem = {
  id: string;
  kind: "reply" | "follow";
  actorName: string;
  actorHandle: string;
  postId?: string;
  postExcerpt: string;
  createdAt: number;
};
