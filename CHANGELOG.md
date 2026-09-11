# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.0.0] - 2026-09-11

### Added

- Added an `aria-label` to the twelve `Select`, `TextArea` and `RadioButtonGroup` controls of the query editor. Every one of them sits beside a bare `InlineFormLabel`, which renders a `<label>` carrying no `htmlFor`, so none of them had an accessible name — neither for a screen reader nor for a test that addresses the rendered document rather than a component's props
- Added `.nvmrc`, and the three workflows read the Node version from it through `node-version-file` instead of repeating it
- Added `yarn typecheck`, `yarn lint`, `yarn lint:fix` and `yarn test:ci` scripts. `yarn test` now watches only the files a local run has changed, and `yarn test:ci` is the single pass with coverage that the workflows call
- Added a type check, a lint and a test step to all three workflows, which until now ran `yarn build` and nothing else
- Added stubs for `IntersectionObserver` and `ResizeObserver` to `jest-setup.js`. jsdom implements neither, and `@grafana/ui` uses the first in the `ScrollContainer` that wraps every `Select` menu, so a test that opened a dropdown threw a `ReferenceError` before them
- Added a Qodana workflow, `.github/workflows/qodana.yml`, with `qodana-go.yaml` and `qodana-js.yaml` beside it. One Qodana run analyses one linter image, so the Go backend and the TypeScript frontend get a job each, and each uploads its SARIF to GitHub code scanning under its own category, on `always()` so that a failed gate still publishes the findings that explain it. Neither `qodana-go` nor `qodana-js` has a Community edition — the free grant for open source covers only the JVM, Python, .NET, C++ and Android images — so both jobs skip themselves unless a `QODANA_TOKEN` secret is set, the way the Codecov step already does
- Both Qodana configurations run the `qodana.recommended` profile under an Ultimate Plus licence and declare a quality gate in `failureConditions`: no `CRITICAL` and no `HIGH` problems, and `testCoverageThresholds` of 100 for both `total` and `fresh` on the frontend, 99 total with 100 fresh on the backend. The backend floor is measured rather than aspirational: Qodana counts lines where `go test -cover` counts statements, and the twelve lines no test reaches are `main()`, which blocks in `datasource.Serve` until Grafana stops the process, and two `tabwriter` error branches that a `strings.Builder` cannot trigger because its `Write` never fails. Each `bootstrap` produces the coverage the gate reads — `go test -coverprofile=coverage/coverage.out` for the backend, `yarn test:ci` for the frontend — because Qodana locates coverage by filename and would not find the `coverage/backend.txt` that `mage cover` writes. The Ultimate Plus vulnerability checker and licence audit are both on, with `raiseLicenseProblems` promoting a licence violation to an inspection result so that it counts against the severity thresholds, `licenseRules` prohibiting the copyleft licences that Apache-2.0 redistribution cannot absorb, and `analyzeDevDependencies` widening the frontend scan to the build toolchain. Paths belonging to the other linter are excluded through the top-level `exclude` key with `name: All`, which is the form the CLI parses: `Profile` carries only `name` and `path`, so a `profile.inspections` list is read and then silently discarded
- Added the Apache-2.0 section 4(b) change notice to the three workflows, the `Dockerfile` and `.gitignore`, which were modified without one, and the fork notice to `.githooks/commit-msg` and `.github/dependabot.yml`, which are ours
- Added `.githooks/pre-commit`, which runs both Qodana linters over the working tree and refuses the commit when the quality gate fails. The gate is the one each configuration declares: no `CRITICAL` and no `HIGH` problems, 100% coverage on changed lines, and an overall floor of 99% for the backend and 100% for the frontend. `SKIP_QODANA=1` bypasses it, `QODANA_LINTERS` narrows it to one linter, and a missing `QODANA_TOKEN` is a loud skip rather than a hard failure, so that a contributor without a licence is not locked out of committing; `QODANA_REQUIRED=1` turns that skip into a failure
- Added `pkg/info-parse_test.go`, `pkg/redis-connection_test.go`, `pkg/redis-hotkeys_test.go` and `pkg/redis-value_test.go`, and thirteen further cases to the suites that already existed, covering the INFO pair and record parsers and the frame builder that unions their keys, the connection options for TLS, Sentinel and cluster, the datasource instance factory, the hotkeys frames and the slot-range formatter, the `redisValue` converters, and the malformed-input branches of the cluster, custom command, JSON and SLOWLOG handlers. Backend coverage is now 99.6% of the statements `go test -cover` counts and 99% of the lines Qodana counts, against no `CRITICAL` and no `HIGH` problems
- Added `tools/package-tag.sh`, which builds, signs and packages a release artifact for one of this fork's own tags from that tag's own tree, reproducing what `.github/workflows/main.yml` does. A tag counts as ours when it has no counterpart under `refs/upstream-tags/`; the script refuses the inherited tags outright. It selects Node 16 for tags that predate the `@grafana/create-plugin` migration and the version in `.nvmrc` for the rest, falls back to a Python packer that preserves the executable bit when `zip` is absent, and writes to the ignored `artifacts/` directory without pushing anything. Signing is mandatory unless `ALLOW_UNSIGNED=1` is passed, and needs `GRAFANA_PLUGIN_ROOT_URLS` as well as `GRAFANA_ACCESS_POLICY_TOKEN`: this fork is not in Grafana's catalogue, so the access policy issues a private signature, which is bound to the instances allowed to load the plugin and fails with `409 InvalidArgument, Field is required: rootUrls` without them

### Changed

- Migrated the frontend build from the deprecated `@grafana/toolkit` 8.3.4 to the `@grafana/create-plugin` scaffolding in `.config/`: webpack 5, SWC and Jest 29, configured from the root `jest.config.js`, `jest-setup.js`, `tsconfig.json`, `eslint.config.mjs` and `.prettierrc.js`, each of which only extends its scaffolded counterpart. `.config/` is regenerated wholesale by `create-plugin update` and must not be edited
- Upgraded `@grafana/data`, `@grafana/runtime` and `@grafana/ui` from 8.3.4 to 12.2.1, and React from 17 to 18. `@grafana/ui` 12 peer-requires React 18; `DataSourceSettings` no longer carries `password` or `basicAuthPassword` and now carries `readOnly`; and `TemplateSrv` now requires `containsTemplate` and `updateTimeRange`
- Rewrote the `ConfigEditor` and `QueryEditor` suites from Enzyme to React Testing Library. Enzyme has no React 18 adapter, so the rewrite was a precondition of the upgrade rather than a preference; the suite still holds 229 tests, asserting against the rendered document instead of a shallow render's props
- Raised `grafanaDependency` in `src/plugin.json` from `>=8.0.0` to `>=12.0.0`. **This drops support for Grafana 8 through 11**: the plugin will no longer install on them
- The workflows install dependencies unconditionally instead of skipping the step whenever a cache was hit, and `actions/setup-node` now caches the yarn cache directory itself. The previous arrangement let a stale `node_modules` cache keep a job green while the same commit failed from cold
- Replaced every `::set-output` command, which GitHub has disabled, with an append to `$GITHUB_OUTPUT`
- Replaced the archived `actions/create-release@v1` and `actions/upload-release-asset@v1` with `softprops/action-gh-release@v2`, and the retired `plugincheck` validator with `plugincheck2`
- Dropped `NODE_OPTIONS: --openssl-legacy-provider` from the workflows; webpack 5 does not need it
- Raised `engines.node` from `>=14` to `>=22`. The scaffolded webpack configuration, SWC and Jest 29 all target it. `.nvmrc` pins 24 and the three workflows read it through `node-version-file`, so `>=22` is the supported floor and 24 is the version every build actually runs on
- Declared `react`, `react-dom`, `rxjs`, `@emotion/css` and the three `@grafana/*` packages as `dependencies` instead of inheriting them from `@grafana/toolkit` as development dependencies. Webpack lists all of them as externals, so Grafana keeps providing them at runtime and none of them are bundled
- `yarn build` and `yarn dev` invoke webpack against `.config/webpack/webpack.config.ts` rather than `grafana-toolkit plugin:build` and `plugin:dev`, and `yarn format` runs Prettier 3 over the whole tree with `--list-different`
- Changed `FieldValuesContainer` from an interface with one optional field to `Record<string, any>`. `Control<T>` is invariant in `T` and `@grafana/ui` declares the `control` prop of `FieldArray` as `Control<FieldValues>`, so a narrower shape made `Form` infer a narrower `T` whose control was no longer assignable
- Changed the Grafana badge in `README.md` from 8 to 12, and stated the fork's own requirements, Grafana 12.0+ and Node.js 22+, in the fork banner rather than inside the requirements list below it, which is upstream's and describes upstream's releases
- The migrated build was verified end to end against Grafana 12.2.0 and Redis 8.10.1: the configuration editor and the query editor render and update the query model, the command dropdown selects, the CLI text area and a streaming query all return data, and the browser console stays clean
- Excluded four style inspections — `DuplicatedCode`, `GoCommentStart`, `GoPreferNilSlice` and `GoRedundantConversion` — on the files this fork has never modified, and fixed all eighteen of their reports in the files it has: godoc comments on `datasource.go`'s exported declarations, nil slice declarations in the INFO parsers and the hotkeys frame, and two redundant conversions. The rule is the one `CLAUDE.md` already states for the seven files `gofmt -l` flags — our own files must be clean, upstream's stay as upstream wrote them, because restyling them would put a conflict in the path of every pull request we send back. `DuplicatedCode` is excluded across `pkg`: most of its reports are table-driven tests, where the repetition is the test data, and the rest are upstream's query functions, which mirror the Redis commands they wrap one for one
- Excluded `ES6PreferShortImport`, `JSDeprecatedSymbols` and `DuplicatedCode` on `src`, for reasons of their own rather than for the fork boundary. The first reports every relative import in the tree, because the scaffolded `.config/tsconfig.json` maps `"*": ["../src/*"]` and a bare specifier is therefore always shorter; taking that advice would make the whole frontend depend on a path mapping inside a file `create-plugin update` regenerates and which must not be edited, against a tree that is relative throughout — roughly fifty relative imports to three bare ones. The second covers Grafana's own deprecations, `LegacyForms`, `Form`, `FieldArray` and `Field.values.toArray`, whose replacement is a rewrite of both editors and of the streaming frame and belongs to a release of its own; removing the exclusion is how that work gets found again
- Added `CC0-1.0` and `CC-BY-4.0` to the frontend licence audit's allowed list. Neither constrains an Apache-2.0 redistribution — the first is a public-domain dedication, the second asks only for attribution — and both arrive through build-time data packages that are not bundled into `dist`: `caniuse-lite`, `mdn-data`, `spdx-license-ids`, `string-hash` and `xml-utils`. The audit reports any licence it finds in neither list, so an unreviewed one still fails the run

### Removed

- Removed the deprecated `grafanaVersion` key from `src/plugin.json`, superseded by `grafanaDependency`
- Removed `@grafana/toolkit`, `enzyme`, `enzyme-adapter-react-16`, `@wojtekmaj/enzyme-adapter-react-17`, their `@types` packages and `sinon`
- Removed `config/jest-setup.ts`, superseded by the root `jest-setup.js`
- Removed the `yarn upgrade` and `yarn watch` scripts. `yarn dev` is the watching build, and pinned versions are not upgraded wholesale by a script

### Fixed

- The Codecov step failed every run in this fork. `codecov/codecov-action@v4` requires a token, `CODECOV_TOKEN` is not set here, and `fail_ci_if_error: true` turned that into a red build after every other step had passed. The step is now `@v5`, and it is skipped unless the token exists
- The `README.md` banner asserted that everything below it was upstream's README, while two fork-authored bullets sat inside upstream's requirements list — one of them reading _is required for this fork_, which upstream could not have written. Both are now in the banner, and the text below it is byte-identical to upstream's at `09df07a` apart from the demo section, whose removal the banner states
- Removed the demo section from `README.md`. `demo.volkovlabs.io` redirects to the notice announcing that Volkov Labs has been acquired and has discontinued its Grafana plugins, so all three links led a reader to a closure page rather than to a dashboard
- The release workflow read its release notes with `awk '/^## / {s++} s == 1 {print}'`, which takes the first `## ` section of `CHANGELOG.md`. That was the version heading in upstream's changelog, but restructuring to Keep a Changelog put `## [Unreleased]` first, so every tagged release would have published the unreleased section as its notes. It now selects the section whose heading matches the tag, and fails the build when there is none
- The CI badge in `README.md` reported upstream's build rather than this fork's, and the Codecov badge pointed at upstream's project and token. The first now points at this fork's `ci.yml`, the second is gone, and so is the LGTM badge, whose service was retired in 2022 and whose image no longer resolves
- The Go linter never produced a coverage report, so its coverage gate failed for a reason that had nothing to do with the tests. Qodana runs the linter image as the invoking user rather than as root, while the image bakes in `GOPATH=/go` and `GOCACHE=/root/.cache/go-build`, neither of which that user may write; fetching the 1.26.8 toolchain then died on its checksum-database cache with `open /go/pkg/sumdb/sum.golang.org/latest: no such file or directory`, and the bootstrap aborted before `go test` ran. It now redirects both variables into the Qodana cache mount, with a `/tmp` fallback for a scan invoked without one. `GOSUMDB` is deliberately left alone: the fix is a writable cache, not a weaker supply chain
- Qodana lost the history it attributes fresh code with. It mounts the project at `/data/project` and runs git there, but in a `git clone --recurse-submodules` checkout the plugin's `.git` is a file pointing at the umbrella repository's `.git/modules/`, which lives outside that mount, so git reported `fatal: not a git repository`. The pre-commit hook now mounts the real git directory and names it through `GIT_DIR`, with `GIT_WORK_TREE` alongside it: the submodule's `core.worktree` is relative to the git directory and resolves to the wrong place under the container's layout, and only the environment variable overrides it
- The pre-commit hook put Qodana's cache inside the project it analyses. Qodana mounts the cache directory as well as the project, and Go's module cache lives in it, so indexing crawled the downloaded toolchain's own assembly sources and the run never finished. The cache now lives under `${XDG_CACHE_HOME:-$HOME/.cache}/qodana-precommit` and `.qodana/` is excluded, which took opening the project from over a minute and climbing to eleven seconds
- Fixed the `HIGH` problems the first working Go scan reported: unused parameters mandated by an interface are now `_`, `Close` results in test cleanup are discarded explicitly, the error from `frame.RowLen` is handled, `instanceSettings.Dispose` logs a pool that refuses to close instead of discarding the error, the results of `fmt.Fprintf` into a `strings.Builder` are discarded explicitly, a local named `error` no longer shadows the predeclared identifier, and the five `QueryData` tests that dereference a response now fail fast on a nil one — `require.NotNil` aborts the test, but the analyser cannot see through a testify helper, so it took an explicit `if response == nil { t.Fatal(...) }`
- Two of those reports were not defects, and are excluded by inspection and path rather than silenced globally. `GoErrorsAs` holds that the second argument to `errors.As` must point at a type implementing `error`, but radix's `resp2.Error` declares `Error() string` on a value receiver, so `&redisErr` is a valid target; and `main()` cannot be driven from a test, because it calls `datasource.Serve`, which blocks until Grafana stops the process
- The JSDoc on `QueryEditor`'s six field handlers documented a parameter none of them takes. Each is curried — it takes the query property by name and returns the event handler — so `@param event` described the returned function's parameter while the documented function's own `name` went undescribed; one of them carried the bare `@param {value: ValueType}`. `TimeSeries.update` had the same drift, documenting a `request` it does not take. They now describe the parameter each function has and the handler it returns
- Streaming dropped the promises it created. The interval callback ran `response.data.forEach(async (frame) => …)`, so an `update` that rejected became an unhandled rejection with nothing to attribute it to. The frames are still updated concurrently, through `Promise.all(response.data.map(…))`, and the result is now awaited
- Removed three redundant `any` type arguments from `SelectableValue` in the query editor's suite; the parameter already defaults to `any`

### Security

- Raised the `go` directive in `go.mod` from `1.26.5` to `1.26.8` and dropped the now redundant `toolchain go1.26.8` line, so one version governs both the language floor and the build. A `toolchain` line is honoured by `GOTOOLCHAIN=auto` but ignored by `GOTOOLCHAIN=local`, which is the default in Debian's and Fedora's Go packages, and such a build would have compiled against the 1.26.5 standard library — [GO-2026-6090](https://pkg.go.dev/vuln/GO-2026-6090) in `crypto/tls` and [GO-2026-5972](https://pkg.go.dev/vuln/GO-2026-5972) in `encoding/asn1`. It now fails with `go.mod requires go >= 1.26.8` instead. `go.sum` and every dependency version are unchanged, and `govulncheck` and Trivy still report nothing against the binary
- Added `.env` to `.gitignore`. The file holds `QODANA_TOKEN` and `GRAFANA_ACCESS_POLICY_TOKEN`, and this repository is public. It was already covered by a global `core.excludesFile`, which is not a safeguard the repository can rely on: a global ignore does not travel with a clone, so every other machine and every contributor had no protection at all. The rule now lives in the repository, alongside `.qodana/` and `qodana.sarif.json`

## [2.3.0] - 2026-09-10

### Added

- Added the argument count returned by [SLOWLOG GET](https://redis.io/commands/slowlog-get/) in Redis 8.10 as **Arg Count**, plus a **Truncated** flag derived from the `... (N more arguments)` marker
- Added [HOTKEYS GET](https://redis.io/commands/hotkeys-get/) (Redis 8.6) as a command, returning the tracked keys as a long frame and the collection scalars as a summary frame
- Added `threads`, `hotkeys`, `modules`, `latencystats`, `keysizes`, `search` and `everything` to the INFO section dropdown, taking it from 11 sections to 18

### Changed

- Parsed the record style INFO sections into typed frames instead of raw text: `latencystats` with one column per tracked percentile, `keysizes` as database/type/bucket/count rows, `modules` with version, API level and dependencies, `threads` per I/O thread, `hotkeys` and `search`
- `INFO all` and `INFO everything` now return one frame per section instead of collapsing every section into a single frame
- `CLUSTER NODES` keeps every slot range of a node instead of the first one only, splits out the hostname and adds a `Slots` count
- `CLUSTER INFO` is parsed by the same code path as an INFO section

### Fixed

- Streamed replies that carry no time field now get one, so a streaming `INFO` query can be plotted on a time series panel (previously it produced a frame with no time field, which no time series panel could render)
- `CLUSTER NODES` reported `ping-sent` and `pong-received` as `ms` durations when they are Unix millisecond timestamps, and replaced a `0` ping — no ping pending — with the current time, making every idle node look freshly pinged. They are now ISO timestamps, null when no ping is pending
- Bundled dashboards referenced the streaming time field as `#time`, which never matched the field name

### Security

- Upgraded `github.com/grafana/grafana-plugin-sdk-go` from `v0.164.0` to `v0.296.4` and the Go toolchain from `1.19` to `1.26.8`, closing every vulnerability reported against the shipped backend binary in [RedisGrafana/grafana-redis-datasource#318](https://github.com/RedisGrafana/grafana-redis-datasource/issues/318). Trivy on `dist/redis-datasource_linux_amd64` goes from 57 findings (2 critical, 34 high, 19 medium, 1 low) to 0; `govulncheck` reports no vulnerabilities in both source and binary mode
- The SDK bump carries `golang.org/x/net` `v0.9.0` to `v0.58.0`, `google.golang.org/protobuf` `v1.30.0` to `v1.36.12`, `golang.org/x/text` `v0.9.0` to `v0.41.0`, `otelgrpc` `v0.40.0` to `v0.70.0` and `otelhttptrace` `v0.37.0` to `v0.70.0`
- Pinned `google.golang.org/grpc` to `v1.83.2`, one patch above what the SDK requires, for CVE-2026-84303, CVE-2026-84304 and CVE-2026-84445. `govulncheck` finds none of the three reachable, but a version-based scanner such as Trivy flags them regardless
- The Go toolchain is pinned in `go.mod` (`toolchain go1.26.8`) rather than in the workflows, because the standard library is attributed to whichever toolchain compiled the binary. The three GitHub workflows and the `Dockerfile` follow from it: `actions/setup-go` now reads `go-version-file: go.mod`, so `go.mod` is the single place a version is declared
- Added a `govulncheck` step to CI and a `dependabot.yml` covering Go modules, npm, GitHub Actions and Docker, so the next advisory does not need a fork to be noticed

## [2.2.1] - 2026-08-18

### Changed

- Bumped GitHub Actions to restore CI after the deprecated actions/cache@v2 shutdown (#339)
- Migrated plugin signing to Grafana Access Policy tokens
- Bumped word-wrap dependency (#309)

### Fixed

- Fixed dashboard variable interpolation for RediSearch searchQuery (#337, #338)

## [2.2.0] - 2023-07-12

### Added

- Added [FT.SEARCH](https://redis.io/commands/ft.search/) command to datasource (#297)
- Added GROUPBY argument to [TS.MRANGE](https://redis.io/commands/ts.mrange/) command (#304)
- Adding new aggregators for TS.MRANGE/TS.RANGE (#260)

### Changed

- Upgraded Grafana Go SDK version (#302)

### Fixed

- Fixed issue with non-string scalars in JSON.GET (#301)

### Security

- Various security patches (#258, #267, #281, #307)

## [2.1.2] - 2023-06-12

### Fixed

- Fix issue connecting to Redis 7 cluster instances (#284)

## [2.1.1] - 2022-01-18

### Changed

- Upgrade to Grafana 8.3.4

## [2.1.0] - 2022-01-17

### Added

- Add RedisGears PYEXECUTE function to Query Editor (#248)

### Changed

- Upgrade to Grafana 8.2.5 (#237)
- Upgrade to Grafana 8.3.0 (#244)
- Update Components naming (#247)
- Add Grafana Marketplace to README (#249)
- Update follows-redirect package (#253)

### Fixed

- Grafana template variables not working for the Default datasource (#242)
- Fix JSON.GET: interface conversion: interface {} is string (#246)

## [2.0.0] - 2021-11-10

### Added

- Allow multiple Streaming queries per panel (#213)
- Support of ZRANGE command (#182)
- Support fetching from RedisJSON datasource (JSON.GET, JSON.TYPE, JSON.ARRLEN, JSON.OBJLEN, JSON.OBJKEYS) (#229)
- Redis Enterprise introduced new field calls_master in commandstats (#232)

### Changed

- XRANGE command based on the selected time range if Start/End is not specified. Use '-' as Start and '+' as end to display all results.
- Upgrade to Grafana 8.0.6 (#212)
- Update Grafana SDK 0.110 (#214)
- Update to Grafana 8.1.4 (#217)
- Update to Grafana 8.2.1 (#220)
- Update to Grafana 8.2.2 (#223)
- Use Time-range for XRANGE filtering (#176)
- Disable Command-line interface in the Query Editor (#226)
- Upgrade Grafana 8.2.3 and backend dependencies (#228)

### Removed

- Supports Grafana 8.0+, for Grafana 7.X use version 1.5.0

### Fixed

- Fix RedisGears rg.dumpreqs command when Requirement was not yet downloaded so wheels are not available (#219)
- SCARD does not show a key field any more (#233)

## [1.5.0] - 2021-07-06

### Added

- Alerting for Grafana-Redis-Datasource #166
- Add support for Sentinel ACL User and Password authentication separate from Redis #197
- Add Support for RedisGraph query nodes count (#199)
- Add GRAPH.EXPLAIN and GRAPH.PROFILE commands (#200)
- Add GRAPH.CONFIG and RedisGraph refactoring (#201)
- Add Streaming dashboard for v8 and update #time streaming field (#204)
- Add TS.MGET command (#209)

### Changed

- HGET returns field with values named as requested field instead of "Value" similar to HMGET and HGETALL.
- Streaming field `time` moved from Frontend to Backend. Field's name renamed to "#time" to avoid confusion with returned fields.
- Add Redis Explorer to README and minor docker updates (#195)
- Refactor RedisTimeSeries and RedisGears commands (#202)
- Upgrade Grafana 7.5.7 and backend dependencies (#203)
- Refactor Redis commands (#210)

### Fixed

- Fix NaN for variables (#206)

## [1.4.0] - 2021-05-08

### Added

- Add $time field for Streams XRANGE (#175)
- Add RG.PYDUMPREQS command and integration test fix (#183)

### Changed

- Update Grafana SDK 0.88 and other backend dependencies (#170)
- Add Integration tests to CI (#184)
- Upgrade Grafana dependencies to 7.5.4 (#185)
- Update Dashboard to 7.5.4 and add data source variable (#186)
- Update backend dependencies and linting issues (#187)
- Update Documentation (#188)

### Fixed

- Tls client certificates not working (#177)

## [1.3.1] - 2021-02-04

### Added

- Implement CLI-mode similar to Redis-cli #135
- Added support for errorstats features coming in redis 6.2; Extended commandstats fields with failedCalls and rejectedCalls #137
- Add command to support the panel to show the biggest keys (TMSCAN) #133
- Add RedisGears commands (RG.PYSTATS, RG.DUMPREGISTRATIONS, RG.PYEXECUTE) #136
- Implement XRANGE and XREVRANGE commands #148
- Add Client Type tooltip #149
- Add handling different frame type for Streaming data source #152
- Add Redis Graph module (GRAPH.QUERY, GRAPH.SLOWLOG) #157

### Changed

- Add Unit test for Golang Backend #119
- Remove "Unknown command" error from response for custom panels #125
- Update Radix to 3.7.0 and other backend dependencies #128
- Redis client, unit-tests refactoring and new unit-tests. #129
- Refactoring Query Editor #151
- Update tooltip for RedisTimeSeries Label Filter #155
- Update Loading state for Streaming for Grafana 7.4 #158
- Update Grafana SDK 0.86 to fix race conditions #160

### Fixed

- Experiencing memory leak in Grafana docker seemingly stemming from this plugin #116
- All Redis Datasource timeout when one is not reachable #73

## [1.3.0] - 2021-01-05

### Added

- Add RediSearch FT.INFO command #97
- Add HMGET Command #98

### Changed

- HGETALL returns hash fields in a row similar to HGET, HMGET to support streaming. Previously each hash field returned as row.
- Time Bucket for RedisTimeSeries TS.RANGE and TS.MRANGE was updated from string to integer. To fix the dashboard JSON:
  - Search for `"bucket"="X"`
  - Remove quotes
- RedisTimeSeries TS.RANGE command was updated to have legend and value override similar to TS.MRANGE. Previous `legend` defined field's name.
- `key` parameter for command like GET, HGET, SMEMBERS was updated to `keyName` to avoid conflicts. To fix the dashboard JSON:
  - Search for `"key"="X"`
  - Replace to `"keyName"="X"`
- Update description and GitHub issues #83
- Update release workflow #99
- Update Grafana dependencies to 7.3.5 #100
- Update Grafana SDK 0.80.0 #101
- Update data source icon and refactoring #102
- Update field's name for HGET command to align with HMGET #103
- Update HGETALL command to return fields and support streaming similar to HGET, HMGET #104
- Add tests for React Config and Query editors #105
- Remove CircleCI and move to Github Actions #106
- Update Bucket's type (string->number) and add type values for Aggregation and Info sections #108
- Add tests for React Data Source #113
- Update Bucket to Time Bucket in Query Editor #114
- Check if string value is a number when streaming #115
- Add Tests Coverage #117
- Add Empty Array when no values returned similar to redis-cli #120, #121
- Add test data for backend testing #122

### Fixed

- Fix "NOAUTH Authentication required" error with sentinel #109
- Add Value Label to TS.RANGE command similar to TS.MRANGE #110
- Update default configuration parameters for Data Source #111
- Update Key to KeyName to avoid conflict in the Explore tab #112

## [1.2.1] - 2020-10-24

### Added

- Support Connecting to Redis via Unix Socket #58
- Support Redis 6 ACL authentication #60
- Add Streaming for Command Statistics #68
- Add Size parameter for SLOWLOG GET #79

### Changed

- Update Grafana dependencies to 7.2.0 #66
- Update and optimize dashboards for Grafana 7.2.0 #67
- Update GitHub org to RedisGrafana #80

### Fixed

- Plugin health check failed for ARM on Linux #61
- Timeseries data time stamp truncated to seconds #64

## [1.2.0] - 2020-08-26

### Added

- Added docker cmd line option to start in README #31
- How to query a specific database inside the same Redis single node #34
- Add support for TS.GET, TS.INFO, and TS.QUERYINDEX commands #45
- Add Redis dashboard to support multiple Redis instances #49
- Plugin executable missing for arm64 architecture #48 (Grafana SDK: https://github.com/grafana/grafana-plugin-sdk-go/pull/221)
- Add Redis Cluster support and update monitoring dashboard #52
- MRANGE: add fill zero option #53
- Add Streaming capabilities to visualize INFO command #57

### Changed

- Update docker-compose to load datasource from the repository and add development file #39
- Use "ScopedVars" when applying template variables #37 (fix for #36)
- Refactoring to support new commands and modules #42
- Return 0 for all buckets with 0 counts on time-series `TS.RANGE` queries #50
- Connection issue to Redis deployed in k8s (Sentinel) #38

### Fixed

- Slowlog returns 'No data' for Redis 3.0.6 #33
- Fix backend lint issues #41
- ts.mrange returns no data when label has spaces within #44

## [1.1.2] - 2020-07-29

### Added

- Redis Datasource is Unsigned. K8S+Helm installation #29

### Changed

- Remove developer jargon from README #30

## [1.1.1] - 2020-07-28

### Added

- CHANGELOG added to display on the Plugin page

### Changed

- Screenshots added to plugin.json and updated in the README

## [1.1.0] - 2020-07-24

### Added

- Add dashboard as a part of datasource #25
- Add Field config units to the response #26

### Changed

- Updated to Grafana 7.1.0 and the latest version of Radix #27

## [1.0.0] - 2020-07-13

### Added

- Initial release based on Grafana 7.0.5.
- Allows configuring password, TLS, and advanced settings.
- Supports Redis commands: CLIENT LIST, GET, HGET, HGETALL, HKEYS, HLEN, INFO, LLEN, SCARD, SLOWLOG GET, SMEMBERS, TTL, TYPE, XLEN.
- Supports RedisTimeSeries commands: TS.MRANGE, TS.RANGE.
- Provides Redis monitoring dashboard.

[unreleased]: https://github.com/Axiumine/grafana-redis-datasource/compare/v3.0.0...main
[3.0.0]: https://github.com/Axiumine/grafana-redis-datasource/compare/v2.3.0...v3.0.0
[2.3.0]: https://github.com/Axiumine/grafana-redis-datasource/compare/v2.2.1...v2.3.0
[2.2.1]: https://github.com/Axiumine/grafana-redis-datasource/compare/v2.2.0...v2.2.1
[2.2.0]: https://github.com/Axiumine/grafana-redis-datasource/compare/v2.1.2...v2.2.0
[2.1.2]: https://github.com/Axiumine/grafana-redis-datasource/compare/v2.1.1...v2.1.2
[2.1.1]: https://github.com/Axiumine/grafana-redis-datasource/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/Axiumine/grafana-redis-datasource/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/Axiumine/grafana-redis-datasource/compare/v1.5.0...v2.0.0
[1.5.0]: https://github.com/Axiumine/grafana-redis-datasource/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/Axiumine/grafana-redis-datasource/compare/v1.3.1...v1.4.0
[1.3.1]: https://github.com/Axiumine/grafana-redis-datasource/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/Axiumine/grafana-redis-datasource/compare/v1.2.1...v1.3.0
[1.2.1]: https://github.com/Axiumine/grafana-redis-datasource/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/Axiumine/grafana-redis-datasource/compare/v1.1.2...v1.2.0
[1.1.2]: https://github.com/Axiumine/grafana-redis-datasource/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/Axiumine/grafana-redis-datasource/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/Axiumine/grafana-redis-datasource/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Axiumine/grafana-redis-datasource/releases/tag/v1.0.0
