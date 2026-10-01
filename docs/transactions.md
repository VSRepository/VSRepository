<a id="top"></a>

🇺🇸 English | [🇧🇷 Português](./transactions.pt-BR.md)

[← Back to the table of contents](./README.md)

# Transactions

All methods (base, dynamic, and query) accept `options.db` to participate in a shared transaction:

```typescript
await userRepository.transaction(async tx => {
    const user = await userRepository.save({ name: "Maria", email: "maria@email.com" }, { db: tx });

    await userLogsRepository.save({ action: "User created", data: { userId: user.id } }, { db: tx });
});
```

Different repositories can share the same transaction as long as their adapters point to the same underlying ORM connection.

`transaction()` accepts an optional `VSRepoTransactionOptions` as its second argument:

```typescript
import { VSRepoIsolationLevel } from "vsrepo";

await userRepository.transaction(
    async tx => {
        await userRepository.save({ name: "Maria", email: "maria@email.com" }, { db: tx });
    },
    { isolationLevel: VSRepoIsolationLevel.SERIALIZABLE, timeoutMs: 5000 },
);
```

| Option           | Type                        | Description                                                                           |
| ---------------- | --------------------------- | ------------------------------------------------------------------------------------- |
| `isolationLevel` | `VSRepoIsolationLevel` | Isolation level to use for the transaction. Defaults to the underlying ORM's default. |
| `timeoutMs`      | `number`                    | Maximum time (in ms) the transaction is allowed to run before being aborted.          |

`VSRepoIsolationLevel` mirrors the standard SQL isolation levels: `READ_UNCOMMITTED`, `READ_COMMITTED`, `REPEATABLE_READ`, `SERIALIZABLE`. Support for a given level depends on the adapter/underlying ORM and database.

## Return value and error propagation

`transaction()` returns whatever the callback returns, so you can compute a result inside the transaction and use it right after:

```typescript
const order = await orderRepository.transaction(async tx => {
    const created = await orderRepository.save({ userId, total }, { db: tx });

    await orderItemsRepository.saveList(
        items.map(item => ({ ...item, orderId: created.id })),
        { db: tx },
    );

    return created;
});

console.log(order.id);
```

If the callback throws, the error propagates out of `transaction()` unchanged, and it's the adapter/underlying ORM that rolls the transaction back — `VSRepository` itself doesn't catch or wrap it:

```typescript
try {
    await userRepository.transaction(async tx => {
        await userRepository.save({ name: "Maria", email: "maria@email.com" }, { db: tx });

        if (!(await someExternalCheck())) {
            throw new Error("validation failed"); // rolls back the save above
        }
    });
} catch (err) {
    // the transaction was already rolled back by the time this runs
}
```

## Query builder inside a transaction

A [query builder](./query-builder.md#query-builder) — or a [raw query builder](./raw-query-builder.md#transactions-and-setdb) — can be pointed at a transaction the same way — either by creating it with `createQueryBuilder(tx)`, or lazily with `setDb(tx)` once the transaction has started, which lets you build the query before the transaction even exists:

```typescript
const qb = userRepository.createQueryBuilder().where({ active: true });

await userRepository.transaction(async tx => {
    qb.setDb(tx);
    return qb.getResult();
});
```

The [raw query builder](./raw-query-builder.md#raw-query-builder) works exactly the same way: create it with `createRawQueryBuilder(tx)`, or point it at the transaction later with `setDb(tx)`, and call `execute()` inside the callback:

```typescript
const rawQb = userRepository.createRawQueryBuilder().select("id", "name").from("user");

await userRepository.transaction(async tx => {
    rawQb.setDb(tx);
    return rawQb.execute();
});
```

[⬆️ Back to top](#top)
