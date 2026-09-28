<a id="top"></a>

🇧🇷 Português | [🇺🇸 English](./utility-types.md)

[← Voltar para o Sumário](./README.pt-BR.md)

# Tipos utilitários

Além dos tipos que descrevem o formato da entidade já vistos acima (`VSRepoSelect`, `VSRepoRelations`, `VSRepoWhere`), o VSRepository exporta um conjunto de tipos utilitários. Eles aparecem ao longo de várias seções anteriores, mas aqui está uma referência consolidada. Todos fazem parte da API pública e podem ser importados diretamente:

| Tipo                                                | Descrição                                                                                                                                                                                                                                  | Usado por                                                                                                                                                                                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MethodOptions<T, K>`                               | Options aceitas como último argumento por todos os métodos dinâmicos e pela maioria dos métodos base: `select`, `relations`, `see`, `db`.                                                                                                  | [Métodos base](./base-methods.pt-BR.md#métodos-base), [Métodos Dinâmicos](./dynamic-methods.pt-BR.md#métodos-dinâmicos).                                                                                                                       |
| `RestrictMethodOptions<T, K>`                       | `MethodOptions<T, K>` restrito, expondo só `see`/`db` — usado pelos métodos que não retornam/moldam uma `Entity` (`total`, `has`, `sum`, `average`, `min`, `max`, `removeList`, `softRemoveList`, `restoreList`).                          | [Métodos base](./base-methods.pt-BR.md#métodos-base), [Métodos atômicos e de agregação](./base-methods.pt-BR.md#métodos-atômicos-e-de-agregação).                                                                                              |
| `InferMethodReturn<T, Options>`                     | Tipagem de retorno restrita (opt-in): estreita `T` (`Entity`, `Entity \| null` ou `Entity[]`) para os campos e relações realmente pedidos via `select`/`relations`. `select` vence `relations`.                                            | [Tipagem de retorno restrita com `InferMethodReturn`](./select-and-relations.pt-BR.md#tipagem-de-retorno-restrita-com-infermethodreturn).                                                                                                      |
| `InferMethodType<Args, Return, OrmTypes?>`          | Declara um método dinâmico cujo retorno é inferido a cada chamada a partir do `select`/`relations` passados como `options`. `OrmTypes` é opcional e tipa a option `db`.                                                                    | [Tipagem de retorno restrita com `InferMethodType`](./dynamic-methods.pt-BR.md#tipagem-de-retorno-restrita-com-infermethodtype).                                                                                                               |
| `Pagination`                                        | `{ limit?, offset? }` aceito por `getAll` e pelos métodos dinâmicos com `Paginated`.                                                                                                                                                       | [Métodos base](./base-methods.pt-BR.md#métodos-base), [Ordenação, paginação e distinct](./dynamic-methods.pt-BR.md#ordenação-paginação-e-distinct).                                                                                            |
| `Ordering<T>` / `OrderByField<T>` / `SortDirection` | Formato de ordenação aceito por `getAll`, `defaultOrdering`, `injectOrdering` e pelos métodos dinâmicos com `Ordered`. Pode ser um único objeto ou um array encadeado.                                                                     | [Options do construtor](./base-methods.pt-BR.md#options-do-construtor), [Options do decorador](./dynamic-methods.pt-BR.md#options-do-decorador), [Ordenação, paginação e distinct](./dynamic-methods.pt-BR.md#ordenação-paginação-e-distinct). |
| `SeeMode`                                           | `"active" \| "removed" \| "all"` — controla a visibilidade de registros com soft-delete.                                                                                                                                                   | [Soft-delete](./base-methods.pt-BR.md#soft-delete).                                                                                                                                                                                            |
| `DeepPartial<T>`                                    | Torna todas as propriedades de `T` opcionais recursivamente, incluindo objetos aninhados e elementos de array.                                                                                                                             | `save`, `saveList`, `patch`, `merge`, e todos os métodos dinâmicos de escrita.                                                                                                                                                                  |
| `CountResult`                                       | `{ count: number }` — o formato retornado por operações em lote.                                                                                                                                                                           | `removeList`, `softRemoveList`, `restoreList`, `createMany`, `deleteMany`, `updateMany`.                                                                                                                                                       |
| `QueryMethodArg<T, O>`                                 | `{ args?: T, db? }` — parâmetros posicionais do SQL (a sintaxe dos placeholders depende do banco/driver usado pelo seu adapter: `$1`, `$2`, ... para PostgreSQL, `?` para MySQL) e cliente de transação para o `@QueryMethod`.             | [Query methods (SQL raw)](./query-methods.pt-BR.md#query-methods-sql-raw).                                                                                                                                                                     |
| `QueryArgs<T, O>`                                   | Tipa a lista de parâmetros via spread de um `@QueryMethod` declarado com `{ spreadArgs: true }`: os valores de `T`, em ordem, seguidos de um `DbArg<O>` opcional construído via `withDb()`.                                                | [Argumentos via spread com `spreadArgs`](./query-methods.pt-BR.md#argumentos-via-spread-com-spreadargs).                                                                                                                                       |
| `KeysOfType<T, K>`                                  | Extrai as chaves de `T` cujo tipo de valor é atribuível a `K`.                                                                                                                                                                             | Restringe `pkName`, em [Options do construtor](./base-methods.pt-BR.md#options-do-construtor), aos campos da entidade compatíveis com o tipo de chave primária configurado.                                                                    |
| `NumericKeys<T>`                                    | Extrai as chaves de `T` cujo tipo de valor (ignorando `null`/`undefined`) é atribuível a `NumericLike`. Campos numéricos nullable (`number \| null`) são incluídos.                                                                        | Restringe `field` em [Métodos atômicos e de agregação](./base-methods.pt-BR.md#métodos-atômicos-e-de-agregação) (`increment`, `sum`, etc).                                                                                                     |
| `NumericLike`                                       | `number \| bigint \| DecimalLike`.                                                                                                                                                                                                         | [Métodos atômicos e de agregação](./base-methods.pt-BR.md#métodos-atômicos-e-de-agregação).                                                                                                                                                    |
| `DecimalLike`                                       | Formato estrutural de um valor decimal de precisão arbitrária (`{ toNumber(): number; decimalPlaces(): number }`), compatível com o `Prisma.Decimal` do Prisma sem precisar importá-lo diretamente.                                        | [Quais campos são elegíveis](./base-methods.pt-BR.md#quais-campos-são-elegíveis).                                                                                                                                                              |
| `Primitive`                                         | União de tipos escalares (`string \| number \| boolean \| bigint \| symbol \| undefined \| null \| Date \| DecimalLike`) tratados como valores-folha — e não relações — ao percorrer o formato de uma entidade.                            | Usado por `Ordering<T>` para distinguir campos escalares de campos de relação.                                                                                                                                                                 |
| `VSRepoWhere<T>`                                    | Tipo de filtro agnóstico de ORM aceito pelos métodos dinâmicos `*Where` (ex.: `findWhere`, `findOneWhere`, `updateWhere`). Suporta filtros de campo, operadores lógicos (`AND`/`OR`/`NOT`) e filtros de relação.                           | [Prefixos `findWhere`, `findOneWhere` e demais `*Where`](./dynamic-methods.pt-BR.md#prefixos-disponíveis).                                                                                                                                     |
| `VSRepoOrmTypes`                                    | `{ dbClient; dbTransaction }` — descreve os tipos de client/transaction do seu ORM. Passado como terceiro generic de `VSRepository<Entity, PKType, OrmTypes>` para tipar `getDbClient()`, `transaction()` e a option `db` em vez de `any`. | [Criando um repository](../README.pt-BR.md#criando-um-repository).                                                                                                                                                                             |
| `VSRepoTransactionOptions`                          | `{ isolationLevel?, timeoutMs? }` — options aceitas como segundo argumento de `transaction()`.                                                                                                                                             | [Transações](./transactions.pt-BR.md#transações).                                                                                                                                                                                              |
| `TransactionIsolationLevel`                         | Enum dos níveis de isolamento SQL padrão (`READ_UNCOMMITTED`, `READ_COMMITTED`, `REPEATABLE_READ`, `SERIALIZABLE`) aceitos por `VSRepoTransactionOptions.isolationLevel`.                                                                  | [Transações](./transactions.pt-BR.md#transações).                                                                                                                                                                                              |

## `DeepPartial<T>`

Torna todas as propriedades opcionais recursivamente, percorrendo objetos aninhados e elementos de array — diferente do `Partial<T>` nativo do TypeScript, que só torna o nível superior opcional:

```typescript
type User = { id: string; name: string; address: { city: string; zip: string } };

const patch: DeepPartial<User> = {
    address: { city: "São Paulo" }, // zip pode ser omitido; city mantém seu tipo
};

await userRepository.patch(id, patch);
```

## `KeysOfType<T, K>`

Filtra um tipo de objeto para as chaves cujo valor corresponde a um tipo dado — é isso que permite que `pkName` aceite apenas campos da entidade que sejam de fato atribuíveis ao tipo de chave primária do repository:

```typescript
type User = { id: string; age: number; name: string };
type StringKeys = KeysOfType<User, string>; // "id" | "name"
```

## `Ordering<T>`

Aceita um único objeto de ordenação ou um array deles, aplicados na ordem declarada:

```typescript
const order: Ordering<User> = { createdAt: "desc" };
const chained: Ordering<User> = [{ name: "asc" }, { createdAt: "desc" }];

await userRepository.getAll({ order: chained });
```

[⬆️ Voltar ao topo](#top)
