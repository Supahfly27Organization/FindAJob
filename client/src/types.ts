export interface PositionTitle {
  id: number;
  title: string;
  createdAt: string;
  postingCount: number;
}

export type PostingStatus = 'New' | 'Applied' | 'In Progress' | 'Rejected';

export interface Posting {
  id: number;
  positionTitleId: number | null;
  postingTitle: string;
  description: string | null;
  company: string | null;
  url: string;
  aggregatorName: string | null;
  aggregatorUrl: string | null;
  location: string | null;
  publishedDate: string | null;
  foundAt: string;
  viewed: boolean;
  status: PostingStatus;
  adaptedResumePath: string | null;
  appliedCvPath: string | null;
}
