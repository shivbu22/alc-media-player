# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React, Vite, TypeScript, and Electron desktop shell.

## Users

People who manage and watch local or directly linked online audio and video on a PC.

## Product Purpose

ALC is a local-first media player for importing audio/video, opening direct online media URLs, controlling playback, and keeping a small library close to the active media.

## Positioning

ALC keeps local media and direct online media in one focused player workspace without requiring the user to visit a source page for direct media playback.

## Operating Context

The product is used on a desktop PC while adding personal media, choosing a file from a small library, previewing it, and adjusting playback controls.

## Capabilities and Constraints

- Preserve the focused player, small library, direct-media-URL, and download behaviors.
- The product is player-only; editor, project, playlist, notes, captions, and watch-later workflows are intentionally out of scope.
- Local file import and direct `http`/`https` media URLs are supported.
- A webpage URL, DRM-protected stream, login-gated source, or server-blocked media cannot be universally played or downloaded.
- The product remains PC-focused and keeps only core playback controls visible.

## Brand Commitments

- Product name: ALC.
- The interface should feel precise, calm, modern, and media-focused.

## Evidence on Hand

- Current implementation in `src/App.tsx` and `src/styles.css`.
- Current local media import, playback, library, download, and remote URL flows.

## Product Principles

- Playback is the primary task.
- Keep the active media visible and easy to control.
- Preserve direct manipulation and familiar player affordances.
- Keep local media handling clear and honest about online-source limitations.
