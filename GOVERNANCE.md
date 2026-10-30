# Governance

## Roles

**Maintainers** are the members of the
[Axiumine organisation](https://github.com/orgs/Axiumine/people) who have write
access to this repository. They review and merge pull requests, triage issues, cut
releases, and answer security reports. The organisation requires two-factor
authentication of every member.

**Contributors** are everyone else who opens an issue, a pull request, or a review.
A contributor who has made sustained, good-quality contributions can be invited to
become a maintainer by any current maintainer, and joins when no other maintainer
objects.

## Decisions

Most decisions are made in pull requests and issues, in the open. A change is merged
when it passes continuous integration and a maintainer other than its author has
approved it. A disagreement that the people involved cannot settle is decided by the
maintainers by majority; when there are only two, the author of the change takes the
discussion to an issue and waits for the other to approve or propose an alternative
rather than merging over an objection.

## Releases

A release is a `vX.Y.Z` tag that matches `package.json`, built and signed by the
Release workflow, and tested in Grafana before it is published. The steps are in
[DEVELOPMENT.md](DEVELOPMENT.md). Release notes come from `CHANGELOG.md`.

## Continuity

Everything needed to build, sign and release lives in the repository or in the
organisation's secrets and variables, not on a personal machine: the workflows, the
signing token as `GRAFANA_ACCESS_POLICY_TOKEN`, and the list of permitted Grafana
instances as `GRAFANA_PLUGIN_ROOT_URLS`. Any organisation owner can therefore carry
on if another is unavailable. If the organisation ever has no active maintainer, the
repository stays public under the Apache-2.0 licence and anyone may fork it.

## Relationship with upstream

This repository is a fork of
[RedisGrafana/grafana-redis-datasource](https://github.com/RedisGrafana/grafana-redis-datasource).
Changes that are not specific to this fork are offered upstream as pull requests from
a branch of this repository. Nothing is ever pushed to upstream directly.
