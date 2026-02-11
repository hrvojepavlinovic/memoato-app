---
layout: ../../layouts/BlogPostLayout.astro
title: "Quick logging without friction"
description: "Type a number, get smart suggestions, and log in under 3 seconds."
date: "2026-02-11"
---

Memoato is built around one idea: the easiest tracker is the one you actually use every day.

That sounds obvious, but most habit trackers slow you down with extra steps, extra screens, and tiny decisions that add up.

This post explains the new quick logging flow and why it is designed the way it is.

## The goal

Logging should feel like sending a message.

You should be able to:

- Add a log in seconds
- Add a note without switching context
- Stay in the flow, especially on mobile

The benchmark is simple: under 3 seconds from thought to log.

## Quick log

Quick log is a single input that turns whatever you type into an action.

Most of the time you should not need to type a category.

You can just type a number and Memoato will suggest the most likely categories.

Examples of what you can type:

- `600` and it suggests Water intake
- `30` and it suggests Push ups
- `95` and it suggests Weight
- `padel` and it suggests Padel
- Any plain sentence, which becomes a note

Under the hood, Memoato ranks your categories using signals like:

- What you logged recently
- How often you log a category
- Typical time of day for that category
- How close the number is to your recent values and averages

Then it shows a small set of suggestions so you can confirm with one tap.

If the suggestion is wrong, you can still change the category, but the default should usually be correct.

## One tap on mobile

On mobile, the fastest path matters most.

There are two floating actions:

- Log
- Note

Log opens quick log.
Note opens notes mode directly, with a notes placeholder and no category suggestions.

This is intentional. When you are writing a note, you should not have to think about categories.

## Keyboard shortcuts on desktop

If you log from a laptop, speed should still feel instant.

Quick log supports:

- `L` to open quick log
- `N` to open a note

## Why it works

The biggest enemy of consistency is small friction.

That friction looks like:

- Choosing a category every time
- Switching between log and note screens
- Getting forced into a setup flow before you can start
- Losing motivation because progress is hard to review

Quick logging reduces those costs.
The result is a tighter loop, which makes it easier to come back tomorrow.

If you have feedback about the flow, send it. Memoato is built in public and tiny tweaks matter.

Try it: https://app.memoato.com
