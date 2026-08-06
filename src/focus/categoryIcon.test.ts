import { describe, expect, it } from "vitest";
import { categoryIcon } from "./categoryIcon";

describe("categoryIcon", () => {
  it("always preserves a manually selected icon", () => {
    expect(categoryIcon({ title: "Football", emoji: "🥅" })).toBe("🥅");
  });

  it.each([
    ["Dead Bug", "🧘"],
    ["Supported One-arm Dumbbell Row", "🏋️"],
    ["Stationary Cycling", "🚴"],
    ["Workout Session", "🏋️"],
    ["Anxiety Level Now", "🧠"],
    ["Body Condition", "🧍"],
    ["Pain", "🩹"],
    ["Energy", "⚡"],
    ["Active Calories Burned", "🔥"],
    ["Average Heart Rate", "❤️"],
    ["Daily Peak Anxiety", "🧠"],
    ["Sleep Quality", "😴"],
  ])("selects an appropriate icon for %s", (title, expected) => {
    expect(categoryIcon({ title })).toBe(expected);
  });

  it("uses measurement and category semantics as bounded fallbacks", () => {
    expect(categoryIcon({ title: "New exercise", unit: "reps" })).toBe("🏋️");
    expect(categoryIcon({ title: "Focus", categoryType: "GOAL" })).toBe("🎯");
    expect(categoryIcon({ title: "Something new" })).toBe("📌");
  });
});
