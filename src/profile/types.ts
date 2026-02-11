export type ProfileData = {
  username: string;
  firstName: string | null;
  lastName: string | null;
  nextUpEnabled: boolean;
  themePreference: "light" | "dark" | null;
  quickLogFabSide: "left" | "right";
  email: string | null;
  isEmailVerified: boolean;
  hasEmailAuth: boolean;
  hasGoogleAuth: boolean;
  needsEmailVerification: boolean;
};
