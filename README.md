# gh-aftermath

[Türkçe](README.tr.md)

[![CI](https://github.com/bymustfa/gh-aftermath/actions/workflows/ci.yml/badge.svg)](https://github.com/bymustfa/gh-aftermath/actions/workflows/ci.yml)
[![CodeQL](https://github.com/bymustfa/gh-aftermath/actions/workflows/codeql.yml/badge.svg)](https://github.com/bymustfa/gh-aftermath/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://github.com/bymustfa/gh-aftermath/actions/workflows/scorecard.yml/badge.svg)](https://github.com/bymustfa/gh-aftermath/actions/workflows/scorecard.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/gh-aftermath.svg)](https://www.npmjs.com/package/gh-aftermath)

Self-hosted web UI for the cleanup after a GitHub incident. Pick the outage window. It lists failed and unanswered webhook deliveries across the organization's repositories, organization webhooks, and GitHub App deliveries, and it lists Actions runs that are still queued or have been in progress for too long. You can redeliver, cancel, force-cancel, and re-run them from one screen.

Dry-run is on by default. The screen shows the exact `POST` that would be sent, and you can download a JSON or Markdown report of what was planned or done.

The npm badge is a placeholder. Version 0.1.0 is not published, `package.json` is marked private, and the release workflow does not publish to npm or create GitHub Releases.

![Scan of the sample November 9 incident, with failed deliveries and stuck runs](docs/screenshot.png)

![Dry-run report listing the redeliver and cancel requests](docs/screenshot-report.png)

![Demo: pick a window, dry-run, redeliver and force-cancel, then read the report](docs/demo.gif)

## Why this exists

After incidents such as the November 9 Actions and webhooks degradation, builds stayed queued, webhooks had to be replayed by hand, and some runs would not cancel. GitHub's own redelivery example is a single-repository script. `webhook-redeliver-action` replays one repo from Actions. VS Code webhook managers are per-hook desktop tools. Hookdeck is a paid webhook platform.

gh-aftermath is the org-wide, time-windowed pass: webhooks and stuck runs together, in a web UI you can run yourself, with a report you can keep.

## Install

Node 20 or newer.

```bash
npx gh-aftermath --demo
```

`npx gh-aftermath` will work once the package is published. Until then, run it from a checkout or from the container:

```bash
npm install
npm run build
npx gh-aftermath --demo
```

Docker:

```bash
docker build -t gh-aftermath .
docker run --rm -p 8787:8787 gh-aftermath --demo
docker run --rm -p 8787:8787 -e GITHUB_TOKEN -e GITHUB_ORG=your-org gh-aftermath
```

Open http://localhost:8787.

## Usage

1. Set the organization and the UTC window. Demo mode opens on the November 9 sample incident.
2. Leave **Dry run** checked and scan.
3. Select the deliveries and runs you want. Redeliver, cancel, force-cancel, or re-run. The report lists each `POST`.
4. Turn dry-run off and run the same actions to call GitHub.
5. Download the report as Markdown or JSON.

```bash
gh-aftermath --help
gh-aftermath --demo --port 8787 --org northwind
```

| Variable | Purpose |
| --- | --- |
| `GITHUB_TOKEN` | PAT for the organization scan, redelivery, and Actions |
| `GITHUB_ORG` | Organization filled in on the form |
| `GITHUB_APP_ID` | App id, required for `/app/hook` deliveries |
| `GITHUB_APP_PRIVATE_KEY` or `GITHUB_APP_PRIVATE_KEY_PATH` | App private key |
| `GITHUB_APP_INSTALLATION_ID` | Installation used when you scan with the app instead of a PAT |
| `PORT` / `HOST` | Default `8787` and `0.0.0.0` |
| `DEMO=1` | Same as `--demo` |
| `CONCURRENCY` | Parallel GitHub calls. Default 4 |
| `MAX_PAGES` | Pages of 100 read from each list. Default 20 |

The token is read on the server. The page has no token field, and reports do not include it.

### What gets flagged

- A delivery is failed when its status code is 400 or higher, missing when the status code is `0` or absent, and failed when GitHub's status is anything other than `OK` / `success`.
- Deliveries are read newest first. Paging stops once a page is older than the window.
- A run is stuck when it is `queued`, `waiting`, `pending`, or `requested`, it was created in the window, and it is older than the queued threshold (default 10 minutes).
- A run is stuck when it is `in_progress`, it started in the window, and it has been running longer than the in-progress threshold (default 60 minutes).
- Runs that already finished are not listed. GitHub only returns current state.

Redelivery uses the official endpoints:

- `POST /repos/{owner}/{repo}/hooks/{hook_id}/deliveries/{delivery_id}/attempts`
- `POST /orgs/{org}/hooks/{hook_id}/deliveries/{delivery_id}/attempts`
- `POST /app/hook/deliveries/{delivery_id}/attempts`

Stuck runs use `POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel`, `.../force-cancel`, and `.../rerun`.

Octokit is created with the retry and throttling plugins. Primary and secondary rate limits are retried up to three times.

## Token scopes

Classic PAT:

| Scope | Used for |
| --- | --- |
| `repo` | Private repositories, and Actions cancel / force-cancel / re-run |
| `admin:repo_hook` | Repository webhook deliveries and redelivery |
| `admin:org_hook` | Organization webhook deliveries and redelivery |
| `read:org` | Listing organization repositories |

Fine-grained token:

- Metadata: Read
- Actions: Read and write
- Webhooks: Read and write
- Administration: Read, where listing hooks requires it
- Organization webhooks: Read and write, on an organization token, for org hooks

GitHub App installation:

- Actions: Read and write
- Webhooks: Read and write
- Metadata: Read

App deliveries (`GET` and `POST /app/hook/...`) authenticate as the app JWT. Set `GITHUB_APP_ID` and the private key. Set `GITHUB_APP_INSTALLATION_ID` as well when the app, rather than a PAT, should scan the organization.

## Development

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run demo
```

GitHub API decisions live in `src/core` and `src/github`. The UI does not call Octokit directly.

`release-please` is set up for a Node package. `skip-github-release` is true, and the npm publish job in `.github/workflows/release-please.yml` is commented out. Publishing also requires removing `"private": true` and an owner-approved `workflow_dispatch`. Scorecard stays off the public Scorecard API (`publish_results: false`). Code scanning is not enabled on this private repository, so CodeQL and Scorecard keep their SARIF files as workflow artifacts instead of uploading them to the Security tab.

## Related

[hook-stage](https://github.com/bymustfa/hook-stage) is for local webhook development and inspection. gh-aftermath is for recovering an organization after an outage: replay the deliveries that failed, and clear the runs that are still stuck.

## License

[MIT](LICENSE)
