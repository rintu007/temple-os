export interface PostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  authorName: string | null;
  status: 'draft' | 'published';
  publishedAt: Date | null;
  createdAt: Date;
}

export interface PostDetail extends PostSummary {
  body: string;
}
