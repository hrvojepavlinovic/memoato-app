export type SudoUserRow = {
  id: string;
  username: string;
  email: string | null;
  role: string;
  createdAt: Date;
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

