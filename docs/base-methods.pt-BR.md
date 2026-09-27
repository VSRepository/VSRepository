<a id="top"></a>

# Métodos base, configuração & soft-delete

🇧🇷 Português | [🇺🇸 English](./base-methods.md)

[← Voltar para o Sumário](./README.pt-BR.md)

## Options do construtor

`VSRepoOptions<T, K>`, passado para o `super(...)` dentro do construtor do seu repository:

| Option               | Tipo                | Descrição                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `adapter`            | `VSRepoAdapter<T>`  | **Obrigatório.** A instância do adapter que traduz as chamadas do repository em chamadas contra o ORM/banco por trás dele.                                                                                                                                                                                                                                                                                                      |
| `pkName`             | `keyof T`           | Opcional. Nome do campo que representa a primary key da entidade. Quando omitido, o repository usa o `getPkName()` do adapter. Se o adapter também não implementar, o construtor lança um `VSRepoError`.                                                                                                                                                                                                                        |
| `softRemoveKey`      | `keyof T`           | Opcional. Quando definido, habilita `softRemove`, `softRemoveList`, `restore` e `restoreList`.                                                                                                                                                                                                                                                                                                                                  |
| `defaultOrdering`    | `Ordering<T>`       | Opcional. Ordenação padrão aplicada automaticamente em queries que aceitam `order`, a menos que seja sobrescrita em uma chamada específica.                                                                                                                                                                                                                                                                                     |
| `logLevel`           | `VSLogLevel`        | Opcional. Severidade mínima impressa pelo logger interno. Padrão: `VSLogLevel.WARN`.                                                                                                                                                                                                                                                                                                                                            |
| `logSlowThresholdMs` | `number \| boolean` | Opcional. Duração (ms) acima da qual uma operação concluída é logada como `WARN`. Padrão: 300ms. Passe `false` para desabilitar completamente os avisos de operação lenta; passe `true` para usar explicitamente o threshold padrão de 300ms.                                                                                                                                                                                   |
| `lazyDynamicMethods` | `boolean`           | Opcional. Padrão: `false`. Quando `true`, adia a resolução dos métodos `@DynamicMethod`/`@QueryMethod` — quem chama é o próprio repository, manualmente, via `resolveDynamicMethods()`. Veja [Resolução lazy dos métodos dinâmicos](./dynamic-methods.pt-BR.md#resolução-lazy-dos-métodos-dinâmicos).                                                                                                                           |
| `vsPlaceholders`     | `boolean`           | Opcional. Padrão: `false`. Quando `true`, strings SQL cruas passadas para `query()` e `@QueryMethod` usam os placeholders próprios, agnósticos, posicionais e de base 1 do VSRepository (`?1`, `?2`, ...) em vez da sintaxe nativa do seu adapter. Exige que o adapter implemente `getPlaceholder()`. Veja [Placeholders agnósticos com `vsPlaceholders`](./query-methods.pt-BR.md#placeholders-agnósticos-com-vsplaceholders). |

---

## Métodos base

Disponíveis automaticamente em toda subclasse de `VSRepository`:

| Método                                  | Descrição                                                                                                                                                                                                      |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get(pk, options?)`                     | Busca um registro pela primary key.                                                                                                                                                                            |
| `getOrThrow(pk, options?)`              | Busca um registro pela primary key, lançando erro se não encontrar.                                                                                                                                            |
| `getList(pks, options?)`                | Busca vários registros por uma lista de primary keys.                                                                                                                                                          |
| `getAll(options?)`                      | Busca todos os registros; aceita `pagination` e `order` em `options`.                                                                                                                                          |
| `save(obj, options?)`                   | Cria ou atualiza (upsert) um único registro.                                                                                                                                                                   |
| `saveList(objs, options?)`              | Cria ou atualiza (upsert) vários registros em uma única chamada.                                                                                                                                               |
| `patch(pk, obj, options?)`              | Atualiza parcialmente um registro pela primary key.                                                                                                                                                            |
| `merge(pk, obj, options?)`              | Busca um registro e o retorna mesclado (deep-merge), em memória, com o objeto informado — **não** persiste nada.                                                                                               |
| `remove(pk, options?)`                  | Remove um registro pela primary key.                                                                                                                                                                           |
| `removeList(pks, options?)`             | Remove vários registros pela primary key, retornando `{ count }`.                                                                                                                                              |
| `total(options?)`                       | Retorna o total de registros.                                                                                                                                                                                  |
| `has(pk, options?)`                     | Verifica se um registro existe, retornando `boolean`.                                                                                                                                                          |
| `increment(pk, field, value, options?)` | Adiciona `value` a um campo numérico de forma atômica. Veja [Métodos atômicos e de agregação](#métodos-atômicos-e-de-agregação).                                                                               |
| `decrement(pk, field, value, options?)` | Subtrai `value` de um campo numérico de forma atômica.                                                                                                                                                         |
| `multiply(pk, field, value, options?)`  | Multiplica um campo numérico por `value` de forma atômica.                                                                                                                                                     |
| `divide(pk, field, value, options?)`    | Divide um campo numérico por `value` de forma atômica.                                                                                                                                                         |
| `sum(field, where?, options?)`          | Soma um campo numérico em todos os registros que baterem no filtro; `null` se nenhum bater.                                                                                                                    |
| `average(field, where?, options?)`      | Média aritmética de um campo numérico em todos os registros que baterem no filtro; `null` se nenhum bater.                                                                                                     |
| `min(field, where?, options?)`          | Valor mínimo de um campo numérico em todos os registros que baterem no filtro; `null` se nenhum bater.                                                                                                         |
| `max(field, where?, options?)`          | Valor máximo de um campo numérico em todos os registros que baterem no filtro; `null` se nenhum bater.                                                                                                         |
| `transaction(fn, options?)`             | Executa `fn` dentro de uma transação nativa do ORM.                                                                                                                                                            |
| `getDbClient()`                         | Retorna a instância do client do ORM.                                                                                                                                                                          |
| `query<T>(query, options?)`             | Executa uma instrução SQL raw diretamente contra o banco — aceita uma string crua ou um fragmento `VSSql`. Veja [Queries raw pontuais com `query()`](./query-methods.pt-BR.md#queries-raw-pontuais-com-query). |
| `createQueryBuilder(db?)`               | Cria um [query builder](./query-builder.pt-BR.md#query-builder) fluente para queries montadas em tempo de execução.                                                                                            |

A maioria dos métodos acima aceita um objeto `MethodOptions<Entity, OrmTypes>` como último argumento (`select`, `relations`, `see`, `db`). Alguns — `total`, `has`, `removeList`, `sum`, `average`, `min`, `max`, e os métodos em lote de soft-delete (`softRemoveList`/`restoreList`) — não retornam/moldam uma `Entity`, então aceitam o tipo mais restrito `RestrictMethodOptions<Entity, OrmTypes>` (só `see`, `db`; sem `select`/`relations`). `transaction`, `query` e `getDbClient` recebem options próprias ou nenhuma.

---

## Soft-delete

O soft-delete é um **conceito nativo de primeira classe**. Configure `softRemoveKey` uma vez no repository:

```typescript
super({
    pkName: "id",
    adapter,
    softRemoveKey: "deletedAt",
});
```

Isso libera quatro métodos extras:

| Método                          | Efeito                                  |
| ------------------------------- | --------------------------------------- |
| `softRemove(pk, options?)`      | Define `deletedAt` para a data atual.   |
| `softRemoveList(pks, options?)` | O mesmo, em lote — retorna `{ count }`. |
| `restore(pk, options?)`         | Volta `deletedAt` para `null`.          |
| `restoreList(pks, options?)`    | O mesmo, em lote — retorna `{ count }`. |

Todo o restante dos métodos aceita uma option `see` que controla a visibilidade de registros com soft-delete:

```typescript
await userRepository.getAll({ see: "active" }); // padrão — apenas registros não removidos
await userRepository.getAll({ see: "removed" }); // apenas registros com soft-delete
await userRepository.getAll({ see: "all" }); // todos, ignorando o soft-delete
```

---

## Métodos atômicos e de agregação

Toda subclasse de `VSRepository` ganha 8 métodos para trabalhar com campos numéricos, divididos em dois grupos:

**Updates atômicos** — avaliados no servidor contra o valor _atual_ da linha (`UPDATE ... SET field = field + value`), não um read-modify-write feito no client:

```typescript
await userRepository.increment("user-1", "balance", 50); // balance = balance + 50
await userRepository.decrement("user-1", "balance", 50); // balance = balance - 50
await userRepository.multiply("user-1", "balance", 2); // balance = balance * 2
await userRepository.divide("user-1", "balance", 4); // balance = balance / 4
```

Os quatro retornam a `Entity` atualizada e aceitam o `MethodOptions<Entity, OrmTypes>` completo (`select`, `relations`, `see`, `db`) como último argumento, igual `get`/`save`/`patch`.

**Agregações** — calculadas sobre todos os registros que baterem num `where` (opcional):

```typescript
await userRepository.sum("balance"); // soma do saldo de todos os registros ativos
await userRepository.sum("balance", { active: true }); // ...restrito por um where
await userRepository.average("balance");
await userRepository.min("balance");
await userRepository.max("balance");
```

Os quatro retornam `number | null` — `null` quando nenhum registro bate no filtro, espelhando o comportamento de `SUM()`/`AVG()`/`MIN()`/`MAX()` do SQL, que retornam `NULL` (não `0`) sobre um conjunto vazio. Diferente dos métodos atômicos, eles aceitam o tipo mais restrito `RestrictMethodOptions<Entity, OrmTypes>` (só `see`, `db` — sem `select`/`relations`, já que o resultado é um número simples, não uma `Entity` moldada).

Os dois grupos respeitam `softRemoveKey`/`see` do mesmo jeito que todo outro método base — `sum("balance")` só soma registros não removidos por padrão; passe `{ see: "all" }` ou `{ see: "removed" }` para mudar isso.

### Quais campos são elegíveis

`field` é restrito a `NumericKeys<Entity>` — chaves cujo valor (ignorando `null`/`undefined`) é um `number`, um `bigint`, ou um objeto `DecimalLike` (qualquer coisa que exponha `toNumber()` e `decimalPlaces()`, como o `Prisma.Decimal` do Prisma):

```typescript
type Product = { id: string; name: string; price: Decimal; stock: number | null };

await productRepository.increment(id, "price", new Decimal(10.5)); // ok — Decimal-like
await productRepository.increment(id, "stock", 5); // ok — campos numéricos nullable são incluídos
await productRepository.increment(id, "name", 1); // erro de compilação — "name" não é numérico
```

`value` é tipado como `NonNullable<Entity[Field]>` — precisa bater exatamente com o tipo do próprio campo. Um campo `Decimal` espera uma instância de `Decimal`, não um `number`/`string` puro:

```typescript
await productRepository.increment(id, "price", new Decimal(10.5)); // ok
await productRepository.increment(id, "price", 10.5); // erro de compilação — envolva: new Decimal(10.5)
```

Vale notar que vários ORMs (Drizzle, MikroORM, TypeORM) representam colunas `decimal`/`numeric` como `string` pura por padrão, para evitar perda de precisão de ponto flutuante — um campo `string` **não** satisfaz `NumericKeys<Entity>` por padrão. Configure a coluna em modo numérico (ou um transformer) nesses ORMs se quiser que o campo fique disponível para esses 8 métodos.

[⬆️ Voltar ao topo](#top)
