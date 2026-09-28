<div align="center">
  <img src="https://res.cloudinary.com/ddbfifdxd/image/upload/w_200,q_auto,f_auto/v1786386427/VS_logo_TextoAbaixo_yev4tq.png" alt="VSRepository Logo" width="200"/>

  <p style="margin-top: 12px;">
    <img src="https://img.shields.io/npm/v/vsrepo?style=flat-square" alt="npm version"/>
    <img src="https://img.shields.io/npm/l/vsrepo?style=flat-square" alt="npm license"/>
    <img src="https://img.shields.io/npm/dt/vsrepo?style=flat-square" alt="npm downloads"/>
    <img src="https://img.shields.io/badge/inspired%20by-JpaRepository-E73121?style=flat-square" alt="inspired by JpaRepository"/>
  </p>
</div>

# VSRepository

🇺🇸 You're reading the English version. [🇧🇷 Ler em português](./README.pt-BR.md)

**ORM-agnostic** repository pattern library, with full **TypeScript** support. The core delegates every operation to a pluggable **adapter**, so the same repository API can work against Prisma, Drizzle, or any other ORM/database that implements the adapter contract. Coming from the old [v1](https://github.com/jaobrabo123/VSRepository/tree/v1)? See [Migrating from v1](./docs/migrating-from-v1.md).

VSRepository lets you create strongly-typed repositories with:

- Automatic **base methods**: `get`, `getOrThrow`, `getList`, `save`, `saveList`, `remove`, `removeList`, `patch`, `merge`, `getAll`, `total`, `has`
- **Native soft-delete**: `softRemove`, `softRemoveList`, `restore`, `restoreList`
- **Dynamic methods** inferred from a `declare` field name via the `@DynamicMethod` decorator: `findOneByEmail`, `findByStatusPaginated`, `updateById`
- **Raw SQL query methods** via the `@QueryMethod` decorator (bypassing the name-parsing engine entirely), parameterized `VSSql` fragments for ad-hoc `query()` calls, and agnostic `?1`, `?2` placeholders with `vsPlaceholders`
- Ad-hoc **`select`/`relations`** per call
- Strong **TypeScript** typing across the repository API
- Native ORM **transactions**, shared across repositories
- An **ORM-agnostic core** — the same repository class works with any `VSRepoAdapter` implementation

---

## Installation

VSRepository is installed as the core package plus one adapter package for your ORM, for example:

```bash
npm i vsrepo @vsrepo/prisma7-adapter
```

---

## Basic usage

### Creating a repository

```typescript
// src/repositories/user.repository.ts
import { VSRepository, DynamicMethod } from "vsrepo";
import { Prisma7Adapter } from "@vsrepo/prisma7-adapter";
import prisma from "../configs/db";
import type { UserGetPayload } from "../../generated/prisma/models";

type User = UserGetPayload<{ include: { address: true } }>;

class UserRepository extends VSRepository<User, string> {
    constructor() {
        super({
            adapter: new Prisma7Adapter(prisma, { tableName: "user", pkName: "id" }),
            softRemoveKey: "deletedAt",
            defaultOrdering: { createdAt: "desc" },
        });
    }

    @DynamicMethod()
    declare findByEmail: (email: string) => Promise<User[]>;

    @DynamicMethod()
    declare findOneByEmail: (email: string) => Promise<User | null>;
}

export default new UserRepository();
```

> The core API (`VSRepository`, `VSRepoAdapter`, `DynamicMethod`, `QueryMethod`, `VSRepoError`, enums and types) is imported from the single `vsrepo` entry point. The concrete adapter comes from a **separate** package (`@vsrepo/*-adapter`). On Prisma 7, install the [`@vsrepo/prisma7-adapter`](https://github.com/jaobrabo123/VSRepoPrisma7Adapter).

### Using the repository

```typescript
import userRepository from "./repositories/user.repository";

const user = await userRepository.save({
    name: "Joao",
    email: "joao@email.com",
    password: "password",
});

const found = await userRepository.get(user.id);
const all = await userRepository.getAll();
const byEmail = await userRepository.findByEmail("joao@email.com");

await userRepository.patch(user.id, { name: "Joao Pedro" });
await userRepository.remove(user.id);
```

---

## Documentation

The sections above (installation, basic usage) are the essentials to get you started. Everything about a specific feature — with more detail and more examples — lives in its own guide under [`docs/`](./docs/README.md), each available in English and in [Português](./docs/README.pt-BR.md):

### Guides

| Guide                                                               | Covers                                                                                                                                                                |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Adapter status](./docs/adapters.md)                                | Which ORM adapters exist today, what "ORM-agnostic by design" means in practice, and how to install, write or publish your own.                                       |
| [Base methods, configuration & soft-delete](./docs/base-methods.md) | Constructor options, the 12 automatic CRUD methods, native soft-delete, and the 8 atomic/aggregate methods (`increment`, `sum`, ...).                                 |
| [`select` and `relations`](./docs/select-and-relations.md)          | Ad-hoc field selection and eager relation loading on any call, and `InferMethodReturn` to narrow the return type accordingly.                                         |
| [Dynamic methods](./docs/dynamic-methods.md)                        | `findByEmail`-style methods parsed from a `declare`d method name: prefixes, field filters, logical operators, relation filters, ordering/pagination/distinct.         |
| [Query methods (raw SQL)](./docs/query-methods.md)                  | Raw SQL via `@QueryMethod`, parameterized `VSSql` fragments and the agnostic `?1`/`?2` placeholders (`vsPlaceholders`).                                               |
| [Query builder](./docs/query-builder.md)                            | The fluent `createQueryBuilder()` API for queries assembled at runtime, including pagination, soft-delete visibility and transactions.                                |
| [Raw query builder](./docs/raw-query-builder.md)                    | The fluent `createRawQueryBuilder()` API for hand-written `SELECT` queries too SQL-specific for the query builder — joins, subqueries, CTEs (`with`/`withRecursive`). |
| [Transactions](./docs/transactions.md)                              | Running several repositories against the same native ORM transaction.                                                                                                 |
| [Utility types](./docs/utility-types.md)                            | The exported helper types (`InferMethodType`, `InferMethodReturn`, `KeysOfType`, ...) and where each one is used.                                                     |
| [Writing your own adapter](./docs/writing-an-adapter.md)            | What an adapter is responsible for, and how to implement the `VSRepoAdapter` contract for a new ORM or database.                                                      |
| [Error handling](./docs/error-handling.md)                          | `VSRepoError`, `VSRepoErrorType`, and `VSRepoAdapterError`/`AdapterErrorCode`.                                                                                        |
| [Logging](./docs/logging.md)                                        | `logLevel`, `logSlowThresholdMs`, and the log format used by the repository and the query builder.                                                                    |
| [Contributing](./CONTRIBUTING.md)                                   | Repository layout, the key scripts, conventions and CI — plus the contribution flow itself (issues, pull requests, review).                                           |
| [Migrating from v1](./docs/migrating-from-v1.md)                    | Everything that changed between v1 and v2 — API, config, renamed suffixes, removed features — in a single reference for migrating existing repositories.              |

---

## Adapter status

VSRepository is **ORM-agnostic by design**: the core package (`vsrepo`) ships only the repository class, the decorators, the name-parsing engine, error handling and logging — no production adapter. ORM support lives in separate, independently versioned `@vsrepo/*-adapter` packages, so each one can follow its own ORM's release cycle.

| Adapter                              | Status                                                                                                                                       |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma 7 (`@vsrepo/prisma7-adapter`) | 🟢 **Released** — published to npm, with tests. [Source and docs](https://github.com/jaobrabo123/VSRepoPrisma7Adapter).                      |
| Drizzle (`@vsrepo/drizzle-adapter`)  | 🔵 **Alpha** — `npm i @vsrepo/drizzle-adapter@alpha`. The API may still change. [Repo](https://github.com/jaobrabo123/VSRepoDrizzleAdapter). |
| Other ORMs (Prisma 8, TypeORM, etc.) | 🟡 **Planned, not published yet.** Write your own in the meantime — it's fully supported.                                                    |
| Custom adapters                      | 🟢 Fully supported — implement `VSRepoAdapter` yourself, in your own project or package.                                                     |

The full status and how to install each one: [Adapter status](./docs/adapters.md). To publish your own, see [Publishing your own adapter](./docs/writing-an-adapter.md#publishing-your-own-adapter).

---

## Requirements

- Node.js 18+
- TypeScript, with **legacy/experimental decorators** enabled (required by `@DynamicMethod`/`@QueryMethod`):

```json
{
    "compilerOptions": {
        "experimentalDecorators": true
    }
}
```

- `reflect-metadata` (bundled as a dependency, imported internally — you don't need to import it yourself)
- At least one working `VSRepoAdapter` for your database — on Prisma 7, install the published [`@vsrepo/prisma7-adapter`](https://github.com/jaobrabo123/VSRepoPrisma7Adapter) (see [Adapter status](#adapter-status))

---

## Contributing

Contributions are welcome — adapters, bug reports and documentation alike. The core is ORM-agnostic, so ORM-specific work belongs in your own adapter package; see the scope rules before opening a PR.

- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — how to report a bug, request a feature, and submit a pull request.
