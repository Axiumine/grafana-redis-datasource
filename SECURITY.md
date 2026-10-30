# Security Policy

## Supported versions

Security fixes go into the latest release of the 3.x line and nowhere else. This fork
keeps no maintenance branches, so a fix for an older release means upgrading. The
1.x and 2.x lines belong to
[RedisGrafana/grafana-redis-datasource](https://github.com/RedisGrafana/grafana-redis-datasource),
and a vulnerability in code that is still identical there is best reported to both.

## Reporting a vulnerability

Please do not open a public issue for a vulnerability. Report it privately through
[GitHub's private vulnerability reporting](https://github.com/Axiumine/grafana-redis-datasource/security/advisories/new),
which opens a draft security advisory that only the maintainers can read.

A useful report names the affected version, describes what an attacker gains, and
says how to reproduce it: a Redis command or reply, a data source setting, or a
dashboard JSON that triggers the problem. A proof of concept is welcome but not
required.

## What happens next

The maintainers acknowledge a report within 7 days and send a status update at least
every 14 days until it is closed. A vulnerability rated medium or higher is fixed and
released within 60 days of the report. Lower-severity issues are fixed in the next
regular release.

Disclosure is coordinated. The advisory stays private until a fixed release is
available, and it is published with that release and credits the reporter unless they
ask not to be named. If a fix is not possible, the reporter and the maintainers agree
on a disclosure date, and that date is no later than 90 days after the report.

## Scope

The plugin runs inside Grafana and talks to Redis with the credentials an operator
gives it, so the following are in scope: the Go backend in `pkg/`, the query and
configuration editors in `src/`, the provisioning and dashboard files shipped in the
release, and the build and release workflows in `.github/`. A weakness in Grafana,
Redis, or a Redis module belongs to that project. Dependency advisories are tracked
here with Dependabot and `osv-scanner.toml`, which lists every advisory deliberately
left open and why.

## Verifying a release

Release zips are signed with Sigstore. A release cut by the Release workflow also
carries SLSA provenance; releases published before that workflow signed anything got
their signature afterwards, from the Sign release assets workflow, and have no
provenance. Download the zip and its `.sigstore.json` bundle, then check them against
the workflow that produced them:

```bash
cosign verify-blob \
  --bundle axiumine-redis-datasource-X.Y.Z.zip.sigstore.json \
  --certificate-identity-regexp '^https://github.com/Axiumine/grafana-redis-datasource/\.github/workflows/(main|sign-release)\.yml@' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  axiumine-redis-datasource-X.Y.Z.zip
```

A release that has a `.intoto.jsonl` file can also be checked with
[slsa-verifier](https://github.com/slsa-framework/slsa-verifier) using
`verify-artifact --provenance-path <file> --source-uri github.com/Axiumine/grafana-redis-datasource`.
This is separate from Grafana's own plugin signature, which is a file inside the zip
and is checked by Grafana when it loads the plugin.
