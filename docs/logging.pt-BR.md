<a id="top"></a>

🇧🇷 Português | [🇺🇸 English](./logging.md)

[← Voltar para o Sumário](./README.pt-BR.md)

# Logging

Todo repository tem um logger interno, configurado via `logLevel` e `logSlowThresholdMs` nas options do construtor:

```typescript
import { VSLogLevel } from "vsrepo";

super({
    pkName: "id",
    adapter,
    logLevel: VSLogLevel.DEBUG,
    logSlowThresholdMs: 200, // avisa se qualquer operação levar mais de 200ms
    // logSlowThresholdMs: false, // desabilita os avisos de operação lenta completamente
});
```

| Nível           | Significado                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| `DEBUG`         | Detalhes internos verbosos, incluindo toda query resolvida — muito útil para debugar métodos dinâmicos. |
| `INFO`          | Eventos de alto nível do ciclo de vida, como a inicialização do repository.                             |
| `WARN` (padrão) | Problemas recuperáveis e operações lentas (veja `logSlowThresholdMs`, padrão de 300ms).                 |
| `ERROR`         | Falhas de validação e de guarda, registradas em `ERROR` logo antes do `VSRepoError` ser lançado.        |
| `NONE`          | Desativa completamente os logs.                                                                         |

O [query builder](./query-builder.pt-BR.md#logs-do-query-builder) usa o mesmo logger: em `DEBUG` ele também registra cada chamada encadeada e a query resolvida de cada método terminal, e cada método terminal tem o tempo medido como qualquer outra operação.

## Formato do log

Toda linha começa com um timestamp ISO, o nível e o nome do logger derivado da classe do repository — `${ClassName}Logger`:

```text
2026-09-21T05:02:02.087Z [INFO] [UserRepositoryLogger] Initializing UserRepository (pk: 'id', softRemoveKey: 'deletedAt', defaultOrdering: {"createdAt":"desc"}, adapter: VSRepoPrisma7Adapter)
```

Todo método base e todo método dinâmico tem o tempo medido automaticamente. Com `logLevel: VSLogLevel.DEBUG`, uma chamada `userRepository.save({ name: "Joao", email: "joao@email.com" })` imprime:

```text
2026-09-21T05:02:02.088Z [DEBUG] [UserRepositoryLogger] Starting to run save...
2026-09-21T05:02:02.091Z [DEBUG] [UserRepositoryLogger] Took 2.73ms to run save
```

Se essa mesma chamada demorar mais do que o `logSlowThresholdMs` (300ms por padrão), a segunda linha é promovida para `WARN` — e aparece até no nível padrão `WARN`, já que ela não está atrás do gate de `DEBUG`:

```text
2026-09-21T05:02:02.501Z [WARN] [UserRepositoryLogger] Took 412.16ms to run save (slower than the 300ms threshold)
```

O nome da operação nessas linhas (`save`, `findByEmail`, `getResultAndCount`, ...) é o método base, o método dinâmico ou o método terminal do query builder que foi chamado.

[⬆️ Voltar ao topo](#top)
