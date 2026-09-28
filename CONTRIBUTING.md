# Contributing to VSRepository

🇺🇸 English | [🇧🇷 Português](./CONTRIBUTING.pt-BR.md)

Contributions are very welcome — especially adapters, bug reports and documentation. This repository is the **ORM-agnostic core**; knowing which half your change belongs to is the fastest way to get it merged.

- **Setting up the repo and the key scripts** → [Setting up](#setting-up) and [Scripts](#scripts)
- **Which ORM adapters exist today** → [Adapter status](./docs/adapters.md)

## Setting up

| Tool       | Version |
| ---------- | ------- |
| Node.js    | 18+     |
| Bun        | latest  |
| TypeScript | 6.x     |

```bash
bun install
```

## Scripts

| Script                    | What it does                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `bun run full-validation` | `typecheck` + `lint` + `format:check` + `test` — the gate to run before opening a PR.                               |
| `bun run build`           | `clean` + `tsc -p tsconfig.build.json` — compiles `src/` into `dist/` with `rootDir: src`, emitting JS and `.d.ts`. |
| `bun run test`            | `test:typing` and then `test:implementation`, in that order.                                                        |
| `bun run typecheck`       | `tsc --noEmit -p tsconfig.build.json` — type validation.                                                            |
| `bun run lint`            | `oxlint --type-aware src/ test/`.                                                                                   |
| `bun run format:check`    | Prettier in check mode over `src/**/*.ts` and `test/**/*.ts`.                                                       |

The two test suites also run on their own — `test:typing` (compile-time assertions) and `test:implementation` (runtime behaviour against a fake adapter), with `test:implementation:watch` for watch mode. Every other script (`format`, `clean`, `prepack`) is in [`package.json`](./package.json).

```bash
bun run full-validation
```

## Scope: the core vs. an adapter

This is the single most important thing to get right before opening an Issue or a PR.

| Your change belongs in… | When                                                                                                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **core (`vsrepo`)**     | The repository class, the `@DynamicMethod`/`@QueryMethod` decorators, the name-parsing engine, the query builders, transactions, soft-delete, error handling, logging, and the `VSRepoAdapter` contract itself. |
| **adapter**             | Anything ORM-specific: translating a `VSRepoWhere` into a Prisma `where`/`include`, mapping driver errors, the placeholder syntax, `runInTransaction`.                                                          |

The core **never imports an ORM**. Support for Prisma 7 and Drizzle ships as separate packages precisely so the core can stay ORM-agnostic:

- [Writing your own adapter](./docs/writing-an-adapter.md) — the contract, method by method
- [Publishing an adapter](./docs/writing-an-adapter.md#publishing-an-adapter) — publishing your own under any scope, and the checklist for an official `@vsrepo/*-adapter`

You never need permission to publish an adapter under a name you control. Getting one published under the `@vsrepo` scope is a separate, gated step: open an issue with your repository link, and after your repository is approved for publication on npm, open a PR adding a row to the table in [`docs/adapters.md`](./docs/adapters.md) (and its `.pt-BR.md` counterpart).

## Reporting a bug

Open an **Issue** first.

1. Versions of VSRepository, the adapter, the ORM, and Node.
2. What you expected, and what happened instead.
3. A minimal reproduction: the repository class, the adapter, and the call that misbehaves.
4. The full error, including the stack and any `VSRepoError`/`AdapterErrorCode`.

## Requesting a feature

Open an **Issue** describing the functionality and use cases.

## Submitting a pull request

1. **Fork** the project and clone your fork.
2. **Create a branch** off `main`, named after the change.
3. **Make the change.** Keep the commit history readable — [Conventional Commits](https://www.conventionalcommits.org/), with the description written in Portuguese, as the rest of the history is.
4. **Run the full gate locally**: `bun run full-validation` (typecheck + lint + format:check + tests). CI runs the same checks, plus the build.
5. **Push** the branch and open a **Pull Request** against `main`.

A good PR description answers:

- **What** changed and **why** — the problem, not just the diff.
- **How** you verified it — which tests were added, what you ran.
- **Whether it breaks anything** — a new required adapter method, a changed return type, a renamed option, a validation that now throws where it previously didn't.
- **Both languages** — if you touched `docs/`, the English and the Portuguese version changed together, in the same PR. A guide is `foo.md` + `foo.pt-BR.md`.
- **A `CHANGELOG.md` entry**, if the change is user-facing. Documentation-only and internal changes don't need one.

## Review

Every PR runs the full CI suite before it can be merged, and every PR gets a review.

## Code of conduct

Be respectful and assume good faith. Reviews are about the code, not the person who wrote it. Harassment or personal attacks of any kind are not tolerated in issues, PRs, or discussions.

## Reporting a security issue

Please don't open a public issue for a vulnerability. Report it privately to [joaodev.azevedo@outlook.com](mailto:joaodev.azevedo@outlook.com) so a fix can be prepared before the details are public.

---

## Repository layout

```text
src/
  index.ts           # public entry point — the single `vsrepo` export surface
  VSRepository.ts    # the repository class: base methods, transactions
  VSRepoAdapter.ts   # the abstract adapter contract every ORM integration implements
  decorators/        # @DynamicMethod and @QueryMethod
  errors/            # VSRepoError and VSRepoAdapterError
  internal/          # metadata keys, enums, the name parser, loggers, query builders, VSSql
  types/             # types
test/
  implementation/    # Jest — runtime behaviour, against a fake adapter
  typing/            # tsc --noEmit only — compile-time assertions
  helpers/           # fake adapter, entities, example repositories
docs/                # the bilingual documentation
```

`src/index.ts` is the only public surface: anything not re-exported from it is internal.

## Conventions

- **Decorators** — the library uses legacy/experimental decorators. `experimentalDecorators: true` is set in `tsconfig.json` and is required by `@DynamicMethod`/`@QueryMethod`.
- **Formatting** — Prettier (see [.prettierrc](./.prettierrc)).
- **Lint** — oxlint (see [.oxlintrc.json](./.oxlintrc.json)).
- **Commits** — [Conventional Commits](https://www.conventionalcommits.org/), with the description written in Portuguese: `feat:`, `fix(scope):`, `docs:`, `test:`, `build:`, `ci:`, `style:`, `chore:`, and `version: X.Y.Z` for the release bump.
- **Docs** — every guide exists in English and Portuguese (`foo.md` / `foo.pt-BR.md`), and a change to one is a change to both.

## Building and consuming locally

```bash
# Produce the installable tarball (prepack -> bun run build runs automatically)
npm pack

# Consume it from another project
npm install ../path/to/vsrepo-*.tgz
```

This is the loop an adapter author wants: build the core locally, pack it, and install the tarball in a scratch project to check the adapter against the current core.

## CI

`.github/workflows/ci.yml` runs on every push and pull request to `main`, with `concurrency` cancelling any in-flight run for the same ref. Three jobs, all on `ubuntu-latest` with Bun:

| Job     | Runs                                                 | Depends on     |
| ------- | ---------------------------------------------------- | -------------- |
| `lint`  | `bun run lint` and `bun run format:check`            | —              |
| `test`  | `bun run test` (typing + implementation)             | —              |
| `build` | `bun run build`, then uploads `dist/` as an artifact | `lint`, `test` |
