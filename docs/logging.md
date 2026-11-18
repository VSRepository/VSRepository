<a id="top"></a>

🇺🇸 English | [🇧🇷 Português](./logging.pt-BR.md)

[← Back to the table of contents](./README.md)

# Logging

Every repository has an internal logger, configured via `logLevel` on the constructor config — or for every repository at once with [`VSRepository.setGlobalConfig()`](./base-methods.md#global-configuration):

```typescript
import { VSLogLevel } from "vsrepo";

super({
    adapter,
    logLevel: VSLogLevel.DEBUG,
});
```

| Level            | Meaning                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `DEBUG`          | Verbose internal details, including every resolved query — very useful for debugging dynamic methods.                      |
| `INFO`           | High-level lifecycle events, such as repository initialization.                                                            |
| `WARN` (default) | Recoverable issues, such as calling `resolveDynamicMethods()` more than once.                                              |
| `ERROR`          | Failures detected by the library itself (e.g. an invalid dynamic method), logged right before the `VSRepoError` is thrown. |
| `NONE`           | Completely disables logs.                                                                                                  |

The [query builder](./query-builder.md#query-builder-logs) uses the same logger: at `DEBUG` it logs the resolved query of each terminal method.

## Log format

Every line starts with an ISO timestamp, the level, and a logger name derived from the repository's class — `${ClassName}Logger`:

```text
2026-09-21T05:02:02.087Z [INFO] [UserRepositoryLogger] Initializing UserRepository (pk: 'id', softDeleteField: 'deletedAt', defaultOrdering: {"createdAt":"desc"}, adapter: VSRepoPrisma7Adapter)
```

Every base and dynamic method logs a single `DEBUG` line when it runs. With `logLevel: VSLogLevel.DEBUG`, calling `userRepository.save({ name: "Joao", email: "joao@email.com" })` prints:

```text
2026-09-21T05:02:02.088Z [DEBUG] [UserRepositoryLogger] Running BaseMethod 'save'
```

Dynamic methods use the same idea, printing `Running DynamicMethod '<name>' (-> <operation>)`, and query methods print `Running QueryMethod '<name>':` followed by the resolved query and its arguments.

[⬆️ Back to top](#top)
