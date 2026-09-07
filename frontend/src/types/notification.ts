export interface Notification {
  id: number;
  title: string;
  message: string;
  category: string;
  priority: string;
  read: boolean;
  linkPath: string | null;
  relatedIssueId: number | null;
  relatedIssueNote: string | null;
  relatedStoreName: string | null;
  relatedIssueStatus: string | null;
  createdAt: string;
}
