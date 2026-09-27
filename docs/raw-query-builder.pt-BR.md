<a id="top"></a>

[🇺🇸 English](./raw-query-builder.md) | 🇧🇷 Você está lendo a versão em português

[← Voltar ao índice](./README.pt-BR.md)

# Raw query builder

`createRawQueryBuilder(db?)` retorna um SQL builder fluente, agnóstico de ORM para queries **`SELECT`** escritas à mão, cujo SQL é específico demais (funções de janela, sintaxe específica do banco, subqueries ad-hoc, CTEs, ...) para caber no modelo `where`/`relations` do [`createQueryBuilder()`](./query-builder.pt-BR.md). Está disponível em toda instância de `VSRepository` e passa pelo mesmo adapter que os demais métodos:

```typescript
import { VSSql } from "vsrepo";

const rows = await orderRepository
    .createRawQueryBuilder()
    .select("o.id", "o.total", "u.name")
    .from("order", "o")
    .innerJoin("user", "u", "u.id = o.user_id")
    .where(VSSql.sql`u.active = ${true}`)
    .andWhere("o.deleted_at is null")
    .groupBy("o.id", "u.name")
    .having(VSSql.sql`count(*) > ${1}`)
    .orderBy("o.total", "desc")
    .limit(20)
    .offset(0)
    .execute<{ id: string; total: number; name: string }[]>();
```

Nada chega ao banco até que [`execute()`](#executando-a-query) seja chamado. O builder é **mutável**: cada chamada encadeada altera a própria instância e a retorna, então use [`clone()`](#reutilizando-e-clonando-um-builder) para derivar variações de uma base comum. `VSRawQueryBuilder` e `VSRawQueryBuilderTarget`/`VSRawQueryBuilderCteQuery` são exportados de `vsrepo` caso você precise tipar um builder ou uma função de subquery.

Exige que o adapter implemente `getPlaceholder()` — mesmo requisito do [`VSSql`](./query-methods.pt-BR.md#fragmentos-parametrizados-com-vssql) — já que `toSql()`/`execute()` compilam a query através dele. Chamar qualquer um dos dois sem isso lança um `VSRepoError`.

## Construindo a query

Toda cláusula aceita uma string crua e confiável (um identificador para `select`/`from`/`groupBy`/`orderBy`, ou uma condição simples para `on`/`where`/`having`, passada como está — nunca passe input do usuário) ou um fragmento [`VSSql`](./query-methods.pt-BR.md#fragmentos-parametrizados-com-vssql) para qualquer coisa parametrizada ou com alias:

| Método                                                                 | Descrição                                                                                                                                             |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `select(...columns)`                                                   | Colunas/expressões a selecionar, substituindo qualquer `select` anterior. Sem argumentos equivale a `SELECT *`.                                       |
| `from(target, alias?)`                                                 | O alvo do `FROM`, substituindo qualquer um anterior. Veja [Subqueries](#subqueries).                                                                  |
| `innerJoin/leftJoin/rightJoin/fullJoin(target, alias, on)`             | Adiciona um join. `target` aceita os mesmos valores que `from()`; `on` é uma string de condição crua ou um fragmento `VSSql`.                         |
| `where(condition)` / `andWhere(condition)`                             | Adiciona uma condição `WHERE`. A primeira chamada define o filtro; toda `where`/`andWhere` seguinte é combinada com `AND`, cada uma entre parênteses. |
| `orWhere(condition)`                                                   | Combina `condition` com `OR` ao filtro `WHERE` existente.                                                                                             |
| `groupBy(...columns)`                                                  | Adiciona colunas ao `GROUP BY`. Cada chamada acumula.                                                                                                 |
| `having(condition)` / `andHaving(condition)` / `orHaving(condition)`   | Mesma semântica `AND`/`OR` de `where`/`andWhere`/`orWhere`, para `HAVING`.                                                                            |
| `orderBy(column, direction?)`                                          | Adiciona uma coluna ao `ORDER BY`. Cada chamada acumula, então chame uma vez por coluna para ordenação multi-coluna. `direction` é `"asc"`/`"desc"`.  |
| `limit(limit)`                                                         | Número máximo de linhas. Deve ser um inteiro não-negativo.                                                                                            |
| `offset(offset)`                                                       | Número de linhas a pular. Deve ser um inteiro não-negativo.                                                                                           |
| `with(name, query, columns?)` / `withRecursive(name, query, columns?)` | Adiciona um `WITH` (CTE). Veja [CTEs com `with()`/`withRecursive()`](#ctes-com-withwithrecursive).                                                    |

## Subqueries

`from()` e todo `join()` aceitam, além de um nome de tabela cru ou um fragmento `VSSql`, outro `VSRawQueryBuilder` (compilado inline e envolvido em parênteses) ou uma **função de subquery** — `sub => sub.select(...)...` — que recebe um builder novo compartilhando o `db`/adapter/logger deste, então você não precisa chamar `createRawQueryBuilder()` de novo pra ela:

```typescript
// Builder de subquery passado diretamente
const recentOrders = orderRepository
    .createRawQueryBuilder()
    .select("*")
    .from("order")
    .where(VSSql.sql`created_at > now() - interval '7 days'`);

const perUser = await orderRepository
    .createRawQueryBuilder()
    .select("user_id", VSSql.sql`count(*) AS total`)
    .from(recentOrders, "recent")
    .groupBy("user_id")
    .execute();

// Função de subquery, inline
const qb = userRepository
    .createRawQueryBuilder()
    .select("u.id")
    .from("user", "u")
    .innerJoin(sub => sub.select("user_id").from("order").groupBy("user_id"), "o", VSSql.sql`o.user_id = u.id`);
```

Uma subquery também pode ser inserida diretamente num fragmento `VSSql` em qualquer lugar — mais comumente dentro de um `WHERE ... IN (...)` — via [`toVSSql()`](#executando-a-query):

```typescript
const usersWithOrders = await userRepository
    .createRawQueryBuilder()
    .select("*")
    .from("user")
    .where(VSSql.sql`id IN (${orderRepository.createRawQueryBuilder().select("user_id").from("order").toVSSql()})`)
    .execute();
```

## CTEs com `with()`/`withRecursive()`

`with(name, query, columns?)` adiciona um `WITH` (common table expression) que qualquer `from()`/`join()`/subquery posterior no mesmo builder pode referenciar por `name`, como se fosse uma tabela normal. Cada chamada adiciona uma CTE; chame de novo para adicionar mais — todas ficam listadas sob um único `WITH`, na ordem em que foram adicionadas. `query` aceita os mesmos valores que uma [subquery](#subqueries) (um `VSRawQueryBuilder`, uma função de subquery, ou um fragmento `VSSql`), e `columns` é uma lista explícita e opcional de colunas, renderizada como `name(col1, col2) AS (...)`:

```typescript
const rows = await orderRepository
    .createRawQueryBuilder()
    .with("big_spenders", qb => qb.select("user_id").from("order").groupBy("user_id").having("sum(total) > 1000"))
    .select("u.*")
    .from("user", "u")
    .innerJoin("big_spenders", "bs", "bs.user_id = u.id")
    .execute();
```

`withRecursive(name, query, columns?)` é o mesmo, mas marca a cláusula `WITH` inteira como `RECURSIVE` — exigido pelo padrão SQL para uma CTE que referencia a si mesma no próprio corpo. Como um builder de `SELECT` único não consegue expressar um `UNION`, o corpo recursivo geralmente é um fragmento `VSSql`:

```typescript
const orgChart = await employeeRepository
    .createRawQueryBuilder()
    .withRecursive(
        "subordinates",
        VSSql.sql`
            SELECT id, manager_id, 1 AS depth FROM employee WHERE id = ${managerId}
            UNION ALL
            SELECT e.id, e.manager_id, s.depth + 1 FROM employee e
            INNER JOIN subordinates s ON e.manager_id = s.id
        `,
        ["id", "manager_id", "depth"],
    )
    .select("*")
    .from("subordinates")
    .orderBy("depth")
    .execute();
```

Uma única CTE recursiva já é suficiente para tornar a cláusula inteira `WITH RECURSIVE`, mesmo combinada com outras, não-recursivas, adicionadas via `with()`.

## Executando a query

| Método         | Retorna      | Descrição                                                                                                                                                                                                                                                                                  |
| -------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `toVSSql()`    | `VSSql`      | Compila todas as cláusulas em um único fragmento `VSSql`, na ordem `WITH` → `SELECT` → `FROM` → `JOIN`s → `WHERE` → `GROUP BY` → `HAVING` → `ORDER BY` → `LIMIT` → `OFFSET`. Nada é executado — insira o resultado em outro fragmento como subquery, ou passe para `VSRepository.query()`. |
| `toSql()`      | `string`     | Compila para uma string SQL simples, renderizada com a sintaxe de placeholder do próprio adapter (`$1`, `$2`, ... ou `?`). Os valores **não** são interpolados — use `toVSSql()` (`.compile()`) se também precisar deles.                                                                  |
| `execute<T>()` | `Promise<T>` | Compila e executa a query através do adapter, retornando o que `adapter.query()` resolver para esse SQL (normalmente as linhas encontradas). `T` tem default `any`.                                                                                                                        |

`toVSSql()` lança um `VSRepoError` se nenhum alvo de `from()` foi definido (`select()` sozinho tem default `SELECT *`, então nunca é o que está faltando). `toSql()`/`execute()` também lançam se o adapter não implementa `getPlaceholder()`.

## Transações e `setDb()`

`createRawQueryBuilder(db?)` aceita o client ou transaction em que rodar. Como nada é executado até `execute()` ser chamado, também dá pra montar a query primeiro e escolher onde ela roda depois com `setDb()`:

```typescript
const qb = orderRepository.createRawQueryBuilder().select("*").from("order");

await orderRepository.transaction(async tx => {
    qb.setDb(tx); // a partir daqui, execute() roda dentro da transaction
    return qb.execute();
});
```

`setDb()` também é útil junto com `clone()` para rodar a mesma query contra outro client sem alterar o builder original.

## Reutilizando e clonando um builder

`clone()` retorna um builder independente com as mesmas cláusulas (incluindo CTEs) e o mesmo `db`. Mudanças feitas em um deles depois não afetam o outro:

```typescript
const base = userRepository
    .createRawQueryBuilder()
    .select("id")
    .from("user")
    .where(VSSql.sql`active = ${true}`);

const withAdmins = await base.clone().andWhere("is_admin = true").execute();
const withMinAge = await base
    .clone()
    .andWhere(VSSql.sql`age > ${18}`)
    .execute();
```

## Validação e erros

Os argumentos são validados assim que passados a um método encadeado, não quando a query roda. Um argumento inválido lança um `VSRepoError` com `type: VSRepoErrorType.QUERY_BUILDER`, cuja mensagem começa com o argumento problemático, e deixa o builder inalterado. `limit` e `offset` devem ser inteiros não-negativos. Toda string crua aceita como identificador, condição, alias ou nome/coluna de CTE (diferente de um fragmento `VSSql`) deve ser não-vazia/não-em-branco — uma vazia, do contrário, compilaria silenciosamente em SQL quebrado (uma vírgula sobrando, um `WHERE ()` vazio, ...) em vez de falhar onde você a chamou:

- Colunas de `select`/`groupBy`/`orderBy`, e condições de `where`/`andWhere`/`orWhere`/`having`/`andHaving`/`orHaving`/`on`, quando passadas como string
- `alias` de `from`/join, quando informado
- `name` de `with`/`withRecursive`, e cada item de seu `columns` opcional

Isso é só uma checagem de presença — a biblioteca nunca faz parsing nem valida de qualquer outra forma o _conteúdo_ de uma string SQL crua.

```typescript
import { VSRepoError, VSRepoErrorType } from "vsrepo";

try {
    userRepository.createRawQueryBuilder().limit(-1);
} catch (error) {
    if (error instanceof VSRepoError && error.type === VSRepoErrorType.QUERY_BUILDER) {
        console.error(error.message); // [VSRepository] Error: limit: Invalid value: Expected >=0 but received -1
    }
}
```

Erros lançados pelo adapter enquanto a query roda (ex.: `VSRepoAdapterError`) não são encapsulados — chegam até você sem alteração.

## Logs do raw query builder

O builder usa o logger do repository, então segue o mesmo `logLevel` e `logSlowThresholdMs` (veja [Logging](./logging.pt-BR.md#logging)):

- Em `DEBUG`, registra as chamadas a `setDb`/`clone` e, antes de `execute()` rodar, a query compilada e seus args. O `db` nunca é logado.
- `execute()` tem o tempo medido como `run raw query builder execute`: a duração é logada em `DEBUG` e promovida a `WARN` quando excede o `logSlowThresholdMs`.

[⬆️ Voltar ao topo](#top)
