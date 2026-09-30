<a id="top"></a>

🇺🇸 English | [🇧🇷 Português](./logging.pt-BR.md)

[← Back to the table of contents](./README.md)

# Logging

Every repository has an internal logger, configured via `logLevel` and `logSlowThresholdMs` on the constructor options:

```typescript
import { VSLogLevel } from "vsrepo";

super({
    pkName: "id",
    adapter,
    logLevel: VSLogLevel.DEBUG,
    logSlowThresholdMs: 200, // warn if any operation takes > 200ms
    // logSlowThresholdMs: false, // disable slow-operation warnings entirely
});
```

| Level            | Meaning                                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| `DEBUG`          | Verbose internal details, including every resolved query — very useful for debugging dynamic methods. |
| `INFO`           | High-level lifecycle events, such as repository initialization.                                       |
| `WARN` (default) | Recoverable issues and slow operations (see `logSlowThresholdMs`, defaults to 300ms).                 |
| `ERROR`          | Validation and guard-clause failures, logged right before the `VSRepoError` is thrown.                |
| `NONE`           | Completely disables logs.                                                                             |

The [query builder](./query-builder.md#query-builder-logs) uses the same logger: at `DEBUG` it also traces every chained call and the resolved query of each terminal method, and each terminal method is timed like any other operation.

## Log format

Every line starts with an ISO timestamp, the level, and a logger name derived from the repository's class — `${ClassName}Logger`:

```text
2026-09-21T05:02:02.087Z [INFO] [UserRepositoryLogger] Initializing UserRepository (pk: 'id', softRemoveKey: 'deletedAt', defaultOrdering: {"createdAt":"desc"}, adapter: VSRepoPrisma7Adapter)
```

Every base and dynamic method is timed automatically. With `logLevel: VSLogLevel.DEBUG`, calling `userRepository.save({ name: "Joao", email: "joao@email.com" })` prints:

```text
2026-09-21T05:02:02.088Z [DEBUG] [UserRepositoryLogger] Starting to run save...
2026-09-21T05:02:02.091Z [DEBUG] [UserRepositoryLogger] Took 2.73ms to run save
```

If that same call takes longer than `logSlowThresholdMs` (300ms by default), the second line is promoted to `WARN` instead — and shows up even at the default `WARN` level, since it's not gated behind `DEBUG`:

```text
2026-09-21T05:02:02.501Z [WARN] [UserRepositoryLogger] Took 412.16ms to run save (slower than the 300ms threshold)
```

The operation name in these lines (`save`, `findByEmail`, `getResultAndCount`, ...) is whatever base method, dynamic method, or query builder terminal method was called.

[⬆️ Back to top](#top)
