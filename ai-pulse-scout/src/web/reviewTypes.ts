export interface ReviewFeedItem {
  itemKey: string;
  digestDate: string;
  publishedAt: string | null;
  title: string;
  excerpt: string;
  itemUrl: string | null;
  sourceName: string | null;
  topicTags: string[];
  matchScore: number;
  rating: number | null;
  followUp: boolean;
}
