# Contributing

Thanks for helping improve Copilot CLI Local Memory. Keep changes small and
focused on explicit, inspectable local memory for GitHub Copilot CLI.

## Development

Requirements: Node.js 20 or newer. The runtime has no third-party dependencies.

```bash
git clone https://github.com/shankarnarayanb/copilot-cli-local-memory.git
cd copilot-cli-local-memory
npm test
```

Before opening a pull request:

1. Add or update tests for changed behaviour.
2. Run `npm test`.
3. Update the README or changelog when users will notice the change.
4. Avoid adding a database, service, telemetry, or network dependency without
   first discussing the product tradeoff in an issue.

Please use GitHub Issues for bugs and focused feature proposals. Security
problems should follow [SECURITY.md](SECURITY.md), not a public issue.
