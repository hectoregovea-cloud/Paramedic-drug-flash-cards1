# Paramedic drug flashcards

A browser-based study app built with vanilla JavaScript and Vite. The starter deck uses the 38 drug pages in the supplied [QAS ACP2 Flashcards PDF](public/QAS_ACP2_Flashcards.pdf), with a link back to each source page.

Search the deck, filter by category, reveal answers, shuffle cards, or add your own. Use the previous/next buttons or arrow keys to navigate, and Space to reveal an answer while focus is outside form controls. You can delete the current card or reset the original deck.

## Run locally

Use Node.js 20.19+ within the Node 20 release line, or Node.js 22.12+; the cloud environment uses Node.js 24.19. Dependencies are pinned in `package-lock.json`.

```sh
npm ci
npm run dev
```

The development server listens on port 5173 and all network interfaces. For a cloud workspace with a restricted home directory, put npm's cache in a writable location:

```sh
export npm_config_cache=/workspace/.cache/npm
npm ci
```

## Validate and build

```sh
npm test
npm run build
npm run preview
```

The production build is written to `dist/`. The preview server listens on port 4173. No backend, account, credentials, or environment variables are required.

## Your cards

Deck edits are saved in the browser's local storage and survive a page refresh. They do not sync between browsers or devices, and clearing site data removes them. Resetting the deck restores the original starter cards and replaces local edits.

## Source and study limits

The supplied PDF contains independent summaries of Queensland Ambulance Service Drug Therapy Protocols retrieved on 12 October 2026. It excludes extended, critical care paramedic, and flight scope. This app is an independent study aid and does not claim official QAS endorsement. Refer to the linked PDF pages for the source material and consult current QAS protocols for clinical use.
