---
layout: ../../layouts/BlogPostLayout.astro
title: "Privacy modes: cloud, encrypted cloud, and local-only"
description: "Pick the storage mode that fits your comfort level (and your reality)."
date: "2026-01-31"
---

memoato is built to be fast first. But “fast” should not mean “give up control”.

So the app includes three privacy modes:

## 1) Cloud sync (default)
Your account, categories, and entries are stored normally so charts and history work across devices.

This is the smoothest experience: sign in anywhere and keep going.

## 2) Encrypted cloud
If you want the convenience of cloud sync but don’t want your tracker names and notes stored as plain text, you can enable **Encrypted cloud**.

In this mode, memoato encrypts:

- Category titles (tracker names)
- Per-entry notes

Encryption happens **on your device** before saving to the database. You unlock with a passphrase on each device.

If you lose the passphrase, memoato cannot recover the encrypted content.

## 3) Local-only
If you want to keep everything on a single device, switch to **Local-only**.

Local-only stores your categories and entries in the browser (IndexedDB). Switching to local-only wipes the server data for that account.

It’s powerful, but comes with the obvious trade-off: if you clear your browser data or lose the device, you lose the data.

## The intent
The point is not to sell “perfect privacy”. The point is to make privacy choices explicit and practical:

- Choose cloud when you need continuity.
- Choose encrypted cloud when you want privacy for names/notes.
- Choose local-only when you want to keep data off the server entirely.

If you want to try it, open the app at **app.memoato.com**, then go to **Profile → Privacy**.

