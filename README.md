# Redis Data Source for Grafana

![Dashboard](https://raw.githubusercontent.com/RedisGrafana/grafana-redis-datasource/master/src/img/redis-dashboard.png)

[![Grafana 12](https://img.shields.io/badge/Grafana-12-orange)](https://www.grafana.com)
[![Redis Data Source](https://img.shields.io/badge/dynamic/json?color=blue&label=Redis%20Data%20Source&query=%24.version&url=https%3A%2F%2Fgrafana.com%2Fapi%2Fplugins%2Fredis-datasource)](https://grafana.com/grafana/plugins/redis-datasource)
[![Redis Application plugin](https://img.shields.io/badge/dynamic/json?color=blue&label=Redis%20Application%20plugin&query=%24.version&url=https%3A%2F%2Fgrafana.com%2Fapi%2Fplugins%2Fredis-app)](https://grafana.com/grafana/plugins/redis-app)
[![Redis Explorer plugin](https://img.shields.io/badge/dynamic/json?color=blue&label=Redis%20Explorer%20plugin&query=%24.version&url=https%3A%2F%2Fgrafana.com%2Fapi%2Fplugins%2Fredis-explorer-app)](https://grafana.com/grafana/plugins/redis-explorer-app)
[![Go Report Card](https://goreportcard.com/badge/github.com/RedisGrafana/grafana-redis-datasource)](https://goreportcard.com/report/github.com/RedisGrafana/grafana-redis-datasource)
[![CI](https://github.com/Axiumine/grafana-redis-datasource/actions/workflows/ci.yml/badge.svg)](https://github.com/Axiumine/grafana-redis-datasource/actions/workflows/ci.yml)

> **This is a fork.**
>
> Upstream is [RedisGrafana/grafana-redis-datasource](https://github.com/RedisGrafana/grafana-redis-datasource),
> Apache-2.0, forked at `09df07a` (2.2.1). This fork adds the server data Redis
> grew between 6.2 and 8.10: the new `INFO` sections as typed frames, `HOTKEYS GET`,
> the `SLOWLOG GET` argument count, and a time field on streamed replies. It also
> fixes `CLUSTER NODES` slot and timestamp parsing.
>
> This fork requires **Grafana 12.0+**, and **Node.js 22+** to build the frontend.
> Continuous integration builds on the version pinned in `.nvmrc`. The requirements
> listed further down are upstream's, and describe its own 2.X and 1.X releases
> rather than this fork.
>
> See [CHANGELOG.md](CHANGELOG.md) entry **2.3.0** for the full list, and
> [NOTICE](NOTICE) for attribution. The plugin id is unchanged (`redis-datasource`),
> so it is a drop-in replacement for the catalogue build. Bugs in the fork belong in
> [this repository's issues](https://github.com/Axiumine/grafana-redis-datasource/issues);
> the links below point at upstream's.
>
> Built for [Axiumine/grafana-redis-dashboard](https://github.com/Axiumine/grafana-redis-dashboard).
> Everything below this line is upstream's README, with one deletion: the demo
> section is gone, because Volkov Labs discontinued its Grafana plugins and the
> site those links pointed at now serves the closure notice instead.

---

## Introduction

The Redis Data Source for Grafana is a plugin that allows users to connect to any Redis database On-Premises and in the Cloud. It provides out-of-the-box predefined dashboards and lets you build customized dashboards to monitor Redis and application data.

### Requirements

- **Grafana 8.0+** is required for Redis Data Source 2.X.
- **Grafana 7.1+** is required for Redis Data Source 1.X.

### Redis Application plugin

You can add as many data sources as you want to support multiple Redis databases. [Redis Application plugin](https://grafana.com/grafana/plugins/redis-app) helps manage various Redis Data Sources and provides Custom panels.

## Getting Started

Redis Data Source can be installed from the Grafana Marketplace or use the `grafana-cli` tool to install from the command line:

```bash
grafana-cli plugins install redis-datasource
```

![Grafana Marketplace](https://raw.githubusercontent.com/RedisGrafana/grafana-redis-datasource/master/src/img/grafana-marketplace.png)

For Docker instructions and installation without Internet access, follow the [Quickstart](https://redisgrafana.github.io/quickstart/) page.

### Configuration

Data Source allows to connect to Redis using TCP port, Unix socket, Cluster, Sentinel and supports SSL/TLS authentication. For detailed information, take a look at the [Configuration](https://redisgrafana.github.io/redis-datasource/configuration/) page.

![Datasource](https://raw.githubusercontent.com/RedisGrafana/grafana-redis-datasource/master/src/img/datasource.png)

## Documentation

Please take a look at the [Documentation](https://redisgrafana.github.io/redis-datasource/overview/) to learn more about plugin and features.

### Supported commands

List of all supported commands and how to use them with examples you can find in the [Commands](https://redisgrafana.github.io/redis-datasource/commands/) section.

![Query](https://raw.githubusercontent.com/RedisGrafana/grafana-redis-datasource/master/src/img/query.png)

## Development

[Developing Redis Data Source](https://redisgrafana.github.io/development/redis-datasource/) page provides instructions on building the data source.

Are you interested in the latest features and updates? Start nightly built [Docker image for Redis Application plugin](https://redisgrafana.github.io/development/images/), including Redis Data Source.

## Feedback

We love to hear from users, developers, and the whole community interested in this plugin. These are various ways to get in touch with us:

- Ask a question, request a new feature, and file a bug with [GitHub issues](https://github.com/RedisGrafana/grafana-redis-datasource/issues/new/choose).
- Star the repository to show your support.

## Contributing

- Fork the repository.
- Find an issue to work on and submit a pull request.
- Could not find an issue? Look for documentation, bugs, typos, and missing features.

## License

- Apache License Version 2.0, see [LICENSE](https://github.com/RedisGrafana/grafana-redis-datasource/blob/master/LICENSE).
