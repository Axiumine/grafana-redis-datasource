# Governance

## Roles

**The maintainer** is Giovanni Manzoni ([giovannimanzoni](https://github.com/giovannimanzoni)),
a member of the [Axiumine organisation](https://github.com/orgs/Axiumine/people) with
write access to this repository. The maintainer reviews and merges pull requests,
triages issues, cuts releases, and answers security reports. The organisation requires
two-factor authentication of every member.

**Contributors** are everyone else who opens an issue, a pull request, or a review.
A contributor who has made sustained, good-quality contributions can be invited to
become a maintainer by a current maintainer, and joins when no other maintainer
objects.

## Decisions

Most decisions are made in pull requests and issues, in the open. A pull request from
a contributor is merged when it passes continuous integration and the maintainer has
approved it.

The project has one maintainer for now, so the maintainer's own changes have no second
reviewer. The checks stand in for one and are strict: type checking, linting, the
frontend tests, the backend tests with a 100% coverage floor, `govulncheck`, the
catalogue's plugin validator, and Qodana, which the pre-commit hook runs before a
commit is made. Continuous integration runs on every push, and a change that turns it
red is fixed or reverted before anything else is merged.

When there are two or more maintainers, a change is merged when a maintainer other
than its author has approved it. A disagreement that the maintainers cannot settle is
decided by majority; when there are only two, the author of the change takes the
discussion to an issue and waits for the other to approve or propose an alternative
rather than merging over an objection.

## Releases

A release is a `vX.Y.Z` tag that matches `package.json`, built and signed by the
Release workflow, and tested in Grafana before it is published. The steps are in
[DEVELOPMENT.md](DEVELOPMENT.md). Release notes come from `CHANGELOG.md`.

## Continuity

A single maintainer is a continuity risk, and this project says so rather than
hiding it. To keep the risk small, everything needed to build, sign and release
lives in the repository or in the organisation's secrets and variables, not on a
personal machine: the workflows, the signing token as `GRAFANA_ACCESS_POLICY_TOKEN`,
and the list of permitted Grafana instances as `GRAFANA_PLUGIN_ROOT_URLS`. A successor
can therefore carry on without access to anyone's computer. If the organisation ever
has no active maintainer, the repository stays public under the Apache-2.0 licence
and anyone may fork it.

## Relationship with upstream

This repository is a fork of
[RedisGrafana/grafana-redis-datasource](https://github.com/RedisGrafana/grafana-redis-datasource).
Changes that are not specific to this fork are offered upstream as pull requests from
a branch of this repository. Nothing is ever pushed to upstream directly.
