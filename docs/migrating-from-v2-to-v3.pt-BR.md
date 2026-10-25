<a id="top"></a>

🇧🇷 Português | [🇺🇸 English](./migrating-from-v2-to-v3.md)

[← Voltar para o índice da documentação](./README.pt-BR.md)

# Migrando da v2 para a v3

> [!NOTE]
>
> A v3 ainda está em desenvolvimento (`3.0.0-dev`). Esta página descreve o estado atual da branch `v3` e ainda pode mudar antes do release estável.

A v2 introduziu o núcleo agnóstico de ORM; a v3 mantém essa arquitetura e remodela a API em cima dela: os métodos base agora espelham o vocabulário dos métodos dinâmicos (`find`, `create`, `update`, `delete`, `count`, `exists`, ...), o soft-delete virou um decorator, os métodos dinâmicos perderam o que nunca pertenceu a um engine de parsing por nome (`create*`, `Distinct`, `IgnoreConflicts`), o `@QueryMethod` recebe argumentos posicionais simples, e a biblioteca parou de validar em runtime o que o TypeScript já checa.

Se você vem da v1, leia antes [Migrando da v1 para a v2](./migrating-from-v1-to-v2.pt-BR.md).

## Requisitos e empacotamento

| Área                   | v2                                                       | v3                                                                                                                                                             |
| ---------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js                | 18+                                                      | **22+**                                                                                                                                                        |
| Formato de módulo      | Pacote CommonJS                                          | **Pacote ESM** (`"type": "module"`)..                                                                                                                          |
| Validação em runtime   | `valibot` validava options, argumentos e objetos `where` | **Removida** — a validação agora é apenas em nível de tipos, e o `valibot` deixou de ser dependência. Os tipos de erro `DECORATOR` e `VALIDATOR` saíram junto. |
| Logs de operação lenta | `logSlowThresholdMs` e linhas `WARN` de operação lenta   | **Removidos** — as durações só são logadas em `DEBUG`.                                                                                                         |

## Métodos base

Os métodos base foram retrabalhados em torno de filtros `where` em vez de listas de chaves primárias. Os métodos que recebiam uma `pk` continuam existindo quando fazem sentido (`get`, `remove`, `patch`, `has`, ...).

| v2                                                                                                           | v3                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `getAll(options?)`                                                                                           | `find(where?, options?)` — também aceita `pagination` e `order`                                                                           |
| `getList(pks, options?)`                                                                                     | `find({ id: { in: pks } }, options?)`                                                                                                     |
| `saveList(objs, options?)`                                                                                   | `save(objs, options?)` — o `save` agora aceita um array                                                                                   |
| `removeList(pks, options?)`                                                                                  | `deleteMany({ id: { in: pks } }, options?)`                                                                                               |
| `total(options?)`                                                                                            | `count(where?, options?)`                                                                                                                 |
| `softRemoveList(pks, options?)`                                                                              | `softDeleteMany(where, options?)`                                                                                                         |
| `restore(pk, options?)`                                                                                      | `recover(id, options?)` — o `restore` agora recebe um `where`                                                                             |
| `restoreList(pks, options?)`                                                                                 | `restoreMany(where, options?)`                                                                                                            |
| `increment(pk, field, value, options?)` (e `decrement`, `multiply`, `divide`)                                | `increment(field, value, where, options?)` — selecionado por um `where`, mais `incrementMany`/`decrementMany`/`multiplyMany`/`divideMany` |
| `get`, `getOrThrow`, `save`, `remove`, `patch`, `merge`, `has`, `softRemove`, `sum`, `average`, `min`, `max` | Continuam existindo, com os mesmos nomes (`get`/`getOrThrow` agora também aceitam `order`/`pagination`)                                   |

Métodos base novos: `find`, `findOne`, `findOneOrThrow`, `create`, `createMany`, `createManyReturning`, `upsert`, `update`, `updateMany`, `updateManyReturning`, `delete`, `deleteMany`, `deleteManyReturning`, `count`, `exists`, `softDelete`, `softDeleteMany`, `restore`, `restoreMany`, além dos estáticos `VSRepository.setGlobalConfig()`, `getQueryBuilder()` e `getRawQueryBuilder()`, e do `getAdapter()` de instância. Veja [Métodos base](./base-methods.pt-BR.md).

Os tipos de options também foram refinados: o `MethodOptions` ganhou `pagination` e `order`, e o novo `SimpleMethodOptions` (sem `pagination`/`order`) é o que os métodos de um único registro aceitam — veja [Options dos métodos](./base-methods.pt-BR.md#options-dos-métodos).

## Soft-delete

A option `softRemoveKey` do construtor acabou. O soft-delete agora é habilitado com o decorator de classe `@EnableSoftDelete`:

```typescript
// v2
class UserRepository extends VSRepository<User, string> {
    constructor() {
        super({ adapter, pkName: "id", softRemoveKey: "deletedAt" });
    }
}

// v3
@EnableSoftDelete("deletedAt")
class UserRepository extends VSRepository<User, string> {
    constructor() {
        super({ adapter, pkName: "id" });
    }
}
```

Use `@EnableSoftDelete()` sem argumento junto com `VSRepository.setGlobalConfig({ softDeleteField: "deletedAt" })` para compartilhar um único campo entre os repositories. Veja [Soft-delete](./base-methods.pt-BR.md#soft-delete).

## Métodos dinâmicos

- **Prefixos `create*` removidos** (`createBy…`, `createMany…`, `createManyReturning…`) — use os métodos base `create`, `createMany` e `createManyReturning`.
- **Sufixo `IgnoreConflicts` removido** — passe `ignoreConflicts: true` para `createMany`/`createManyReturning`.
- **Sufixo `Distinct<Campos>` removido**, junto com o `distinct` do query builder — o core não tem mais suporte a distinct; use o [`selectDistinct()`](./raw-query-builder.pt-BR.md) do raw query builder.
- **Palavra-chave `Optional` removida.**
- **`order`/`pagination` via `options`** — os métodos dinâmicos agora repassam `options.order` e `options.pagination` ao adapter, então um simples `findByActive(active, options?)` pode ser ordenado e paginado a cada chamada. Veja [Ordenação e paginação](./dynamic-methods.pt-BR.md#ordenação-e-paginação).
- **Novos aliases de filtro** — prefixo `Is` (`IsBetween`, `IsIn`, `IsNull`, ...), `Equal`/`NotEqual`, `Containing`, `StartingWith`, `EndingWith`, `IgnoringCase`, `Gt`/`Gte`/`Lt`/`Lte`, `After`/`Before`, `True`/`False`/`Null`/`NotNull`, e os novos filtros `Like`/`NotLike` (`like` no `VSRepoWhere`). Veja [Filtros de campo](./dynamic-methods.pt-BR.md#filtros-de-campo).
- **Palavras-chave de relação** (`With`, `Without`, `Some`, `Every`, `None`) não são mais reconhecidas bem no começo do nome de um campo, então `findByWithDependents` resolve para o campo `withDependents`.

## Query methods e SQL raw

- **`spreadArgs`/`singleArg` e os tipos `QueryArgs`/`QueryMethodArg` acabaram.** O `@QueryMethod` sempre recebe argumentos posicionais simples, e `withDb(tx)` continua sendo o último argumento opcional:

    ```typescript
    // v2 (padrão: um único objeto `{ args, db }`)
    @QueryMethod('SELECT * FROM "user" WHERE email = $1')
    declare findByEmail: (arg: QueryMethodArg<[email: string]>) => Promise<User[]>;
    await repo.findByEmail({ args: ["joao@email.com"] });

    // v3
    @QueryMethod('SELECT * FROM "user" WHERE email = ?1')
    declare findByEmail: (email: string, db?: DbArg) => Promise<User[]>;
    await repo.findByEmail("joao@email.com");
    ```

- **`vsPlaceholders` vem ligado por padrão** — strings SQL cruas usam `?1`, `?2`, ... Passe `vsPlaceholders: false` (no construtor ou no `setGlobalConfig`) para continuar escrevendo a sintaxe nativa do seu banco (`$1`, `?`).
- **`getPlaceholder()` é obrigatório nos adapters** (veja [Adapters](#adapters)), e a biblioteca traz prontos `getPostgresPlaceholder`, `getSqlitePlaceholder`, `getMySqlPlaceholder`, `getSqlServerPlaceholder`, `getCockroachPlaceholder` e `getVsPlaceholder`, tipados por `GetPlaceholderFn`.
- Os erros do **`VSSql`** agora têm `type: VSRepoErrorType.VSSQL`, e o `compile()` usa `getVsPlaceholder` por padrão.

## Query builders

- `VSQueryBuilder.setDb()` e `VSRawQueryBuilder.setDb()` agora **retornam o builder** (`qb.setDb(tx).getResult()`).
- `VSQueryBuilder.distinctOn()` foi removido; o `getCount()` envia apenas o `where`.
- O `VSRawQueryBuilder` ganhou `selectDistinct()`, e o `orderBy()` aceita uma lista de tuplas `[column, direction]`. As palavras-chave do SQL gerado ficam em minúsculas.

## Configuração, logging e erros

- `VSRepository.setGlobalConfig({ softDeleteField, logLevel, lazyDynamicMethods, vsPlaceholders })` define padrões compartilhados — veja [Configuração global](./base-methods.pt-BR.md#configuração-global).
- `VSLogLevel.NONE` desativa o logging por completo; `logSlowThresholdMs` foi removido.
- `TransactionIsolationLevel` foi renomeado para **`VSRepoIsolationLevel`**, e `isolationLevel` também aceita os valores string do enum (`"Serializable"`).
- `VSRepoErrorType.DECORATOR` e `VSRepoErrorType.VALIDATOR` foram removidos; `VS_PLACEHOLDERS` e `VSSQL` foram adicionados — veja [Tratamento de erros](./error-handling.pt-BR.md).
- O `resolveDynamicMethods()` só emite o aviso uma vez quando chamado mais de uma vez, e o resolver só loga os métodos que resolve quando há pelo menos um.
- Novos tipos utilitários: `ClientOrTransaction`, `SimpleMethodOptions`, `VSRepoGlobalConfig`, `VSRepoLogicalOperators`, `GetPlaceholderFn`. A tipagem do `VSRepoWhere` foi reformulada.

## Adapters

O contrato do `VSRepoAdapter` mudou, então **adapters feitos para a v2 precisam ser atualizados** antes de funcionar com a v3. Se você mantém um, implemente:

1. `getPlaceholder(index)` — agora **obrigatório** (retorne um dos helpers exportados, ou o seu).
2. Os métodos novos/alterados: `findOne`/`findOneOrThrow`/`findMany` recebem `order` e `pagination` (e não recebem mais `distinct`); `incrementMany`, `decrementMany`, `multiplyMany` e `divideMany`; e options tipadas por `AdapterMethodOptions`, `SimpleAdapterMethodOptions` e `RestrictAdapterMethodOptions`.

Veja [Escrevendo seu próprio adapter](./writing-an-adapter.pt-BR.md#o-contrato-vsrepoadapter) para o contrato completo. Se você usa um adapter oficial, instale a versão que declara compatibilidade com a v3.

## Migrando um repository da v2 para a v3

1. **Atualize** o Node.js para 22+ e instale a versão do seu adapter compatível com a v3.
2. **Troque** `softRemoveKey: "..."` por `@EnableSoftDelete("...")` (ou por um `softDeleteField` global).
3. **Renomeie** os métodos base removidos conforme listado [acima](#métodos-base): `getAll` → `find`, `getList` → `find` com `in`, `saveList` → `save([...])`, `removeList` → `deleteMany`, `total` → `count`, `softRemoveList` → `softDeleteMany`, `restore(pk)` → `recover(id)`, `restoreList` → `restoreMany`.
4. **Reordene** os argumentos de `increment`/`decrement`/`multiply`/`divide`: `(field, value, where)`.
5. **Remova** os métodos dinâmicos `create*`, `IgnoreConflicts`, `Distinct` e `Optional` — use `create`/`createMany`/`createManyReturning` (com `ignoreConflicts`) e `selectDistinct()` quando precisar.
6. **Reescreva** as declarações `@QueryMethod` para receberem argumentos posicionais, usarem placeholders `?1`, `?2`, ... (ou defina `vsPlaceholders: false`), e remova `spreadArgs`/`QueryArgs`/`QueryMethodArg`.
7. **Renomeie** `TransactionIsolationLevel` para `VSRepoIsolationLevel`.
8. **Remova** `logSlowThresholdMs` e qualquer tratamento dos tipos de erro `DECORATOR`/`VALIDATOR`.
9. **Confira** os pontos que dependiam de erros de validação em runtime — formatos inválidos agora só falham em tempo de compilação.
10. **Rode** o build do TypeScript e os seus testes: a maior parte do que sobrar aparece como erro de tipo.

> Veja o [README principal](../README.pt-BR.md) para instalação, status dos adapters e uso básico.

[⬆️ Voltar ao topo](#top)
