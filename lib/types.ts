export type Rank = "D" | "C" | "B" | "A" | "S";

export type MissionStatus = "Completed" | "Failed" | "Ongoing" | "Classified";

export type Article = {
  objectID: string;
  slug: string;
  missionId: string;
  title: string;
  excerpt: string;
  body: string[];
  author: string;
  authorSlug: string;
  rank: Rank;
  topics: string[];
  year: number;
  month: number;
  day: number;
  publishedAt: number;
  era: string;
  location: string;
  feeRyo: number;
  status: MissionStatus;
  classified: boolean;
  featured: boolean;
};

export type SearchRecord = Omit<Article, "body">;

export type Author = {
  slug: string;
  name: string;
  title: string;
  tenure: string;
  bio: string;
  beat: string;
};
