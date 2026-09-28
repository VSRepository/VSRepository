<a id="top"></a>

🇺🇸 English | [🇧🇷 Português](./adapters.pt-BR.md)

[← Back to the table of contents](./README.md)

# Adapter status

VSRepository is **ORM-agnostic by design**. The core package (`vsrepo`) only ships the repository class, the decorators, the name-parsing engine, the query builders and logging — it does **not** ship a production adapter. Actual ORM/database support is meant to live in **separate, independently versioned packages**, one per ORM (and, where it makes sense, one per major ORM version), for example:

- `@vsrepo/prisma7-adapter`
- `@vsrepo/prisma8-adapter`
- `@vsrepo/typeorm-adapter`
- `@vsrepo/drizzle-adapter`

Because each adapter is versioned on its own, it can follow its ORM's release cycle without forcing a new major on the core, and a breaking change in one ORM never leaks into repositories built for another.

| Adapter                              | Status                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma 7 (`@vsrepo/prisma7-adapter`) | 🟢 **Released** — published to npm, implements the `VSRepoAdapter` contract (CRUD, relations, transactions, `merge`, logging, etc.) with tests; see [`VSRepoPrisma7Adapter`](https://github.com/jaobrabo123/VSRepoPrisma7Adapter) for source and docs.                                                                                  |
| Drizzle (`@vsrepo/drizzle-adapter`)  | 🔵 **Alpha** — an early release is available on npm; install it with `npm i @vsrepo/drizzle-adapter@alpha`. The API may still change before the stable release. Check the [`DrizzleAdapter`](https://github.com/jaobrabo123/VSRepoDrizzleAdapter) repository for the current status and known limitations, and feel free to contribute. |
| Other ORMs (Prisma 8, TypeORM, etc.) | 🟡 **Planned, not published yet.** Write your own adapter for now (see [Writing your own adapter](#writing-your-own-adapter)), and consider publishing/contributing it back.                                                                                                                           |
| Custom adapters                      | 🟢 Fully supported today — implement the [`VSRepoAdapter`](./writing-an-adapter.md#the-vsrepoadapter-contract) abstract class yourself for any ORM/database you need, in your own project or package.                                                                                                                                   |

## Installing an adapter

An adapter is an ordinary npm package. Install the core plus the one that matches your ORM:

```bash
npm i vsrepo @vsrepo/prisma7-adapter
```

Prerelease adapters are installed through a dist-tag, so your lockfile pins the alpha build instead of resolving to `latest` later:

```bash
npm i @vsrepo/drizzle-adapter@alpha
```

## Writing your own adapter

You never have to wait for an official package: `VSRepoAdapter` is a plain abstract class, and implementing it is the officially supported extension point.

- **[Writing your own adapter](./writing-an-adapter.md)** — the full walkthrough: what you're implementing, the `VSRepoAdapter` contract, the optional `getPkName()`/`getPlaceholder()` hooks, and how to log from your adapter in the same format as the core.
- **[Base methods, configuration & soft-delete](./base-methods.md#writing-an-adapter)** — how the 8 atomic/aggregate operations are expected to behave on your ORM, and what an adapter must return for them.
- **[Transactions](./transactions.md)** — what `runInTransaction()` has to give back so `transaction()`.

## Publishing an adapter

You can publish your own adapter under any name and scope you control. Becoming an **official** `@vsrepo/*-adapter` is a different story: it goes through a validation checklist.

Both paths in full — the recommendations for your own package, the checklist, and how npm publishing access is granted: [Writing your own adapter → Publishing an adapter](./writing-an-adapter.md#publishing-an-adapter).

Read [CONTRIBUTING.md](../CONTRIBUTING.md) for the full contribution flow, and keep documentation changes in both English and Portuguese.

[⬆️ Back to top](#top)
