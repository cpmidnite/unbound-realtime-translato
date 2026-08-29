# Unbound Realtime Translator

A minimal Unbound plugin for iOS and Android that watches new incoming Discord messages and, when Google detects a non-English source language, adds an English translation beneath the original message.

```text
Hola amigos
↳ English: Hello friends
```

## What it does

- Listens only for new `MESSAGE_CREATE` events while enabled.
- Skips messages authored by the signed-in user, empty messages, and link/emoji-only messages.
- Uses Google's keyless, Google Translate-compatible web endpoint with automatic language detection.
- Does not add a translation line when the detected source language is English.
- Keeps a 250-entry in-memory LRU cache and deduplicates identical requests already in flight.
- Escapes translated Markdown and neutralizes `@` so translated text cannot create a mention.
- Applies a local `MESSAGE_UPDATE`; it does **not** edit the Discord message on the server or send a new message.
- Aborts pending requests, unsubscribes, and restores locally changed message text when disabled.

## Privacy and reliability

Message content selected for translation is sent directly from the device to `clients5.google.com`. Do not use this plugin where sending message text to Google is unacceptable.

The endpoint is an unofficial, keyless Google dictionary-translation endpoint. It has no availability guarantee and may return HTTP 429, change, or stop working. The plugin fails closed: on an error, the original Discord message remains untouched. It never reads or sends the user's Discord token.

Unbound and this plugin are third-party modifications, not Discord products. Review the source and consider Discord's terms and your local rules before installing client modifications.

## Host it on GitHub (easiest path)

The ZIP already contains the built `index.js`. No development tools are needed just to host it.

1. Extract the ZIP and open the `unbound-realtime-translator` folder.
2. In GitHub, create a **public** repository, for example `unbound-realtime-translator`. Do not add a generated README or `.gitignore`, because those files are already included.
3. Choose **Add file → Upload files** and upload the *contents* of the extracted folder. Confirm that `manifest.json` and `index.js` appear at the repository root, not inside another nested folder.
4. Commit the upload to the `main` branch.
5. Replace `YOUR_NAME` and `YOUR_REPO` in this URL:

   ```text
   https://raw.githubusercontent.com/YOUR_NAME/YOUR_REPO/main/manifest.json
   ```

6. Open that URL in a browser. It should display the manifest JSON. The bundle must also be available beside it at the same URL ending in `/index.js`.
7. In Unbound, open the Plugins/Addons page, choose **Add addon manifest**, paste the raw manifest URL, and install it.
8. Turn on **Realtime Translator (English)** after installation; URL installation does not automatically enable a plugin.

GitHub Pages is not required. Unbound fetches `main` relative to the manifest URL, so keeping `manifest.json` and `index.js` together is sufficient.

### Correct the author metadata

Before publishing, edit the `authors` entry in `manifest.json`:

```json
"authors": [{ "name": "Your name", "id": "Your Discord user ID" }]
```

The included `"id": "0"` is a schema-compatible placeholder and does not affect plugin behavior.

## Update a hosted copy

If you change the source:

1. Bump `version` in `manifest.json`.
2. Run the checks and build described below.
3. Commit the changed `manifest.json`, `index.js`, and source files.
4. On the phone, remove the old copy, add the same manifest URL again, and re-enable it. The current Unbound client accepts `updates` metadata but does not use it for automatic plugin updates.

## Develop and build

Prerequisite: [Bun](https://bun.sh/).

```sh
bun install
bun run check
```

`bun run check` runs the tests, TypeScript validation, production build, manifest validation, and the same expression-evaluation shape used by Unbound. A successful build writes the host-ready `index.js` at the repository root and copies the install pair to `dist/`.

Useful files:

- `src/index.ts` wires the plugin to Unbound's documented Flux API.
- `src/controller.ts` handles incoming messages and local display/restoration.
- `src/translation.ts` contains the endpoint, response parser, timeout, and cache.
- `tests/` covers English skipping, non-Latin text, caching, in-flight deduplication, failures, incoming-message filtering, edit races, teardown, and manifest resolution.

To use another endpoint that returns the same Google array response, change `DEFAULT_TRANSLATION_ENDPOINT` in `src/translation.ts`, then rebuild.

## Compatibility and schema verification

This release was checked on 2026-08-29 against Unbound [v0.5.7](https://github.com/marioparaschiv/unbound/releases/tag/v0.5.7), commit [`1fdefff`](https://github.com/marioparaschiv/unbound/commit/1fdefff218e191cbf0ad04f3c9935127bb538597).

The manifest contains every field required by Unbound's [runtime validator](https://github.com/marioparaschiv/unbound/blob/1fdefff218e191cbf0ad04f3c9935127bb538597/packages/client/src/managers/addons.ts#L425-L441), plus the recommended `"type": "plugin"`. Unbound's [install implementation](https://github.com/marioparaschiv/unbound/blob/1fdefff218e191cbf0ad04f3c9935127bb538597/packages/client/src/managers/addons.ts#L205-L243) resolves `index.js` relative to the manifest URL. The built bundle is also verified against Unbound's current [plugin evaluator](https://github.com/marioparaschiv/unbound/blob/1fdefff218e191cbf0ad04f3c9935127bb538597/packages/client/src/managers/plugins.ts#L28-L44).

Unbound does not currently publish an addon-manifest JSON Schema, so validation is intentionally based on its runtime validator and official [manifest documentation](https://docs.unbound.rip/addons/manifest).

Discord's internal message-render component is not a stable public hook. To avoid pinning this release to one Discord component name, the plugin uses Unbound's documented [Flux subscription](https://docs.unbound.rip/plugins/flux) and a local `MESSAGE_UPDATE`. This is less visually customizable than a React render patch but is considerably less brittle across Discord builds.

## License

MIT. See [LICENSE](LICENSE).
