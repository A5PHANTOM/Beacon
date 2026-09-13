export type HistoryChange = { fieldChanged: string; oldValue?: string | null; newValue?: string | null };

// Production mutations call this within the same Prisma transaction as the issue update.
export async function writeIssueHistory(
  tx: { issueHistory: { create: (args: { data: { issueId: string; userId: string; fieldChanged: string; oldValue?: string | null; newValue?: string | null } }) => Promise<unknown> } },
  issueId: string,
  userId: string,
  change: HistoryChange,
) {
  return tx.issueHistory.create({ data: { issueId, userId, ...change } });
}
