<a id="top"></a>

🇧🇷 Português | [🇺🇸 English](./query-builder.md)

[← Voltar para o Sumário](./README.pt-BR.md)

# Query builder

`createQueryBuilder(db?)` retorna um builder fluente para queries cujo formato só é conhecido em tempo de execução — filtros opcionais, ordenação e paginação controladas pelo usuário, etc. — onde declarar um `@DynamicMethod` para cada combinação seria inviável. Ele está disponível em toda instância de `VSRepository` e passa pelo mesmo adapter de todos os outros métodos:

```typescript
const { result, count } = await userRepository
    .createQueryBuilder()
    .where({ active: true, balance: { gte: 100 } })
    .relations({ address: true })
    .orderBy({ createdAt: "desc" })
    .limit(20)
    .offset(40)
    .getResultAndCount();
```

Nada chega ao banco até que um **método terminal** (`getResult()`, `getCount()`, ...) seja chamado. O builder é **mutável**: cada chamada encadeada altera a mesma instância e a retorna, então use [`clone()`](#reutilizando-e-clonando-um-builder) para derivar variações de uma base comum.

Para queries cujo SQL é específico demais para o modelo desse builder — funções de janela, sintaxe específica do banco, subqueries ad-hoc, CTEs — veja o [Raw query builder](./raw-query-builder.pt-BR.md).

## Construindo a query

| Método                 | Descrição                                                                                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `select(select)`       | Campos (e campos de relações aninhadas) a selecionar — mesmo formato de [`select` e `relations`](./select-and-relations.pt-BR.md#select-e-relations). Substitui qualquer `select` anterior. |
| `relations(relations)` | Relações a carregar junto. Substitui qualquer `relations` anterior.                                                                                                                         |
| `where(where)`         | O filtro: o mesmo `VSRepoWhere` usado no resto da biblioteca (operadores de campo, filtros de relação e `AND`/`OR`/`NOT`). Substitui qualquer filtro anterior.                              |
| `orderBy(order)`       | Um objeto ou um array de objetos com `"asc"`/`"desc"` (minúsculo ou maiúsculo). Apenas campos escalares podem ser ordenados. Substitui qualquer ordenação anterior.                         |
| `limit(limit)`         | Número máximo de registros. Precisa ser um inteiro não negativo.                                                                                                                            |
| `offset(offset)`       | Número de registros a pular. Precisa ser um inteiro não negativo.                                                                                                                           |
| `distinctOn(fields)`   | Um campo primitivo, ou um array deles, para aplicar `distinct`. Só é usado pelo `getResult()`.                                                                                              |
| `see(mode)`            | Visibilidade do soft-delete: `"active"` (padrão), `"removed"` ou `"all"`. Veja [Soft-delete com `see()`](#soft-delete-com-see).                                                             |

Chamar `where()` de novo substitui o filtro anterior, e o filtro de [soft-delete](#soft-delete-com-see) é adicionado por cima dele quando a query roda. Como o builder é mutável, um filtro que depende de entradas opcionais é mais fácil de montar como objeto antes:

```typescript
import type { VSRepoWhere } from "vsrepo";

async function buscar(filtros: { name?: string; apenasAtivos?: boolean; pagina: number }) {
    const where: VSRepoWhere<User> = {};

    if (filtros.name) where.name = { contains: filtros.name, ignoreCase: true };
    if (filtros.apenasAtivos) where.active = true;

    return userRepository
        .createQueryBuilder()
        .where(where)
        .orderBy({ createdAt: "desc" })
        .limit(20)
        .offset((filtros.pagina - 1) * 20)
        .getResultAndCount();
}
```

## Obtendo resultados

| Método                  | Retorna                               | Chamada no adapter   | Enviado ao adapter                                                                   |
| ----------------------- | ------------------------------------- | -------------------- | ------------------------------------------------------------------------------------ |
| `getResult()`           | `Entity[]`                            | `findMany`           | `where`, `select`, `relations`, `order`, `pagination`, `distinct`                    |
| `getOneResult()`        | `Entity \| null`                      | `findOne`            | `where`, `select`, `relations`, `order`, `pagination`                                |
| `getOneResultOrThrow()` | `Entity` (lança se não encontrar)     | `findOneOrThrow`     | `where`, `select`, `relations`, `order`, `pagination`                                |
| `getCount()`            | `number`                              | `count`              | `where`, `order`, `pagination`                                                       |
| `getExistence()`        | `boolean`                             | `exists`             | `where`                                                                              |
| `getResultAndCount()`   | `{ result: Entity[]; count: number }` | `findMany` + `count` | `findMany`: `where`, `select`, `relations`, `order`, `pagination` — `count`: `where` |

Todo método terminal também aplica o modo de [`see`](#soft-delete-com-see) ao `where` e roda no `db` do builder (veja [`setDb()`](#transações-e-setdb)). Observações:

- Os resultados são tipados como a `Entity` inteira, igual aos métodos base — `select` e `relations` mudam o que é carregado, não o tipo. Veja [Tipagem de retorno restrita com `InferMethodReturn`](./select-and-relations.pt-BR.md#tipagem-de-retorno-restrita-com-infermethodreturn) se quiser estreitá-lo.
- `distinctOn()` só é enviado pelo `getResult()`: o `count` não suporta `distinct`, então `getCount()`, `getExistence()` e `getResultAndCount()` não o utilizam.
- `getCount()` repassa `order` e `pagination` para o `count` do adapter. Se você quer o total de um builder que tem paginação, use `getResultAndCount()` ou conte a partir de um [`clone()`](#reutilizando-e-clonando-um-builder) sem ela.

## Paginação com `getResultAndCount()`

Busca uma página e o total de registros que batem com o filtro em uma única chamada, tipo o `getResultAndCount()` do MikroORM. O `result` respeita `order`, `limit` e `offset`; o `count` ignora `order` e `pagination` de propósito — ele é o total de registros que batem com o `where`, para você calcular o número de páginas. As duas queries rodam em paralelo com o mesmo `where` resolvido e o mesmo `db`.

```typescript
const pageSize = 20;

const { result, count } = await userRepository
    .createQueryBuilder()
    .where({ active: true })
    .orderBy({ createdAt: "desc" })
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .getResultAndCount();

const totalPages = Math.ceil(count / pageSize);
```

## Soft-delete com `see()`

Em um repository com [`softRemoveKey`](./base-methods.pt-BR.md#soft-delete), o builder só enxerga registros não removidos por padrão, como todos os outros métodos. Use `see()` para mudar isso — vale para todos os métodos terminais (inclusive as duas queries do `getResultAndCount()`):

```typescript
await userRepository.createQueryBuilder().getResult(); // padrão — apenas registros não removidos
await userRepository.createQueryBuilder().see("removed").getResult(); // apenas registros com soft-delete
await userRepository.createQueryBuilder().see("all").getResult(); // todos, ignorando o soft-delete
```

Repositories sem `softRemoveKey` ignoram o `see()`.

## Transações e `setDb()`

`createQueryBuilder(db?)` aceita o client ou a transação em que a query vai rodar. Como nada roda até que um método terminal seja chamado, você também pode montar a query antes e escolher onde ela roda depois, com `setDb()`:

```typescript
const qb = userRepository.createQueryBuilder().where({ active: true }).orderBy({ createdAt: "desc" });

await userRepository.transaction(async tx => {
    qb.setDb(tx); // daqui em diante, o builder roda dentro da transação
    const users = await qb.getResult();

    await userLogsRepository.save({ action: "Usuários listados", data: { count: users.length } }, { db: tx });
});
```

O `setDb()` também é útil junto com o `clone()` para rodar a mesma query em outro client sem mexer no builder original.

## Reutilizando e clonando um builder

`clone()` retorna um builder independente com o mesmo filtro, options, campos de `distinctOn`, modo de `see` e `db`. Alterações feitas em qualquer um dos dois depois disso não afetam o outro:

```typescript
const ativos = userRepository.createQueryBuilder().where({ active: true });

const total = await ativos.clone().getCount();
const primeiraPagina = await ativos.clone().orderBy({ name: "asc" }).limit(10).getResult();
```

## Validação e erros

Os argumentos são validados assim que são passados para um método encadeado, e não quando a query roda. Um argumento inválido lança um `VSRepoError` com `type: VSRepoErrorType.QUERY_BUILDER`, cuja mensagem começa pelo argumento problemático, e deixa o builder inalterado. `limit` e `offset` precisam ser inteiros não negativos; nos outros métodos a validação confere o formato do argumento.

```typescript
import { VSRepoError, VSRepoErrorType } from "vsrepo";

try {
    userRepository.createQueryBuilder().limit(-1);
} catch (error) {
    if (error instanceof VSRepoError && error.type === VSRepoErrorType.QUERY_BUILDER) {
        console.error(error.message);
    }
}
```

Erros lançados pelo adapter enquanto a query roda (ex.: `VSRepoAdapterError`) não são encapsulados — chegam até você sem alterações.

## Logs do query builder

O builder usa o logger do repository, então segue o mesmo `logLevel` e `logSlowThresholdMs` (veja [Logging](./logging.pt-BR.md#logging)):

- `DEBUG` registra cada chamada encadeada e, em cada método terminal, a query resolvida: o modo de `see`, o `where` final (já incluindo o filtro de soft-delete) e as options enviadas ao adapter. O `db` nunca é logado.
- Todo método terminal tem o tempo medido como `run query builder <método>`: a duração é logada em `DEBUG` e promovida a `WARN` quando passa de `logSlowThresholdMs`.
- Argumentos inválidos são logados em `ERROR` logo antes de o `VSRepoError` ser lançado.

Por exemplo, `.where({ active: true }).orderBy({ createdAt: "desc" }).limit(20).getResultAndCount()` em um repository com `softRemoveKey` imprime isto em `DEBUG` (sem os timestamps e sem as linhas das chamadas encadeadas):

```text
[DEBUG] [UserRepositoryLogger] VSQueryBuilder: getResultAndCount
{
  "see": "active",
  "where": {
    "active": true,
    "deletedAt": null
  },
  "options": {
    "order": {
      "createdAt": "desc"
    },
    "pagination": {
      "limit": 20
    }
  }
}
[DEBUG] [UserRepositoryLogger] Starting to run query builder getResultAndCount...
[DEBUG] [UserRepositoryLogger] Took 0.11ms to run query builder getResultAndCount
```

[⬆️ Voltar ao topo](#top)
