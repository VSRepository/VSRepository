# Testes

Este projeto (v2) tem dois tipos de teste, em duas pastas separadas:

```text
test/
  implementation/   # Testes de implementação (comportamento em runtime), rodados com Jest
  typing/           # Testes de tipagem (compile-time), checados com tsc --noEmit
  helpers/          # Fake adapter, entidades e repository de exemplo usados pelos testes
  tsconfig.json     # tsconfig usado pelo ts-jest para compilar os testes de implementação
```

## Diferença em relação à v1

Na v1, `VSRepository` falava diretamente com o Prisma, então os testes de implementação
rodavam contra um Postgres real (via `DATABASE_URL`). Na v2, `VSRepository` é **ORM-agnostic**:
ela nunca fala com um banco/ORM diretamente, apenas delega toda operação para um `VSRepoAdapter`
(`findOne`, `findMany`, `save`, `update`, `delete`, `runInTransaction`, etc — ver `src/VSRepoAdapter.ts`).

Por isso, **nenhum teste do core precisa de banco real**. Em vez disso, usamos um `VSRepoAdapter`
falso (`test/helpers/fake-adapter.ts`, com todos os métodos mockados via `jest.fn()`) e verificamos:

- **quais** métodos do adapter são chamados para cada operação (`get` → `adapter.findOne`,
  `findByEmail` → `adapter.findMany`, `existsByEmail` → `adapter.exists`, etc);
- **com quais argumentos** (`where` resolvido a partir do nome do método/PK/`softRemoveKey`,
  `options` como `pagination`, `order`, `db`, `see`);
- que o retorno do adapter é propagado sem alterações, e que erros lançados pelo adapter não
  são engolidos.

A lógica de tradução para um ORM específico (montagem de `select`/`include`, mapeamento de erros
do driver, etc) é responsabilidade de cada pacote de adapter — ex. `@vsrepo/prisma7-adapter`
(repositório [`VSRepoPrisma7Adapter`](https://github.com/jaobrabo123/VSRepoPrisma7Adapter)), que
tem sua própria suíte de testes seguindo o mesmo padrão (lá, um "Prisma Client" falso).

## Testes de implementação (`test/implementation`)

Cada arquivo cobre uma área do core:

- `error-handling.test.ts` — validação de config do construtor, validação dos argumentos de
  `@DynamicMethod`/`@QueryMethod`, resolução de nomes de método inválidos, guard clauses dos
  métodos base (`removeList`, `saveList`, `getList`, `transaction`, `softRemove`/`restore` sem
  `softRemoveKey`), e propagação de erros lançados pelo adapter.
- `base-methods.test.ts` — `get`, `getOrThrow`, `getList`, `getAll`, `save`, `saveList`, `patch`,
  `remove`, `removeList`, `total`, `has`, `merge`, `transaction`, `getDbClient`, `query`.
- `dynamic-methods.test.ts` — uso "do dia a dia" de métodos declarados com `@DynamicMethod`
  (prefixos `findBy`/`findOneBy`, operador `And`, `existsBy`, `injectOrdering`) e de métodos
  declarados com `@QueryMethod`.
- `dynamic-methods-parser.test.ts` — cobertura exaustiva do **parser** de métodos dinâmicos
  (`DynamicMethodsResolver`): uma variante isolada para cada sufixo de campo (`Not`, `In`,
  `Contains`, `StartsWith`, `Between`, `IsNull`, `IsTrue`, `IgnoreCase`, etc), operador lógico
  (`Or`, `And`, blocos `AND` maiúsculos combinados), filtro de relação (`Some`/`Every`/`None`/
  `With`/`Without`), prefixo (`find`/`findOne`/`findOneOrThrow`/`count`/`exists`/`create`/
  `update`/`upsert`/`delete`, e suas variantes `...Many`, `...ManyReturning`, `...Where`), sufixo
  de ordenação/paginação/distinct, e as options do decorator (`proxyTo`, `injectOrdering`).
  Existe separado de `dynamic-methods.test.ts` porque aqui o objetivo não é "uso realista", é
  travar o comportamento exato do parser — inclusive detalhes não óbvios (ex.: `Between` vira
  `{ between: [min, max] }`, não `gte`/`lte`; `IgnoreCase` num filtro de relação fica irmão de
  `_with`, não aninhado dentro do filtro do campo). Cada valor esperado foi conferido rodando o
  parser de verdade antes de virar asserção fixa — não é uma suposição de como "deveria" funcionar.
- `decorators-inheritance.test.ts` — herança entre repositories decorados: a subclasse herda os métodos do pai
  (`@DynamicMethod` e `@QueryMethod`, em vários níveis e sem decorators próprios) e nunca altera o pai nem as
  classes irmãs — inclusive ao redeclarar um método com outras options. Trava o contrato dos decorators de escrever
  numa lista própria da classe em vez da lista herdada.
- `soft-delete.test.ts` — `softRemove`, `softRemoveList`, `restore`, `restoreList`, e o filtro
  automático aplicado pelos métodos base conforme `options.see` (`"active"` | `"removed"` | `"all"`).
- `transactions.test.ts` — delegação de `transaction()` para `adapter.runInTransaction`, e
  compartilhamento do client de transação via `options.db` (evitando uma nova chamada a
  `adapter.getDbClient()`).
- `query-builder.test.ts` — o query builder (`createQueryBuilder()`): o que cada método terminal
  (`getResult`, `getOneResult`, `getOneResultOrThrow`, `getCount`, `getExistence`,
  `getResultAndCount`) repassa ao adapter, o encadeamento (`select`, `relations`, `where`/`andWhere`/
  `orWhere`, `orderBy`, `limit`/`offset`, `distinctOn`), a validação dos argumentos (`VSRepoError` do
  tipo `QUERY_BUILDER`), o filtro de soft-delete via `see()`, `setDb()` (inclusive dentro de uma
  `transaction()`), `clone()`, e os logs de debug/performance — verificados tanto com um logger
  falso injetado no builder quanto com o `VSLogger` real do repository.
- `sql-injection.test.ts` — testes de SQL Injection do pipeline de query/VSSql: garantem que
  nenhum payload malicioso (string, comentário, UNION, unicode...) aparece no TEXTO SQL entregue ao
  adapter — ele só chega no array de `args` (parâmetros ligados), em todos os caminhos
  (`VSSql.sql`/`join`/composição -> `compile()`, `VSRepository.query()` com `VSSql` ou string +
  `vsPlaceholders`, e `@QueryMethod` com `modifying: true` para UPDATE/INSERT/DELETE). Também trava
  o contrato do `VSSql.raw`: é o único escape hatch que inlina texto por design, e `sql`/`join`
  nunca inlinam.

Nenhum pré-requisito externo é necessário — os testes usam apenas o `VSRepoAdapter` falso.

**Rodando:**

```bash
npm run test:implementation          # roda uma vez
npm run test:implementation:watch    # modo watch
```

## Testes de tipagem (`test/typing`)

Reservado para arquivos TypeScript não executados — existem só para serem checados pelo
compilador (`tsc --noEmit`), usando `@ts-expect-error` em cenários que devem falhar a compilar.
Ainda não há cenários aqui; ao adicionar, siga o padrão usado pela v1
(`functional-api.types.ts`/`class-based-api.types.ts`).

**Rodando:**

```bash
npm run test:typing
```

## Rodando tudo

```bash
npm test
```

Roda `test:typing` e depois `test:implementation`, nessa ordem — assim, uma regressão de
tipagem falha rápido, antes mesmo de instanciar qualquer repository.

## CI

O workflow `.github/workflows/ci.yml` roda `bun run test` (tipagem + implementação) a cada push e
pull request para `main`. Diferente da v1, não há serviço Postgres nem passos de migration/build
— o core não precisa de nada disso para ser testado.
