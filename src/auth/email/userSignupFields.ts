import { defineUserSignupFields } from "wasp/server/auth";

export const userSignupFields = defineUserSignupFields({
  username: (data) => {
    if (typeof data.username !== "string") {
      throw new Error("Username is required.");
    }
    const username = data.username.trim();
    if (username.length < 1) {
      throw new Error("Username is required.");
    }
    if (/\s/.test(username)) {
      throw new Error("Username cannot contain whitespace.");
    }
    return username;
  },
});
