# Development

How this fork is built, packaged, signed and installed, and where each step
leaves its output. Upstream's `README.md` describes the plugin itself; this file
describes working on it.

## Prerequisites

| tool       | version                       | note                                                                                      |
| ---------- | ----------------------------- | ----------------------------------------------------------------------------------------- |
| Node.js    | 24, the version `.nvmrc` pins | `package.json` accepts anything from 22 up, CI builds on the pinned one                   |
| Yarn       | 1.x                           | `yarn.lock` is a v1 lockfile                                                              |
| Go         | 1.26.8 or newer               | `go.mod` states the floor, and it is a floor for the toolchain, not only for the language |
| Mage       | any recent release            | builds the backend for all six targets                                                    |
| Docker     | any recent release            | runs Grafana, the Redis under test, and both Qodana linters                               |
| Qodana CLI | any recent release            | only needed to run the pre-commit gate locally                                            |

Go is not on `PATH` in every shell:

```bash
export PATH="/usr/local/go/bin:$HOME/go/bin:$PATH"
```

Enable the hooks once per clone, submodules included — git never activates them
by itself:

```bash
git config core.hooksPath .githooks
```

## Where the output goes

| path                       | contents                                                                                                       | tracked |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- | ------- |
| `dist/`                    | the unpacked plugin: frontend bundle, `plugin.json` with `%VERSION%` substituted, and the six backend binaries | no      |
| `dist/MANIFEST.txt`        | the signature, written by `sign-plugin` and present only after a signing step                                  | no      |
| `artifacts/`               | release zips and their `.md5` files, one pair per packaged tag                                                 | no      |
| `artifacts/extracted/`     | an unpacked artifact, which `docker-compose/signed.yml` mounts                                                 | no      |
| `.qodana/go`, `.qodana/js` | linter results and logs from a local Qodana run                                                                | no      |

All five are in `.gitignore` and none of them is ever committed. The build is
reproducible from a tag, so nothing there needs keeping.

The backend binaries are named after the `executable` field in
`src/plugin.json`, which carries the plugin id, so a build of 3.0.0 or later
produces `dist/axiumine-redis-datasource_linux_amd64` and five siblings, while a
build of 2.3.0 or earlier produces `dist/redis-datasource_linux_amd64`.

## Building

```bash
yarn install          # --frozen-lockfile in CI
yarn build            # frontend, into dist/
mage -v buildAll      # backend, all six release targets, into dist/
```

`mage -l` lists every backend target.

`yarn dev` runs the frontend bundler in watch mode instead. The backend has no
watch mode: re-run `mage -v build:linux` and restart the plugin process.

## Running it

Four Compose files start Grafana, and all four publish it on host port **3854**
rather than 3000:

| file                        | script              | what it mounts                                                | signature                                              |
| --------------------------- | ------------------- | ------------------------------------------------------------- | ------------------------------------------------------ |
| `docker-compose.yml`        | `yarn start`        | `./dist`                                                      | none; sets `GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS` |
| `docker-compose/dev.yml`    | `yarn start:dev`    | `../dist`, plus `../data` for Redis persistence               | none; same allowlist                                   |
| `docker-compose/master.yml` | `yarn start:master` | `../dist`, against Grafana `master`                           | none; same allowlist                                   |
| `docker-compose/signed.yml` | `yarn start:signed` | `../artifacts/extracted/axiumine-redis-datasource`, read-only | **required**; sets no allowlist at all                 |

The first three also publish Redis on host port 6379, so they will fail to start
if something else on the machine already holds it. `signed.yml` does not: its
Redis is reachable from Grafana over the Compose network and nowhere else.

Each file also sets `GF_SERVER_ROOT_URL=http://localhost:3854/`. That is not
cosmetic. Grafana cannot see Docker's port mapping, so `root_url` would
otherwise resolve to `http://localhost:3000/` through its own defaults, and a
signature issued for port 3854 would not match it.

After a frontend rebuild Grafana picks up the new bundle on reload. After a
backend rebuild the running plugin process has to go:

```bash
yarn restart:docker:plugin   # docker exec -it grafana pkill -f axiumine-redis-datasource
```

## Checks

```bash
go build ./... && go vet ./pkg/... && go test ./pkg/...
mage -v lint && mage cover                       # backend lint and coverage report
yarn test:ci                                     # frontend tests with coverage
yarn typecheck                                   # tsc --noEmit
yarn lint
./node_modules/.bin/prettier --check <files>     # the repo's own prettier, never a global one
govulncheck ./pkg/...
govulncheck -mode binary dist/axiumine-redis-datasource_linux_amd64
```

Qodana is two runs, because one run analyses one linter image, and both need an
Ultimate or Ultimate Plus licence:

```bash
qodana scan --config qodana-go.yaml --results-dir .qodana/go
qodana scan --config qodana-js.yaml --results-dir .qodana/js
```

`.githooks/pre-commit` runs both over the working tree and rejects the commit
when the gate fails. It is slow, since each linter is a separate Docker image:
narrow it with `QODANA_LINTERS=go`, or bypass it with `SKIP_QODANA=1` when the
failure is not the commit's to fix. Without a `QODANA_TOKEN` it skips loudly
rather than blocking.

## Packaging a release

Packaging always builds from a tag's own tree, never from the working tree, so a
package cannot contain uncommitted work:

```bash
./tools/package-tag.sh v3.0.0     # one tag
./tools/package-tag.sh            # every fork-authored tag
```

The script adds a detached worktree at the tag, selects Node 16 for tags
predating the `@grafana/create-plugin` migration and `.nvmrc` for the rest, runs
`yarn build` and `mage -v buildAll`, signs `dist/`, renames `dist` to the plugin
id read out of **that tag's** `src/plugin.json`, zips it and writes the `.md5`
beside it. Whether it signs is decided per tag, from that same id. It refuses tags inherited from upstream, which are mirrored under
`refs/upstream-tags/`; packaging one would ship RedisGrafana's build under our
name.

The result is `artifacts/<plugin id>-<version>.zip` plus
`artifacts/<plugin id>-<version>.zip.md5`, and because the id comes from the
tag, `v3.0.0` produces `axiumine-redis-datasource-3.0.0.zip` while `v2.3.0`
produces `redis-datasource-2.3.0.zip`.

The script pushes nothing and creates no release. Publishing is a deliberate
second step.

### Signing

Signing reads two values from `.env`, which `.gitignore` excludes and which must
stay untracked:

| variable                      | purpose                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `GRAFANA_ACCESS_POLICY_TOKEN` | the grafana.com access policy token that signs the build. A secret             |
| `GRAFANA_PLUGIN_ROOT_URLS`    | comma-separated list of the Grafana instances allowed to load it. Not a secret |

Neither is ever written into a tracked file, a workflow, a commit message or a
release note. `QODANA_TOKEN` lives in the same file for the linters.

This fork is not in Grafana's catalogue, so the access policy issues a
**private** signature, which is bound to specific instances. The current list
covers the Compose instance and the LAN one:

```
GRAFANA_PLUGIN_ROOT_URLS="http://localhost:3854/,https://grafana.gio.lan/"
```

Each entry must equal that instance's `root_url` from `grafana.ini`, trailing
slash included. Grafana compares the manifest's `rootUrls` against its own
configured `root_url` — never against the address in the browser — matching
scheme, host, port and cleaned path by string equality. A mismatch is recorded
as `SignatureStatusInvalid`, and `allow_loading_unsigned_plugins` rescues only
`SignatureStatusUnsigned`, so a signature bound to the wrong URL is worse than
no signature: the plugin is dropped and no setting brings it back. The log line
that says so is "Could not find root URL that matches running application URL".

Adding an instance means adding it to the list and re-signing. The signature is
a file inside the zip, so re-signing is a rebuild and nothing more.

A tag whose id cannot be signed is built unsigned without being asked to.
grafana.com issues a signature only when the first segment of the plugin id
names the organisation behind the access policy, so `v2.3.0`, whose tree still
carries `redis-datasource`, is unsignable under this organisation and the script
says so and carries on. It compares against the first segment of the id in the
working tree — `axiumine` — rather than a hardcoded name, and
`GRAFANA_PLUGIN_SIGNING_ORG` overrides that if the fork is ever signed by a
second organisation. The same check decides the preflight: a run that will sign
nothing does not demand the signing variables it would never use.

Such a build is an archive, not a release. Grafana 12 loads it only where
`grafana.ini` names it in `allow_loading_unsigned_plugins`.

`ALLOW_UNSIGNED=1 ./tools/package-tag.sh vX.Y.Z` forces the same treatment on a
tag that could have been signed. That is for local debugging, never for a
release: passing it on a no-argument run strips the signature from every tag
that had earned one.

## Verifying an artifact before it leaves the machine

```bash
unzip -o artifacts/axiumine-redis-datasource-3.0.0.zip -d artifacts/extracted
yarn start:signed
curl -s http://localhost:3854/api/plugins/axiumine-redis-datasource/settings
```

`signed.yml` sets no `allow_loading_unsigned_plugins`, so the plugin loads only
if the signature holds. The settings endpoint should report `"signature":
"valid"`, `"signatureType": "private"` and the signing organisation. The Grafana
log line to look for is "Plugin signature valid"; the file raises the signature
logger to debug so both outcomes are visible.

The datasource provisioned from `provisioning/datasources/redis.yaml` points at
`redis://redis:6379`, the Redis service of whichever Compose file mounted that
directory, so it works the same on every host.

## Installing into a Grafana that is not Compose

Unpack the zip into the plugins path and restart Grafana. The directory name has
to be the plugin id, which is what the zip's own top-level directory already is:

```bash
unzip -o axiumine-redis-datasource-3.0.0.zip -d /var/lib/grafana/plugins/
```

The instance's `root_url` must be one of the URLs the artifact was signed for.
For the LAN instance that means `grafana.ini` carries:

```ini
[server]
root_url = https://grafana.gio.lan/
```

Left at its default, `root_url` interpolates `protocol`, `domain` and
`http_port` into `http://localhost:3000/`, which no signature of ours matches.

A private signature is also why nobody else can install this fork: Grafana's
terms say private plugins may not be shared with the community or with customers
and are not published in the catalogue, and they do not run on Grafana Cloud at
all. The way out is a **community** signature, which takes no `rootUrls` and
installs anywhere. It requires a catalogue submission — a public repository, an
approved licence, and a review that includes a code read and an install test —
and an id whose first segment is the organisation, which is what the 3.0.0
rename bought.

## Releasing

1. Bump `package.json` and close the `[Unreleased]` section of `CHANGELOG.md`
   under a `## [X.Y.Z] - YYYY-MM-DD` heading with its compare link at the foot.
   `src/plugin.json` needs nothing; it carries `%VERSION%`.
2. Commit, then tag: `git tag -a vX.Y.Z -m "..."`, matching `package.json`.
3. `./tools/package-tag.sh vX.Y.Z`.
4. Install the artifact and exercise it, as above.
5. Only then publish, either by pushing the tag so the Release workflow picks it
   up or by uploading the zip and its `.md5` by hand.
