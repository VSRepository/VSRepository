<a id="top"></a>

🇧🇷 Português | [🇺🇸 English](./logging.md)

[← Voltar para o Sumário](./README.pt-BR.md)

# Logging

Todo repository tem um logger interno, configurado via `logLevel` nas options do construtor — ou para todos os repositories de uma vez com [`VSRepository.setGlobalConfig()`](./base-methods.pt-BR.md#configuração-global):

```typescript
import { VSLogLevel } from "vsrepo";

super({
    pkName: "id",
    adapter,
    logLevel: VSLogLevel.DEBUG,
});
```

| Nível           | Significado                                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `DEBUG`         | Detalhes internos verbosos, incluindo toda query resolvida — muito útil para debugar métodos dinâmicos.                            |
| `INFO`          | Eventos de alto nível do ciclo de vida, como a inicialização do repository.                                                        |
| `WARN` (padrão) | Problemas recuperáveis, como chamar `resolveDynamicMethods()` mais de uma vez.                                                     |
| `ERROR`         | Falhas detectadas pela própria biblioteca (ex.: um método dinâmico inválido), registradas logo antes do `VSRepoError` ser lançado. |
| `NONE`          | Desativa completamente os logs.                                                                                                    |

O [query builder](./query-builder.pt-BR.md#logs-do-query-builder) usa o mesmo logger: em `DEBUG` ele também registra cada chamada encadeada e a query resolvida de cada método terminal, e cada método terminal tem o tempo medido como qualquer outra operação (também em `DEBUG`).

## Formato do log

Toda linha começa com um timestamp ISO, o nível e o nome do logger derivado da classe do repository — `${ClassName}Logger`:

```text
2026-09-21T05:02:02.087Z [INFO] [UserRepositoryLogger] Initializing UserRepository (pk: 'id', softDeleteField: 'deletedAt', defaultOrdering: {"createdAt":"desc"}, adapter: VSRepoPrisma7Adapter)
```

Todo método base e todo método dinâmico tem o tempo medido automaticamente. Com `logLevel: VSLogLevel.DEBUG`, uma chamada `userRepository.save({ name: "Joao", email: "joao@email.com" })` imprime:

```text
2026-09-21T05:02:02.088Z [DEBUG] [UserRepositoryLogger] Starting to run save...
2026-09-21T05:02:02.091Z [DEBUG] [UserRepositoryLogger] Took 2.73ms to run save
```

A duração só é informada no nível `DEBUG` — não existem avisos de operação lenta.

O nome da operação nessas linhas (`save`, `findByEmail`, `getResultAndCount`, ...) é o método base, o método dinâmico ou o método terminal do query builder que foi chamado.

[⬆️ Voltar ao topo](#top)
