---
layout: ../../layouts/BlogPostLayout.astro
title: "Next up: suggestion weighting without being annoying"
description: "A practical scoring model for cold start, learned timing, and stable priorities."
date: "2026-02-09"
---

If you show users a list of suggestions, you are making a promise.

The promise is that the list feels logical now, not only after weeks of data.

This post explains the simple logic behind it. It works from day one, and it gets more personal over time.

## The problem

Some categories are morning habits. Weight is a classic example.

Some categories are end of day wrap ups. Active calories and daily totals fit here.

If your suggestion list treats everything the same, you will end up with something like this on a Monday morning.

- Active kcal is first
- Weight is buried

That feels wrong. It creates friction and users stop trusting the feature.

## Two signals: progress and timing

Suggestions feel good when they match two things at the same time.

- Progress: how far you are from the goal
- Timing: how appropriate it is to do this right now

Progress answers what matters.

Timing answers what makes sense right now.

## Cold start: start with strong priors

In the first few days you have little or no history. That is fine.

Use reasonable defaults based on category type and unit.

- Value categories you log once per day, like weight, get a morning bias
- Daily totals, like active calories, get an evening bias
- Multi entry categories, like push ups or water, are more time neutral

This alone fixes the Monday morning problem because active calories is not treated as an early day task.

## How it learns your routine

Once you start logging, memoato can learn a simple routine for each category.

It looks at recent history and estimates a few things.

- Active days: how many distinct days the user logged this category
- Typical time: roughly when you usually log it
- Typical frequency: average events per active day

This is how memoato can learn that weight is usually a morning habit while daily totals belong later.

## It does not overreact early

In the beginning, one weird day should not change everything.

So memoato starts with defaults, then slowly shifts toward your real routine as it collects enough logs.

That keeps suggestions stable and predictable.

## Timing matters less for some categories

Some categories are logged many times per day.

For those, timing is less useful. Users can do them anytime.

So memoato treats timing as a weaker signal there, and focuses more on progress.

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

## What this means for you

- Morning habits show up earlier
- End of day totals drift later
- The list stays short and focused

If you do not want suggestions at all, you can hide Next up from Profile settings.

If a suggestion feels off, tell me. The fastest way to improve memoato is real usage and blunt feedback.
