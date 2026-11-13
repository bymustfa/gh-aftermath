# gh-aftermath

Do not add a Claude signature, Co-Authored-By line, or "Generated with Claude Code" to commit messages or PR descriptions.

gh-aftermath is a self-hosted web UI for cleaning up after a GitHub outage. Keep GitHub API behavior in `src/core` and `src/github`, separate from the Hono UI. Dry-run stays on by default. Do not publish to npm, create a GitHub Release, or make this repository public unless the owner explicitly asks.
