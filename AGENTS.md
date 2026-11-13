# Agent notes

Do not add a Claude signature, Co-Authored-By line, or "Generated with Claude Code" to commit messages or PR descriptions.

Do not add any other AI-tool signature, trailer, or "Generated with" line to commit messages or pull request descriptions.

## Project

`gh-aftermath` lists failed or missing webhook deliveries and stuck Actions runs for a time window, then redelivers or cancels them. It is self-hosted.

- Core rules (window filtering, failed deliveries, stuck runs, dry-run versus execute, reports) live in `src/core` and have vitest coverage.
- `src/github` is the Octokit adapter. It paginates, stops delivery pages once they are older than the window, and uses Octokit's retry and throttling plugins.
- `src/demo` serves the `--demo` / `DEMO=1` incident. No token is required.
- The UI is server-rendered by Hono. Tokens stay in the environment.

## Commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run demo
```

## Boundaries

- Do not run `npm publish`.
- Do not create a GitHub Release. `release-please` is configured with `skip-github-release` and the npm publish job is commented out.
- Do not make the repository public.
- Do not log `GITHUB_TOKEN` or the app private key.
