---
layout: ../../layouts/BlogPostLayout.astro
title: "Quick logging without friction"
description: "A simple input that learns your habits, plus one-tap actions for logging and notes."
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

## Quick log

Quick log is a single input that accepts what you would naturally type.

Examples:

- `600 water`
- `30 push ups`
- `95 weight`
- `padel`
- A plain sentence, which becomes a note

Memoato uses your categories, recent history, and goals to pick the best match, then keeps the rest of the UI out of the way.

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

