# Contributing

Thank you for looking at this fork of the Redis Data Source for Grafana. This file
says how to report a problem, how to propose a change, and what a change has to
satisfy before it is merged.

## Reporting a bug or asking for a feature

Open an issue in this repository using one of the templates. For a bug, give the
plugin version, the Grafana version, the Redis version and whether it is a
standalone server or a cluster, and the query that misbehaves. Problems that are
present in upstream as well may also be reported to
[RedisGrafana/grafana-redis-datasource](https://github.com/RedisGrafana/grafana-redis-datasource).
A security problem is not a bug report: follow [SECURITY.md](SECURITY.md) instead.

## Proposing a change

1. Fork the repository and branch from `main`.
2. Make the change, with tests, following the sections below.
3. Open a pull request against `main` and describe what changed and why. Continuous
   integration has to pass, and the maintainer reviews it before it is merged.

Small, focused pull requests are reviewed faster than large ones. If a change is big,
open an issue first so the direction can be agreed before the work is done.

## Building and testing

[DEVELOPMENT.md](DEVELOPMENT.md) covers prerequisites, building the frontend and the
six backend binaries, and running Grafana against the result. The checks that pull
requests are held to are:

```bash
yarn typecheck && yarn lint && yarn test:ci
go vet ./pkg/... && go test ./pkg/...
govulncheck ./pkg/...
```

## Tests are required

A new feature or a bug fix comes with a test that fails without it. The backend is
held to 100% statement coverage and the Qodana quality gate enforces it, so a line
that cannot be reached by a test is a line to reconsider. Parsers that read what a
Redis server sends back also get a fuzz target next to the unit tests, as in
`pkg/fuzz_test.go`.

## Coding standards

Go code is formatted with `gofmt` and passes `go vet`. TypeScript is checked by
ESLint and formatted with the repository's own Prettier, never a global one. Files
that come from upstream and are not otherwise touched are left as they are, even when
`gofmt` would change them, so that patches to upstream stay free of noise.

Comments explain why, in full sentences. New names follow the surrounding code.

## Commit messages

A hook in `.githooks/` rejects a commit whose message does not fit the format
`<type>(<scope>): <subject>`, where the type is one of `feat`, `fix`, `chore`, `docs`,
`refactor` or `ci`. The whole message is at most 150 characters. Enable the hook once
per clone:

```bash
git config core.hooksPath .githooks
```

## Licensing

The plugin is licensed under the Apache License, Version 2.0, and a contribution is
accepted under the same licence. A new source file starts with the notice shown in
any existing added file, such as `pkg/fuzz_test.go`. A file modified from upstream
carries the change notice that Apache-2.0 section 4(b) asks for. Every file added or
modified relative to upstream is listed in `NOTICE`, in the same commit.

## Conduct

Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
