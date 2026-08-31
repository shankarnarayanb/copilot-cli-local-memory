# Design and provenance

This document records what Copilot CLI Local Memory implements, when its public
releases appeared, and how the project relates to earlier proposals. It is an
authorship and chronology record, not a claim that the general idea of local
memory for coding agents is exclusive to this project.

## Purpose

Copilot CLI Local Memory provides an explicit, user-controlled way to capture a
useful decision while working in Copilot CLI and keep it as a local custom
instruction. The intended workflow is deliberately small:

1. Save a decision with `/remember` or natural language.
2. Inspect or search saved entries with `/memories`.
3. Remove a specific entry with `/forget`.

Each memory is an ordinary `.instructions.md` file under
`~/.copilot/instructions/local-memory/` (or the equivalent `COPILOT_HOME`
location). Entries may include an `applyTo` glob. They remain readable,
editable, portable, and removable without a database or a proprietary storage
format.

## Implemented design

The public implementation combines:

- explicit slash commands and natural-language tools for save, recall, and
  deletion;
- one modular instruction file per memory;
- optional file-scope globs using the documented `applyTo` field;
- deterministic local listing and ranked term search without embeddings;
- duplicate detection, common-secret detection, and ambiguity-safe deletion;
- two runtime JavaScript files using only Node.js built-ins; and
- no vector database, SQL database, background server, telemetry, or network
  calls from the extension itself.

This makes the project an alternative interface to Copilot CLI's documented
local modular instructions. It is not a replacement implementation of GitHub's
built-in, GitHub-managed Copilot Memory service.

## Public chronology

The Git history and immutable release tags are the authoritative technical
record:

- **v1.0.0 — 28 August 2026:** first public release, commit
  [`9643098a64257a203cc1747dcad74f91cd2781da`](https://github.com/shankarnarayanb/copilot-cli-local-memory/commit/9643098a64257a203cc1747dcad74f91cd2781da).
  It introduced local modular memory, slash commands, natural-language tools,
  scoped recall, safe deletion, tests, and installation scripts.
- **v1.1.0 — 29 August 2026:** packaged the project as a Copilot CLI plugin,
  commit
  [`98964ef7a46f622a9275cee47548e941aa9acaa0`](https://github.com/shankarnarayanb/copilot-cli-local-memory/commit/98964ef7a46f622a9275cee47548e941aa9acaa0).
- **v1.1.1 — 29 August 2026:** aligned `plugin.json` with the Agent Plugins
  v1.0.0 schema, commit
  [`46e45c28ae8bdb3271fffbbfe2c484dc6ac40aca`](https://github.com/shankarnarayanb/copilot-cli-local-memory/commit/46e45c28ae8bdb3271fffbbfe2c484dc6ac40aca).
- **v1.1.2 — 31 August 2026:** added machine-readable citation metadata, a
  documented design and release history, and explicit copyright attribution.
  See the immutable [`v1.1.2` release](https://github.com/shankarnarayanb/copilot-cli-local-memory/releases/tag/v1.1.2).

The external-plugin review is also public in
[`github/awesome-copilot#2859`](https://github.com/github/awesome-copilot/issues/2859).

## Independent preservation

Release `v1.1.2` is preserved outside GitHub in two independently addressable
records:

- **Zenodo:** [DOI 10.5281/zenodo.22216323](https://doi.org/10.5281/zenodo.22216323)
- **Software Heritage:**
  [`swh:1:dir:79e7189194b5fe1a9e36332064f91a3ceee09541`](https://archive.softwareheritage.org/swh:1:dir:79e7189194b5fe1a9e36332064f91a3ceee09541)

The Zenodo record contains the source archive for Git commit `25d7885` and
initiated the corresponding Software Heritage preservation record.

## Relationship to earlier proposals

The broader need for persistent or local Copilot CLI memory was discussed
publicly before this project was released. Relevant examples include:

- [`github/copilot-cli#446`](https://github.com/github/copilot-cli/issues/446),
  opened 1 November 2025, which proposed persistent memory backed by a vector
  database or SQLite;
- [`github/copilot-cli#2930`](https://github.com/github/copilot-cli/issues/2930),
  opened 23 April 2026, which proposed agent-maintained local Markdown memory;
  and
- [GitHub Community discussion #184415](https://github.com/orgs/community/discussions/184415),
  which discussed Copilot Memory behaviour and user control.

Those discussions are acknowledged as prior public work on the general problem.
This project's contribution is the concrete, tested implementation described
above: a small, deterministic lifecycle for user-initiated local modular
instructions, packaged for Copilot CLI.

## Authorship and licence

Copilot CLI Local Memory was created and is maintained by
[Shankar Balakrishna](https://github.com/shankarnarayanb). The source code and
documentation are released under the [MIT Licence](LICENSE). The licence allows
reuse subject to its notice and terms; it does not assert ownership over general
ideas, workflows, or independently developed implementations.

For citation metadata, see [CITATION.cff](CITATION.cff).
