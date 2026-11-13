# Security policy

## Reporting a vulnerability

Please report security issues privately through [GitHub Security Advisories](https://github.com/bymustfa/gh-aftermath/security) for this repository. Do not open a public issue, and do not include tokens, private keys, or webhook payloads in the report.

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |

## Token handling

`gh-aftermath` reads `GITHUB_TOKEN` and the optional GitHub App private key from the environment or a file path you pass in. The web UI does not accept a token, and the server does not write tokens into the report, the HTML, or info logs.

Use a token that can read the organization and write webhook deliveries and Actions runs. Prefer a fine-grained token limited to the organization you are cleaning up, and revoke it when the incident is over.

This tool will call GitHub when dry-run is turned off. Leave dry-run on until the list looks right.
