# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[unreleased]: https://github.com/Axiumine/grafana-redis-datasource/compare/v2.3.0...local-modifications
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
