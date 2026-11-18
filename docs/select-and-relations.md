<a id="top"></a>

🇺🇸 English | [🇧🇷 Português](./select-and-relations.pt-BR.md)

[← Back to the table of contents](./README.md)

# `select` and `relations`

You pass `select` and `relations` directly on each call:

```typescript
const user = await userRepository.get(id, {
    select: { id: true, name: true, address: { city: true } },
});

const userWithAddress = await userRepository.get(id, {
    relations: { address: true },
});
```

- `select` mirrors the entity's shape: scalar fields take a `boolean`; relation fields take a `boolean` or a nested `select`.
- `relations` eagerly loads related records; each relation field takes a `boolean` or a nested `relations` object.
- `relationsOptions` filters, orders and paginates the related records that `select`/`relations` load (see [below](#filtering-ordering-and-paginating-relations-with-relationsoptions)).
- Whether `select` and `relations` can be combined depends on the adapter (see below).

> [!WARNING]
>
> **Adapter-dependent behavior for `relations`:**
>
> The core only forwards `MethodOptions.select`, `MethodOptions.relations` and `MethodOptions.relationsOptions` to the adapter — each adapter decides how to translate them to the underlying ORM:
>
> - **Prisma 7 (`@vsrepo/prisma7-adapter` / `VSRepoPrisma7Adapter`)** — `relations` is converted to Prisma `include` (`parsePrismaInclude`). **If `select` is present, `relations` is ignored** because Prisma does not allow `select` + `include` in the same query:
>
>     ```typescript
>     // Prisma7: relations is ignored when select exists
>     await userRepository.get(id, {
>         select: { id: true, name: true },
>         relations: { address: true }, // ← ignored, include = undefined
>     });
>     ```
>
> - **Drizzle (`@vsrepo/drizzle-adapter` / `VSRepoDrizzleAdapter`, currently in alpha)** — `select` is converted to Drizzle's `columns` and `relations` to `with`. **If `select` is present, `relations` is ignored** (just like Prisma), but relation fields inside `select` itself are automatically moved into `with`:
>     ```typescript
>     // Drizzle: relations is ignored when select exists
>     await userRepository.get(id, {
>         select: { id: true, name: true, address: { city: true } }, // address goes into `with`
>         relations: { posts: true }, // ← ignored
>     });
>     ```
>     The details (such as how relations marked `true` inside `select` are recognized) and the known limitations are in the [`VSRepoDrizzleAdapter`](https://github.com/jaobrabo123/VSRepoDrizzleAdapter) documentation, which is the official reference. Since the adapter is still in alpha, this behavior may change.
>
> Custom adapters may map `relations` differently — consult the adapter's documentation for the exact semantics.

## Filtering, ordering and paginating relations with `relationsOptions`

`select` and `relations` decide **which** relations are loaded. `relationsOptions` decides **which records** of those relations come back: filtered with `where`, sorted with `order` and paginated with `pagination`, using the same shapes as at the top level of the call.

```typescript
const user = await userRepository.get(id, {
    relations: { posts: { comments: true }, address: true },
    relationsOptions: {
        posts: {
            where: { published: true },
            order: { createdAt: "desc" },
            pagination: { limit: 10 },
            relationsOptions: { comments: { pagination: { limit: 5 } } },
        },
    },
});
```

Each key of `relationsOptions` is a relation field of the entity, and the accepted keys depend on the kind of relation:

| Relation                                                           | Accepted keys                                         |
| ------------------------------------------------------------------ | ----------------------------------------------------- |
| To-many (`one-to-many`, `many-to-many`)                            | `where`, `order`, `pagination` and `relationsOptions` |
| To-one that can be `null`/`undefined` (`profile: Profile \| null`) | `where` and `relationsOptions`                        |
| Required to-one (`author: User`)                                   | `relationsOptions`                                    |

- The nested `relationsOptions` has the same shape one level down, for the relations of the relation (`posts.comments` in the example above).
- `where` filters the **loaded** records, not the parent ones: `{ posts: { where: { published: true } } }` still returns every user, each one with only their published posts. To filter the users by their posts, use the `_some`/`_every`/`_none` operators in the top-level `where` (see [relation filters](./dynamic-methods.md#relation-filters)). Both can be combined.
- `pagination` applies **per parent record**: `limit: 10` brings up to 10 posts for each user, not 10 posts in total.
- It works the same for relations loaded through `relations` and through `select`.
- It only configures a relation, it doesn't load it: an entry for a relation that isn't in `select`/`relations` has no effect.
- It doesn't change the return type, since it only changes which records are loaded — `InferMethodReturn` and `InferMethodType` keep looking only at `select` and `relations`.
- It is accepted by every method that accepts `select`/`relations` (`MethodOptions` and `SimpleMethodOptions`), including [dynamic methods](./dynamic-methods.md) and the [query builder](./query-builder.md) (`relationsOptions()`):

```typescript
const users = await userRepository
    .createQueryBuilder()
    .relations({ posts: true })
    .relationsOptions({ posts: { order: { createdAt: "desc" }, pagination: { limit: 3 } } })
    .getResult();
```

## Strict return typing with `InferMethodReturn`

By default, methods are typed as returning the **whole entity**, ignoring the `select` and `relations` you pass (the same approach TypeORM takes). If you prefer a stricter type, `InferMethodReturn<T, Options>` narrows it to what was actually requested. It is opt-in and purely a type-level utility — nothing changes at runtime.

```typescript
import type { InferMethodReturn, MethodOptions } from "vsrepo";

type Address = { id: string; city: string };
type Product = { id: string; name: string };
type User = {
    id: string;
    name: string;
    email: string;
    address: Address | null;
    products: Product[];
};

const options = {
    select: { id: true, name: true, products: { id: true } },
} satisfies MethodOptions<User>;

const users: InferMethodReturn<User[], typeof options> = await userRepository.find({}, options);
// { id: string; name: string; products: { id: string }[] }[]
```

- The **first** type argument is what the method returns: `User`, `User | null` or `User[]`. `null` and array-ness are preserved — also on relation fields (`address: Address | null`).
- The **second** is the options object passed to the method (`typeof options`). It can be omitted, which is the same as passing no options.

| Options passed         | Inferred result                                                                                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| None (or `{}`)         | Only the scalar fields of the entity — no relations.                                                                                                                                         |
| `relations`            | The scalar fields plus the requested relations (nested ones included); each relation brings all of its scalar fields.                                                                        |
| `select`               | Only the selected fields. A relation set to `true` brings all of its scalar fields; a nested `select` restricts it further. Relations selected this way are loaded even without `relations`. |
| `select` + `relations` | `select` wins and `relations` is ignored.                                                                                                                                                    |

- `see`, `db` and `relationsOptions` don't affect the result.
- Keep the options' literal types, using `satisfies MethodOptions<T>` (as above) or passing them inline. If they are typed as a plain `MethodOptions<T>` (e.g. `const options: MethodOptions<User> = ...`), nothing is known at compile time and `T` is returned unchanged.
- Optional (`?`) fields and relations of the entity stay optional.
- To get this inference directly on dynamic methods, see [Strict return typing with `InferMethodType`](./dynamic-methods.md#strict-return-typing-with-infermethodtype).

[⬆️ Back to top](#top)
