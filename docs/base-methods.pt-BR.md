<a id="top"></a>

# Métodos base, configuração & soft-delete

🇧🇷 Português | [🇺🇸 English](./base-methods.md)

[← Voltar para o Sumário](./README.pt-BR.md)

## Options do construtor

`VSRepoOptions<Entity, PKType>`, passadas para `super(...)` dentro do construtor do seu repository:

| Option               | Tipo                         | Descrição                                                                                                                                                                                                                                                                                                                                                                |
| -------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `adapter`            | `VSRepoAdapter<Entity>`      | **Obrigatória.** A instância do adapter que traduz as chamadas do repository em chamadas ao ORM/banco subjacente.                                                                                                                                                                                                                                                        |
| `pkName`             | `KeysOfType<Entity, PKType>` | Opcional. Nome do campo que representa a chave primária da entidade. Quando omitida, o repository usa o `getPkName()` do adapter. Se o adapter também não o implementar, o construtor lança um `VSRepoError`.                                                                                                                                                            |
| `defaultOrdering`    | `Ordering<Entity>`           | Opcional. Ordenação padrão aplicada automaticamente às queries que aceitam `order`, a menos que seja sobrescrita na chamada.                                                                                                                                                                                                                                             |
| `logLevel`           | `VSLogLevel`                 | Opcional. Severidade mínima impressa pelo logger interno. O padrão é `VSLogLevel.WARN`; use `VSLogLevel.NONE` para desativar os logs por completo.                                                                                                                                                                                                                       |
| `lazyDynamicMethods` | `boolean`                    | Opcional. O padrão é `false`. Quando `true`, adia a resolução dos métodos `@DynamicMethod`/`@QueryMethod` — o próprio repository precisa chamar `resolveDynamicMethods()` manualmente depois. Veja [Resolução lazy dos métodos dinâmicos](./dynamic-methods.pt-BR.md#resolução-lazy-dos-métodos-dinâmicos).                                                              |
| `vsPlaceholders`     | `boolean`                    | Opcional. O padrão é `true`. Strings SQL cruas passadas para `query()` e `@QueryMethod` usam os placeholders próprios do VSRepository (`?1`, `?2`, ...) em vez da sintaxe nativa do seu adapter. Passe `false` para escrever a sintaxe nativa. Veja [Placeholders agnósticos com `vsPlaceholders`](./query-methods.pt-BR.md#placeholders-agnósticos-com-vsplaceholders). |
| `mergeConfig`        | `MergeConfig<Entity>`        | Opcional. Configuração padrão usada pelo `merge()`; uma chamada pode substituí-la por `options.mergeConfig`. Veja [Mesclando registros com `merge`](#mesclando-registros-com-merge).                                                                                                                                                                                     |

O soft-delete não é mais uma option do construtor — ele é habilitado com o decorator [`@EnableSoftDelete`](#soft-delete).

### Configuração global

`VSRepository.setGlobalConfig()` define padrões compartilhados por todos os repositories. As options de cada repository têm precedência, e só os repositories criados **depois** da chamada são afetados — então chame uma vez na inicialização, antes de instanciar qualquer repository:

```typescript
VSRepository.setGlobalConfig({
    logLevel: VSLogLevel.INFO,
    softDeleteField: "deletedAt",
    vsPlaceholders: true,
    lazyDynamicMethods: false,
});
```

| Campo                | Descrição                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `softDeleteField`    | Campo de soft-delete usado pelo `@EnableSoftDelete()` quando ele não especifica um próprio. |
| `logLevel`           | Padrão da option `logLevel`.                                                                |
| `lazyDynamicMethods` | Padrão da option `lazyDynamicMethods`.                                                      |
| `vsPlaceholders`     | Padrão da option `vsPlaceholders`.                                                          |

---

## Métodos base

Disponíveis automaticamente em toda subclasse de `VSRepository`. `where` é um filtro [`VSRepoWhere`](./utility-types.pt-BR.md) — o mesmo usado pelos métodos dinâmicos e pelo query builder.

**Leitura**

| Método                             | Descrição                                                                                                                                     |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `find(where?, options?)`           | Retorna todos os registros que baterem em `where` (todos, se omitido); aceita `pagination` e `order` em `options`.                            |
| `findAndCount(where?, options?)`   | O mesmo que `find`, mas também retorna o total de registros que baterem — veja [Buscando registros e o total](#buscando-registros-e-o-total). |
| `findOne(where?, options?)`        | Retorna o primeiro registro que bater em `where`, ou `null`.                                                                                  |
| `findOneOrThrow(where?, options?)` | O mesmo que `findOne`, mas lança um erro se nada bater.                                                                                       |
| `get(id, options?)`                | Busca um registro pela chave primária, ou `null`.                                                                                             |
| `getOrThrow(id, options?)`         | Busca um registro pela chave primária, lançando um erro se não encontrar.                                                                     |
| `count(where?, options?)`          | Conta os registros que baterem em `where` (todos, se omitido).                                                                                |
| `exists(where?, options?)`         | Verifica se pelo menos um registro bate em `where`, retornando `boolean`.                                                                     |
| `has(id, options?)`                | Verifica se existe um registro com a chave primária informada, retornando `boolean`.                                                          |

**Escrita**

| Método                                      | Descrição                                                                                                                                                                                                                           |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create(obj, options?)`                     | Cria um registro e o retorna.                                                                                                                                                                                                       |
| `createMany(objs, options?)`                | Cria vários registros de uma vez, retornando `{ count }`. Passe `ignoreConflicts: true` para pular linhas que violem uma unique.                                                                                                    |
| `createManyReturning(objs, options?)`       | O mesmo que `createMany`, mas retorna os registros criados.                                                                                                                                                                         |
| `save(obj \| objs, options?)`               | Cria ou atualiza (upsert) um registro — ou, recebendo um array, vários registros em uma única chamada.                                                                                                                              |
| `upsert(where, create, update, options?)`   | Atualiza o registro que bater em `where` com `update`, ou o cria com `create` se nenhum bater.                                                                                                                                      |
| `update(where, obj, options?)`              | Atualiza o registro que bater em `where` e o retorna.                                                                                                                                                                               |
| `updateMany(where, obj, options?)`          | Atualiza todos os registros que baterem em `where`, retornando `{ count }`.                                                                                                                                                         |
| `updateManyReturning(where, obj, options?)` | O mesmo que `updateMany`, mas retorna os registros atualizados.                                                                                                                                                                     |
| `patch(id, obj, options?)`                  | O mesmo que `update`, pela chave primária.                                                                                                                                                                                          |
| `merge(where, obj, options?)`               | Busca o registro que bate em `where` e o retorna com um merge profundo, em memória, com o objeto informado — **não** persiste nada; `null` se nenhum bater. Veja [Mesclando registros com `merge`](#mesclando-registros-com-merge). |

**Remoção** (permanente — para soft-delete veja [abaixo](#soft-delete))

| Método                                 | Descrição                                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------------------------- |
| `delete(where, options?)`              | Deleta permanentemente o registro que bater em `where` e o retorna.                       |
| `remove(id, options?)`                 | O mesmo que `delete`, pela chave primária.                                                |
| `deleteMany(where, options?)`          | Deleta permanentemente todos os registros que baterem em `where`, retornando `{ count }`. |
| `deleteManyReturning(where, options?)` | O mesmo que `deleteMany`, mas retorna os registros deletados.                             |

**Operações numéricas** — veja [Métodos atômicos e de agregação](#métodos-atômicos-e-de-agregação)

| Método                                                                                              | Descrição                                                                                   |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `increment(field, value, where, options?)`                                                          | Soma `value` a um campo numérico do registro que bater em `where`, de forma atômica.        |
| `decrement(field, value, where, options?)`                                                          | Subtrai `value` de um campo numérico de forma atômica.                                      |
| `multiply(field, value, where, options?)`                                                           | Multiplica um campo numérico por `value` de forma atômica.                                  |
| `divide(field, value, where, options?)`                                                             | Divide um campo numérico por `value` de forma atômica.                                      |
| `incrementMany` / `decrementMany` / `multiplyMany` / `divideMany` `(field, value, where, options?)` | O mesmo que acima, para todos os registros que baterem em `where`, retornando `{ count }`.  |
| `sum(field, where?, options?)`                                                                      | Soma um campo numérico em todos os registros que baterem no filtro; `null` se nenhum bater. |
| `average(field, where?, options?)`                                                                  | Média aritmética de um campo numérico; `null` se nenhum bater.                              |
| `min(field, where?, options?)`                                                                      | Valor mínimo de um campo numérico; `null` se nenhum bater.                                  |
| `max(field, where?, options?)`                                                                      | Valor máximo de um campo numérico; `null` se nenhum bater.                                  |

**Infraestrutura**

| Método                       | Descrição                                                                                                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `transaction(fn, options?)`  | Executa `fn` dentro de uma transação nativa do ORM.                                                                                                                                                          |
| `getDbClient()`              | Retorna a instância do client do ORM.                                                                                                                                                                        |
| `getAdapter()`               | Retorna o adapter, opcionalmente tipado como uma classe de adapter específica (`getAdapter<MyAdapter>()`).                                                                                                   |
| `query<T>(query, options?)`  | Executa uma instrução SQL crua diretamente no banco — aceita uma string simples ou um fragmento `VSSql`. Veja [Queries raw pontuais com `query()`](./query-methods.pt-BR.md#queries-raw-pontuais-com-query). |
| `createQueryBuilder(db?)`    | Cria um [query builder](./query-builder.pt-BR.md#query-builder) fluente para queries montadas em tempo de execução.                                                                                          |
| `createRawQueryBuilder(db?)` | Cria um [raw query builder](./raw-query-builder.pt-BR.md#raw-query-builder) fluente para queries `SELECT` escritas à mão, específicas demais para o query builder — joins, subqueries, CTEs.                 |

```typescript
const active = await userRepository.find({ active: true }, { order: { name: "asc" }, pagination: { limit: 20 } });
const user = await userRepository.findOne({ email: "joao@email.com" });

await userRepository.create({ name: "Maria", email: "maria@email.com" });
await userRepository.save([{ name: "Ana" }, { name: "Bia" }]); // vários registros em uma chamada
await userRepository.update({ email: "maria@email.com" }, { active: false });
await userRepository.deleteMany({ active: false });
```

### Buscando registros e o total

`findAndCount(where?, options?)` busca os registros que baterem em `where` **e** o total de registros que batem, em uma única chamada — a base de uma listagem paginada. Ele resolve para um [`PaginatedResult`](./utility-types.pt-BR.md): `{ result: Entity[]; count: number }`.

- `result` respeita `order`, `pagination` e o `defaultOrdering` do repository (como o `find`).
- `count` ignora `order` e `pagination` de propósito: é o total de registros que batem em `where`, para você calcular o número de páginas.
- As duas queries usam o mesmo `where` já resolvido (incluindo o filtro de soft-delete/`see`) e o mesmo `db`, e rodam uma após a outra.

```typescript
const pageSize = 20;

const { result, count } = await userRepository.findAndCount(
    { active: true },
    { order: { createdAt: "desc" }, pagination: { limit: pageSize, offset: 40 } },
);

const totalPages = Math.ceil(count / pageSize);
```

A mesma operação existe como [método dinâmico](./dynamic-methods.pt-BR.md#prefixos-disponíveis) (`findAndCountBy`, `findAndCountWhere`) e, para queries montadas em tempo de execução, como [`getResultAndCount()`](./query-builder.pt-BR.md#paginação-com-getresultandcount) no query builder.

### Mesclando registros com `merge`

`merge(where, obj, options?)` busca o registro que bate em `where` e o combina, **em memória**, com `obj`. Nada é persistido — passe o resultado para `save` ou `patch` para gravá-lo. O `defaultOrdering` é aplicado, a menos que `options.order` seja informado, o que importa quando mais de um registro bate.

Sem nenhuma configuração, cada campo de `obj` sobrescreve o armazenado: objetos aninhados e arrays são **substituídos**, não mesclados; valores `undefined` são ignorados; e valores `null` são escritos. O registro buscado é o que é alterado e retornado, e o `obj` nunca é modificado.

Para mudar isso, passe um [`MergeConfig`](./utility-types.pt-BR.md) — nas options do construtor do repository (`mergeConfig`, para todas as chamadas) ou nas options do método (`options.mergeConfig`, só para aquela chamada). O das options do método **substitui** o do repository, não é combinado com ele.

| Campo               | Padrão     | Descrição                                                                                                                                                                                      |
| ------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `undefinedBehavior` | `"ignore"` | `"ignore"` ignora campos da origem com valor `undefined`, mantendo o valor armazenado; `"keep"` escreve o `undefined`.                                                                         |
| `nullBehavior`      | `"keep"`   | `"keep"` escreve campos da origem com valor `null`; `"ignore"` os ignora, mantendo o valor armazenado.                                                                                         |
| `fields`            | nenhum     | Estratégias por campo, pelo nome do campo. Campos não listados são sobrescritos pelo valor da origem. `undefinedBehavior` e `nullBehavior` também valem para as entidades aninhadas mescladas. |

Cada entrada de `fields` escolhe uma `strategy`. Só são aceitas as estratégias que combinam com o tipo do campo:

| Estratégia | Tipo do campo      | Comportamento                                                                                                                                                                                                                                                                             | Options extras                                                                          |
| ---------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `to-one`   | Entidade aninhada  | Mescla o objeto da origem **recursivamente** no armazenado em vez de substituí-lo.                                                                                                                                                                                                        | `fields` — estratégias da entidade aninhada (padrão: nenhuma).                          |
| `to-many`  | Array de entidades | Casa os itens das duas listas por `pk`: itens que casam são mesclados recursivamente, itens só na lista armazenada são mantidos e itens só na lista da origem são adicionados. Itens sem valor de `pk` não podem ser casados: os armazenados são mantidos e os da origem são adicionados. | `pk` (**obrigatório**); `fields` — estratégias de cada item (padrão: nenhuma).          |
| `concat`   | Array de escalares | Concatena a lista armazenada e a da origem, sem remover duplicados.                                                                                                                                                                                                                       | `whosFirst`: `"target"` (itens armazenados primeiro) ou `"source"`. Padrão: `"target"`. |
| `custom`   | Qualquer campo     | Armazena o que `customFn(target, source)` retornar. Só é chamada quando o valor da origem não é `null` nem `undefined` (esses seguem `nullBehavior`/`undefinedBehavior`), e `target` pode ser `undefined`.                                                                                | `customFn` (**obrigatório**).                                                           |

```typescript
const user = await userRepository.merge(
    { id: "1" },
    { name: "Maria", tags: ["admin"], address: { city: "Recife" }, posts: [{ id: 2, title: "Editado" }] },
    {
        relations: { address: true, posts: true },
        mergeConfig: {
            nullBehavior: "ignore",
            fields: {
                tags: { strategy: "concat", whosFirst: "source" },
                address: { strategy: "to-one" },
                posts: { strategy: "to-many", pk: "id" },
            },
        },
    },
);

if (user) await userRepository.save(user);
```

O registro é buscado com o `select`/`relations` das options, então carregue as relations nas quais quer mesclar: sem elas não há com o que casar.

### Options dos métodos

A maioria dos métodos aceita um objeto de options como último argumento, com um formato que depende do método:

| Tipo                                      | Campos                                                                   | Usado por                                                                                                                                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MethodOptions<Entity, OrmTypes>`         | `select`, `relations`, `see`, `db`, `pagination`, `order`                | `find`, `findAndCount`, `findOne`, `findOneOrThrow`, `get`, `getOrThrow` — os métodos de leitura, que também aplicam o `defaultOrdering` a menos que `order` seja passado.                                            |
| `SimpleMethodOptions<Entity, OrmTypes>`   | `select`, `relations`, `see`, `db`                                       | Métodos de um único registro que retornam uma `Entity` — `save`, `create`, `update`, `patch`, `upsert`, `delete`, `remove`, `increment`, ..., os métodos `*Returning` e os métodos de soft-delete de um registro.     |
| `MergeOptions<Entity, OrmTypes>`          | `select`, `relations`, `see`, `db`, `pagination`, `order`, `mergeConfig` | `merge` — as mesmas options de busca do `MethodOptions`, mais `mergeConfig`.                                                                                                                                          |
| `RestrictMethodOptions<Entity, OrmTypes>` | `see`, `db`                                                              | Métodos que não retornam uma `Entity` moldada — `count`, `exists`, `has`, `createMany`, `updateMany`, `deleteMany`, `sum`, `average`, `min`, `max`, os métodos numéricos `*Many` e os métodos de soft-delete em lote. |

`createMany` e `createManyReturning` também aceitam `ignoreConflicts`. `transaction`, `query` e `getDbClient` aceitam suas próprias options ou nenhuma.

---

## Soft-delete

O soft-delete é um conceito **nativo e de primeira classe**, habilitado por repository com o decorator de classe `@EnableSoftDelete`. Passe o campo (data, nullable) que marca um registro como removido:

```typescript
@EnableSoftDelete("deletedAt")
class UserRepository extends VSRepository<User, string> {
    constructor() {
        super({ pkName: "id", adapter });
    }
}
```

Se o campo é o mesmo em todos os seus repositories, defina-o uma vez com `VSRepository.setGlobalConfig({ softDeleteField: "deletedAt" })` e use `@EnableSoftDelete()` sem argumento. Habilitar o soft-delete sem um campo — no decorator ou globalmente — faz o construtor lançar um `VSRepoError`.

Isso libera seis métodos extras:

| Método                            | Efeito                                                      |
| --------------------------------- | ----------------------------------------------------------- |
| `softDelete(where, options?)`     | Define `deletedAt` para a data atual no registro que bater. |
| `softRemove(id, options?)`        | O mesmo que `softDelete`, pela chave primária.              |
| `softDeleteMany(where, options?)` | O mesmo, em lote — retorna `{ count }`.                     |
| `restore(where, options?)`        | Volta `deletedAt` para `null` no registro que bater.        |
| `recover(id, options?)`           | O mesmo que `restore`, pela chave primária.                 |
| `restoreMany(where, options?)`    | O mesmo, em lote — retorna `{ count }`.                     |

Chamar qualquer um deles num repository sem `@EnableSoftDelete` lança um `VSRepoError`. `delete`, `remove` e os outros métodos de remoção continuam **permanentes**, mesmo com o soft-delete habilitado.

Todos os métodos aceitam uma option `see` que controla a visibilidade de registros com soft-delete — inclusive os seis métodos acima:

```typescript
await userRepository.find({}, { see: "active" }); // padrão — apenas registros não removidos
await userRepository.find({}, { see: "removed" }); // apenas registros com soft-delete
await userRepository.find({}, { see: "all" }); // todos, ignorando o soft-delete
```

O padrão de `see` é `"active"` em todos os métodos, **exceto** nos seis métodos de soft-delete, cujo padrão é `"all"` — assim, por padrão, eles conseguem encontrar o registro independentemente de ele estar ou não já removido (por exemplo, o `restore` precisa encontrar um registro que já está com soft-delete):

```typescript
await userRepository.recover(id); // equivale a { see: "all" } — acha o registro mesmo removido
await userRepository.recover(id, { see: "removed" }); // só restaura se ele estiver com soft-delete
await userRepository.softRemove(id, { see: "active" }); // só remove se ele ainda estiver ativo
```

---

## Métodos atômicos e de agregação

Toda subclasse de `VSRepository` ganha métodos para trabalhar com campos numéricos, divididos em dois grupos:

**Updates atômicos** — avaliados no servidor contra o valor _atual_ da linha (`UPDATE ... SET field = field + value`), não um read-modify-write feito no client. O registro é selecionado por um `where`:

```typescript
await userRepository.increment("balance", 50, { id: "user-1" }); // balance = balance + 50
await userRepository.decrement("balance", 50, { id: "user-1" }); // balance = balance - 50
await userRepository.multiply("balance", 2, { id: "user-1" }); // balance = balance * 2
await userRepository.divide("balance", 4, { id: "user-1" }); // balance = balance / 4
```

Os quatro retornam a `Entity` atualizada e aceitam `SimpleMethodOptions<Entity, OrmTypes>` (`select`, `relations`, `see`, `db`) como último argumento.

Cada um tem uma variante `*Many` que aplica a operação a **todos** os registros que baterem em `where` e retorna `{ count }`, aceitando `RestrictMethodOptions<Entity, OrmTypes>` (`see`, `db`):

```typescript
await productRepository.incrementMany("stock", 10, { category: "books" }); // { count: 42 }
await productRepository.multiplyMany("price", 1.1, {}); // todos os produtos ativos
```

**Agregações** — calculadas sobre todos os registros que baterem num `where` (opcional):

```typescript
await userRepository.sum("balance"); // soma do saldo de todos os registros ativos
await userRepository.sum("balance", { active: true }); // ...restrito por um where
await userRepository.average("balance");
await userRepository.min("balance");
await userRepository.max("balance");
```

Os quatro retornam `number | null` — `null` quando nenhum registro bate no filtro, espelhando o comportamento de `SUM()`/`AVG()`/`MIN()`/`MAX()` do SQL, que retornam `NULL` (não `0`) sobre um conjunto vazio. Eles aceitam `RestrictMethodOptions<Entity, OrmTypes>` (apenas `see` e `db` — sem `select`/`relations`, já que o resultado é um número simples, não uma `Entity` moldada).

Os dois grupos respeitam o soft-delete/`see` do mesmo jeito que todo outro método base — `sum("balance")` só soma registros não removidos por padrão; passe `{ see: "all" }` ou `{ see: "removed" }` para mudar isso.

### Quais campos são elegíveis

`field` é restrito a `NumericKeys<Entity>` — chaves cujo valor (ignorando `null`/`undefined`) é um `number`, um `bigint`, ou um objeto `DecimalLike`:

```typescript
type Product = { id: string; name: string; price: Decimal; stock: number | null };

await productRepository.increment("price", new Decimal(10.5), { id }); // ok — Decimal-like
await productRepository.increment("stock", 5, { id }); // ok — campos numéricos nullable são incluídos
await productRepository.increment("name", 1, { id }); // erro de compilação — "name" não é numérico
```

`value` é tipado como `NonNullable<Entity[Field]>` — precisa bater exatamente com o tipo do próprio campo. Um campo `Decimal` espera uma instância de `Decimal`, não um `number`/`string` puro:

```typescript
await productRepository.increment("price", new Decimal(10.5), { id }); // ok
await productRepository.increment("price", 10.5, { id }); // erro de compilação — envolva: new Decimal(10.5)
```

Vale notar que vários ORMs (Drizzle, MikroORM, TypeORM) representam colunas `decimal`/`numeric` como `string` pura por padrão, para evitar perda de precisão de ponto flutuante — um campo `string` **não** satisfaz `NumericKeys<Entity>` de cara. Configure a coluna em modo numérico (ou um transformer) nesses ORMs se quiser que o campo seja utilizável com esses métodos.

[⬆️ Voltar ao topo](#top)
