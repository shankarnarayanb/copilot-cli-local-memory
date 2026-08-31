# Changelog

All notable changes to this project are documented here.

## Unreleased

- Added machine-readable citation metadata in `CITATION.cff`.
- Documented the project's design scope, release chronology, and relationship
  to earlier Copilot memory proposals.
- Added the copyright holder's name to the MIT licence.

## 1.1.1 - 2026-08-29

- Added the Agent Plugins v1.0.0 schema declaration to `plugin.json`.
- Removed the non-standard `category` field so the manifest passes schema
  validation without warnings.

## 1.1.0 - 2026-08-29

- Added a standard Copilot CLI `plugin.json` manifest and conventional
  `extensions/local-memory/` package layout.
- Added one-command installation with `copilot plugin install`.
- Kept the original installers as a fallback and migration path.
- Added automated checks for plugin metadata and packaged extension files.
- Documented plugin upgrades, removal, and preservation of saved memories.

## 1.0.0 - 2026-08-28

- Added `/remember`, `/memories`, and `/forget` commands.
- Added scoped memories and ranked, bounded recall.
- Added natural-language remember and recall tools.
- Added duplicate detection, secret detection, and ambiguity-safe deletion.
- Added macOS/Linux and Windows installation scripts.
- Added safe uninstall scripts that preserve memories unless explicitly purged.
- Added real Copilot CLI demonstrations for natural-language and slash-command workflows.
- Expanded usage, architecture, privacy, troubleshooting, and data-location
  documentation.
- Added a prominent explanation of `/memory` versus `/memories`.
- Added Codex and Claude Code compatibility guidance.
- Added author attribution and repository metadata.
- Added extension registration and storage tests.
- Added contribution, security, issue, and pull request guidance for a public repo.
- Added GitHub Actions coverage for supported Node.js releases.
