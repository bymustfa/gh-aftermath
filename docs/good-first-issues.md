# Good first issues

Drafts ready to file. Each title is the issue title. The body underneath is the issue body.

## Add a repository allowlist to an organization scan

An organization scan walks every repository webhook. During an incident that only affected a few services, that is more API calls than you need, and the tables fill up with noise.

Add an optional allowlist (a comma-separated field, and a `--repos` flag or `REPOS` environment variable) so the scan still covers organization hooks and GitHub App deliveries, but only the named repositories for repo hooks and Actions runs. Empty means "all repositories", which stays the default. Cover it with a unit test that a repo outside the list is not queried.

## Export the report as CSV

The JSON and Markdown reports are enough to archive an incident, and awkward to drop into a spreadsheet when someone asks which hooks returned 503.

Add a third download, `GET /api/report.csv`, with one row per planned or executed action and one section (or a second file linked from the same button group) for the failed deliveries and stuck runs. Include the request path, dry-run flag, and result. Do not include response bodies. Add a test that the CSV contains the official redeliver path and has no token-shaped text.

## Show the last response snippet for one delivery

The table shows the status code. It does not show the body GitHub stored for that attempt, which is often the difference between "their hook returned 503" and "the connection never completed".

When a row is expanded, call the single-delivery endpoint (`GET /repos/{owner}/{repo}/hooks/{hook_id}/deliveries/{delivery_id}`, and the org and app equivalents) and show the status, duration, and a truncated response body. Keep it out of the bulk scan so the scan stays a list call. In demo mode, return a short fake body. Add a test that a missing response stays labeled "no response" and does not throw.

## Remember the last window in the browser

People reopen the tool the next morning with the same incident window. The form starts empty in live mode (demo mode pre-fills November 9).

Store the organization, the UTC window, the two thresholds, and the dry-run checkbox in `localStorage`. Restore them on load. Add a "Forget this window" control that clears the saved values. Do not store anything returned by the API, and do not store a token. The server still treats dry-run as the default when the checkbox is absent.

## Select rows from the keyboard

Checking a few dozen deliveries with a mouse is the slow part of a cleanup.

Add a simple list mode: `j` and `k` move the cursor, `x` toggles the row, `r` redelivers the selected deliveries, and `c` / `f` / `shift+r` map to cancel, force-cancel, and re-run. Ignore the keys while focus is in an input. Show the shortcut next to the buttons. Dry-run behavior does not change: `r` still plans the request until dry-run is off.
