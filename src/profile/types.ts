export type ProfileData = {
  username: string;
  firstName: string | null;
  lastName: string | null;
  nextUpEnabled: boolean;
  themePreference: "light" | "dark" | null;
  email: string | null;
  isEmailVerified: boolean;
};
