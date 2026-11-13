# Contributing

Thanks for helping with gh-aftermath. The useful change is usually a smaller, safer cleanup step: a clearer report, a tighter scan, or a bug in how a delivery or workflow run is classified.

## Setup

```bash
npm install
npm test
npm run demo
```

Open http://localhost:8787. Demo mode does not need a token. Live mode uses `GITHUB_TOKEN` or GitHub App credentials when they are set. If they are missing, the server still starts and the page asks for a token, kept in server memory only. See `.env.example` and the README for scopes.

## Checks

Before a pull request:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

GitHub API behavior belongs in `src/core` and `src/github`. Add or update a unit test when you change window filtering, failed-delivery detection, stuck-run detection, dry-run versus execute, or the report.

## Pull requests

- Keep dry-run as the default.
- Do not commit tokens, private keys, or real webhook bodies.
- Do not add an AI signature, a `Co-Authored-By` trailer, or a "Generated with" line to the commit message or the pull request description.
- Do not publish the package or open a GitHub Release. Publishing stays disabled until the maintainer turns it on.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
