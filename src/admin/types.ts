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
    categories: number;
    entries: number;
  };
  users: SudoUserRow[];
};
