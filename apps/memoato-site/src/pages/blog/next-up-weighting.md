---
layout: ../../layouts/BlogPostLayout.astro
title: "Next up: suggestion weighting without being annoying"
description: "A practical scoring model for cold start, learned timing, and stable priorities."
date: "2026-02-09"
---

If you show users a list of suggestions, you are making a promise.

The promise is that the list feels logical now, not only after weeks of data.

This post explains a simple weighting model that works in the beginning, stays efficient, and gets smarter as it learns.

## The problem

Some categories are morning habits. Weight is a classic example.

Some categories are end of day wrap ups. Active calories and daily totals fit here.

If your suggestion list treats everything the same, you will end up with something like this on a Monday morning.

- Active kcal is first
- Weight is buried

That feels wrong. It creates friction and users stop trusting the feature.

## A two part score: urgency and due

The most reliable mental model is a score made of two signals.

1. Urgency: how far you are from the goal
2. Due: how appropriate it is to do this right now

You can combine them like this.

```
score = urgency_weight * urgency + due_weight * due + small_boosts
```

Urgency answers what matters.

Due answers what makes sense in the current moment.

## Cold start: start with strong priors

In the first few days you have little or no history. That is fine.

Use reasonable defaults based on category type and unit.

- Value categories you log once per day, like weight, get a morning bias
- Daily totals, like active calories, get an evening bias
- Multi entry categories, like push ups or water, are more time neutral

This alone fixes the Monday morning problem because active calories is not treated as an early day task.

## Learn timing without heavy computation

Once users start logging, you can learn a simple timing profile per category.

Use a short rolling window like the last 30 days and compute three numbers.

- Active days: how many distinct days the user logged this category
- Typical time: average minute of day when it was logged
- Typical frequency: average events per active day

This is cheap to compute if you do it from a bounded recent events query and aggregate in memory.

You do not need a new table to start. You can add one later if you want to cache.

## Blend priors and learning with confidence

The key is not to overfit early.

Introduce a confidence value based on how many active days you have.

```
confidence = clamp(active_days / 7, 0, 1)
```

Then blend like this.

```
typical_time = confidence * learned_time + (1 - confidence) * default_time
```

Early on, confidence is low, so the default behavior dominates.

Later, the system adapts to the user and still feels stable.

## Make time matter less for multi entry categories

Some categories are logged many times per day.

For those, timing is less useful. Users can do them anytime.

A simple rule works well.

```
time_weight = 0.5 if avg_events_per_day >= 1.5 else 1
```

That prevents the model from pushing something up just because it happened at a specific time yesterday.

## A simple due function

You want a curve that prefers tasks near their typical time.

One approach is to treat it like a window.

- If the typical time is far in the future, low due
- If you are near the typical time, rising due
- If you are past the typical time, high due and slowly rising

Keep it clamped so it does not explode.

## The missing piece: stability

Even a good model can feel jumpy if it reorders constantly.

Two guards help a lot.

- Clamp each component to a small range
- Use tie breakers that are stable like title order or last activity

Also keep the list short. Three items is often enough.

## What this enables

With this model, suggestions feel obvious in week one and personal in week three.

It also unlocks small product wins.

- Weight can show up early in the day
- End of day totals naturally drift later
- Multi entry habits show when you still have room to progress

## Next steps

After this works, add the escape hatch.

Let a user mark a category as morning, evening, or hide from suggestions.

Most users will never touch it, but it saves you from edge cases and makes the feature feel respectful.

If you are building something similar, keep it simple. Start with priors, learn gently, and never punish the user with a list that feels random.

