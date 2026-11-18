<a id="top"></a>

🇧🇷 Português | [🇺🇸 English](./logging.md)

[← Voltar para o Sumário](./README.pt-BR.md)

# Logging

Todo repository tem um logger interno, configurado via `logLevel` na config do construtor — ou para todos os repositories de uma vez com [`VSRepository.setGlobalConfig()`](./base-methods.pt-BR.md#configuração-global):

```typescript
import { VSLogLevel } from "vsrepo";

super({
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

O [query builder](./query-builder.pt-BR.md#logs-do-query-builder) usa o mesmo logger: em `DEBUG` ele registra a query resolvida de cada método terminal.

## Formato do log

Toda linha começa com um timestamp ISO, o nível e o nome do logger derivado da classe do repository — `${ClassName}Logger`:

```text
2026-09-21T05:02:02.087Z [INFO] [UserRepositoryLogger] Initializing UserRepository (pk: 'id', softDeleteField: 'deletedAt', defaultOrdering: {"createdAt":"desc"}, adapter: VSRepoPrisma7Adapter)
```

Todo método base e todo método dinâmico registra uma única linha `DEBUG` quando roda. Com `logLevel: VSLogLevel.DEBUG`, uma chamada `userRepository.save({ name: "Joao", email: "joao@email.com" })` imprime:

```text
2026-09-21T05:02:02.088Z [DEBUG] [UserRepositoryLogger] Running BaseMethod 'save'
```

Os métodos dinâmicos seguem a mesma ideia, imprimindo `Running DynamicMethod '<nome>' (-> <operação>)`, e os query methods imprimem `Running QueryMethod '<nome>':` seguido da query resolvida e de seus argumentos.

[⬆️ Voltar ao topo](#top)
