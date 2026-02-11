export type SudoUserRow = {
  id: string;
  username: string;
  email: string | null;
  createdAt: Date;
  lastEntryAt: Date | null;
  categoriesCount: number;
  entriesCount: number;
};

export type SudoOverview = {
  totals: {
    users: number;
    usersWithEntries: number;
    categories: number;
    entries: number;
    entriesToday: number;
    newUsersThisWeek: number;
  };
  users: SudoUserRow[];
};
