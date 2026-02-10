import { defineUserSignupFields } from "wasp/server/auth";

export const userSignupFields = defineUserSignupFields({
  email: (data) => {
    if (typeof data.email !== "string") {
      throw new Error("Email is required.");
    }
    const email = data.email.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      throw new Error("Email is required.");
    }
    return email;
  },
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
