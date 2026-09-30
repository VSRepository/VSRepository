# Changelog

All notable changes to this project will be documented in this file.

(Português) Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

---

## [2.7.3] - 2026-09-29

### Fixed

- `@DynamicMethod` and `@QueryMethod` no longer leak the methods declared in a subclass into its parent class and its sibling classes. The decorators read the list of declared methods with `Reflect.getMetadata`, which walks the prototype chain, and appended to it — so a subclass's first decorator pushed into the very array owned by its parent, and every class in the hierarchy ended up sharing one list. The visible effects were a parent (or sibling) repository resolving methods it never declared, and redeclaring a method in a subclass (e.g. with a different `injectOrdering`) also changing how the parent resolved it. Each class now writes to its own list, seeded with a copy of what it inherits: a subclass still inherits every dynamic and query method of its parent, at any depth, but never alters it. Repositories that don't extend another decorated repository are unaffected

### Documentation

- New [Inheriting from another repository](./docs/dynamic-methods.md#inheriting-from-another-repository) section in the Dynamic methods guide (linked from the Query methods guide), describing how `@DynamicMethod`/`@QueryMethod` behave across class inheritance

## [2.7.3] - 2026-09-29 (Português)

### Corrigido

- `@DynamicMethod` e `@QueryMethod` não vazam mais os métodos declarados numa subclasse para a classe pai nem para as classes irmãs. Os decorators liam a lista de métodos declarados com `Reflect.getMetadata`, que percorre a cadeia de protótipos, e acrescentavam nela — então o primeiro decorator de uma subclasse empurrava para o próprio array do pai, e todas as classes da hierarquia acabavam compartilhando uma única lista. Os efeitos visíveis eram um repository pai (ou irmão) resolvendo métodos que nunca declarou, e redeclarar um método numa subclasse (ex.: com outro `injectOrdering`) também alterando a forma como o pai o resolvia. Agora cada classe escreve na sua própria lista, iniciada com uma cópia do que herda: a subclasse continua herdando todos os métodos dinâmicos e query methods do pai, em qualquer profundidade, mas nunca o altera. Repositories que não estendem outro repository decorado não são afetados

### Documentação

- Nova seção [Herdando de outro repository](./docs/dynamic-methods.pt-BR.md#herdando-de-outro-repository) no guia de Métodos dinâmicos (com link a partir do guia de Query methods), descrevendo como `@DynamicMethod`/`@QueryMethod` se comportam com herança de classes

## [2.7.2] - 2026-09-29

### Fixed

- Corrects the typing of the `VSRepoAdapter` `merge` to correctly return `Promise<(K & T) | null>`, correctly aligning with the behavior of the `VSRepository` `merge` which returns `null` when not found.

## [2.7.2] - 2026-09-29 (Português)

### Corrigido

- Corrige a tipagem do método `merge` do `VSRepoAdapter` para retornar corretamente `Promise<(K & T) | null>`, alinhando corretamente ao comportamento do `merge` do `VSRepository` que retorna `null` quando não encontrado

## [2.7.1] - 2026-09-28

### Fixed

- A dynamic method now resolves every parameter by its own position instead of relying on the end of the argument list — the `options` are read from the first argument after the expected parameters, and the payload (`data`/`create`/`update`), `order` and `pagination` of a method called with more than one extra argument are now read from the correct slots instead of shifting onto the `options` object. Arguments beyond the expected parameters plus `options` are ignored
- A failing dynamic method is no longer logged at `ERROR` by the resolver — the error is simply rethrown to the caller and the execution time is still recorded by `endPerformLog`, leaving `ERROR` for validation and guard-clause failures. This is the last call site that still logged it: the base methods, `query()` and the query methods had already stopped in **2.0.0**

### Documentation

- Both logging guides now describe `ERROR` accurately: it is logged for validation and guard-clause failures right before the `VSRepoError` is thrown, while a failure raised by the adapter itself is no longer logged and simply propagates to the caller

## [2.7.1] - 2026-09-28 (Português)

### Corrigido

- Um método dinâmico agora resolve cada parâmetro pela sua própria posição em vez de depender do fim da lista de argumentos — as `options` são lidas do primeiro argumento depois dos parâmetros esperados, e o payload (`data`/`create`/`update`), o `order` e a `pagination` de um método chamado com mais de um argumento extra passam a ser lidos dos slots corretos, em vez de deslocarem para o objeto de options. Argumentos além dos parâmetros esperados mais as options são ignorados
- Um método dinâmico que falha não é mais logado em `ERROR` pelo resolver — o erro simplesmente é relançado para quem chamou e o tempo de execução continua sendo registrado por `endPerformLog`, deixando o `ERROR` para falhas de validação e de guarda. Esta é a última chamada que ainda registrava o erro: os métodos base, o `query()` e os query methods já haviam parado na **2.0.0**

### Documentação

- Os dois guias de logging agora descrevem o `ERROR` com precisão: ele é registrado para falhas de validação e de guarda logo antes do `VSRepoError` ser lançado, enquanto uma falha lançada pelo próprio adapter não é mais registrada e simplesmente propaga para quem chamou

## [2.7.0] - 2026-09-26

### Added

- **`createRawQueryBuilder(db?)`** — new method on every `VSRepository` that returns a fluent, SQL-agnostic `VSRawQueryBuilder` for hand-written `SELECT` queries too SQL-specific (window functions, vendor-specific syntax, ad-hoc subqueries, CTEs, ...) for `createQueryBuilder()`'s `where`/`relations` model. Chain `select`, `from`, `innerJoin`/`leftJoin`/`rightJoin`/`fullJoin`, `where`/`andWhere`/`orWhere`, `groupBy`, `having`/`andHaving`/`orHaving`, `orderBy`, `limit` and `offset` — each accepting either a raw, trusted string (an identifier, or a parameter-free condition for `on`/`where`/`having`, e.g. `.andWhere("deleted_at is null")`) or a `VSSql` fragment for anything parameterized. `from()`/joins also accept another `VSRawQueryBuilder`, or a subquery function (`sub => sub.select(...)...`) that receives a fresh builder sharing the same `db`/adapter/logger, compiled inline as a subquery; any subquery can also be spliced directly into a `VSSql` fragment via `toVSSql()` (e.g. inside a `WHERE ... IN (...)`). `with(name, query, columns?)`/`withRecursive(name, query, columns?)` add named CTEs (a single `WITH RECURSIVE` clause once any CTE is recursive) that the rest of the query can reference like real tables. Run it with `toVSSql()` (the compiled `VSSql` fragment), `toSql()` (the plain SQL string, rendered with the adapter's placeholder syntax) or `execute<T>()` (runs it through the adapter and returns the result); all three require the adapter to implement `getPlaceholder()`. The builder respects `clone()` and lazy `setDb()`, same as `createQueryBuilder()`, and is exported as `VSRawQueryBuilder`/`VSRawQueryBuilderTarget`/`VSRawQueryBuilderCteQuery`. Every raw string accepted as an identifier, condition, alias or CTE name/column is validated as non-empty/non-blank as soon as it's passed, throwing a `VSRepoError` instead of silently compiling into broken SQL
- **`VSSql`** — ORM-agnostic, composable SQL fragments for raw queries: build one with `VSSql.sql` (a tagged template where every interpolated value becomes a bound parameter), `VSSql.raw` (inserts trusted, unparameterized text — for identifiers only, never user input), `VSSql.join` (builds a parameterized list, e.g. an `IN (...)`) and `VSSql.empty` (contributes no text/params, for conditional fragments). Fragments nest freely and the placeholder numbering stays correct; passing one to `VSRepository.query()` compiles it through `adapter.getPlaceholder()` — so `VSSql` works with every database and is safe from SQL injection by construction
- **`vsPlaceholders`** constructor option — when `true`, raw SQL strings passed to `query()` and `@QueryMethod` use VSRepository's own agnostic, 1-based, positional placeholders (`?1`, `?2`, ...) instead of the adapter's native syntax; the same index can repeat (`?1 ... ?1`) to reuse an argument. Requires the adapter to implement `getPlaceholder()` — enabling it without one throws a `VSRepoError`
- **`VSRepoAdapter.getPlaceholder?`** — new optional adapter method declaring the placeholder syntax for the Nth (0-based) bound parameter (e.g. `` `$${index + 1}` `` for PostgreSQL, `"?"` for SQLite/MySQL). Implementing it is what enables `VSSql` fragments and `vsPlaceholders`
- **Query method logs** — `query()` and `@QueryMethod` now log the compiled query and its args at `DEBUG` (the `db` is never logged) and time the execution (`Took Xms ...`, promoted to `WARN` above `logSlowThresholdMs`), like the rest of the library

### Documentation

- New [Raw query builder](./docs/raw-query-builder.md) guide, covering `createRawQueryBuilder()`, building the query, subqueries (builder or function), CTEs with `with()`/`withRecursive()`, running it (`toVSSql`/`toSql`/`execute`), transactions/`setDb()`, cloning, validation and logs — added to both READMEs' documentation index, with a cross-link from the [Query builder](./docs/query-builder.md) guide

## [2.7.0] - 2026-09-26 (Português)

### Adicionado

- **`createRawQueryBuilder(db?)`** — novo método em todo `VSRepository` que retorna um `VSRawQueryBuilder` fluente e agnóstico de SQL para queries `SELECT` escritas à mão, específicas demais (funções de janela, sintaxe específica do banco, subqueries ad-hoc, CTEs, ...) para o modelo `where`/`relations` do `createQueryBuilder()`. Encadeie `select`, `from`, `innerJoin`/`leftJoin`/`rightJoin`/`fullJoin`, `where`/`andWhere`/`orWhere`, `groupBy`, `having`/`andHaving`/`orHaving`, `orderBy`, `limit` e `offset` — cada um aceitando uma string crua e confiável (um identificador, ou uma condição sem parâmetros para `on`/`where`/`having`, ex.: `.andWhere("deleted_at is null")`) ou um fragmento `VSSql` para qualquer coisa parametrizada. `from()`/joins também aceitam outro `VSRawQueryBuilder`, ou uma função de subquery (`sub => sub.select(...)...`) que recebe um builder novo compartilhando o mesmo `db`/adapter/logger, compilada inline como subquery; qualquer subquery também pode ser inserida diretamente num fragmento `VSSql` via `toVSSql()` (ex.: dentro de um `WHERE ... IN (...)`). `with(name, query, columns?)`/`withRecursive(name, query, columns?)` adicionam CTEs nomeadas (uma única cláusula `WITH RECURSIVE` quando qualquer CTE é recursiva) que o resto da query pode referenciar como tabelas normais. Execute com `toVSSql()` (o fragmento `VSSql` compilado), `toSql()` (a string SQL simples, renderizada com a sintaxe de placeholder do adapter) ou `execute<T>()` (executa através do adapter e retorna o resultado); os três exigem que o adapter implemente `getPlaceholder()`. O builder respeita `clone()` e `setDb()` lazy, igual ao `createQueryBuilder()`, e é exportado como `VSRawQueryBuilder`/`VSRawQueryBuilderTarget`/`VSRawQueryBuilderCteQuery`. Toda string crua aceita como identificador, condição, alias ou nome/coluna de CTE é validada como não-vazia/não-em-branco assim que é passada, lançando um `VSRepoError` em vez de compilar silenciosamente em SQL quebrado
- **`VSSql`** — fragmentos SQL agnósticos de ORM e componíveis para queries raw: monte um com `VSSql.sql` (um template literal com tag em que todo valor interpolado vira um parâmetro ligado), `VSSql.raw` (insere texto confiável e não parametrizado — só para identificadores, nunca input do usuário), `VSSql.join` (monta uma lista parametrizada, ex.: um `IN (...)`) e `VSSql.empty` (não contribui com texto nem parâmetros, para fragmentos condicionais). Fragmentos aninham livremente e a numeração dos placeholders continua correta; passar um para o `VSRepository.query()` compila via `adapter.getPlaceholder()` — então `VSSql` funciona com qualquer banco e é seguro contra SQL injection por construção
- **Option `vsPlaceholders`** no construtor — quando `true`, strings SQL cruas passadas para `query()` e `@QueryMethod` usam os placeholders próprios, agnósticos, posicionais e de base 1 do VSRepository (`?1`, `?2`, ...) em vez da sintaxe nativa do adapter; o mesmo índice pode se repetir (`?1 ... ?1`) para reutilizar um argumento. Exige que o adapter implemente `getPlaceholder()` — ligar essa option sem ele lança um `VSRepoError`
- **`VSRepoAdapter.getPlaceholder?`** — novo método opcional no adapter que declara a sintaxe de placeholder para o N-ésimo (base 0) parâmetro ligado (ex.: `` `$${index + 1}` `` para o PostgreSQL, `"?"` para SQLite/MySQL). Implementá-lo é o que habilita os fragmentos `VSSql` e o `vsPlaceholders`
- **Logs dos métodos de query** — `query()` e `@QueryMethod` agora logam a query compilada e seus args em `DEBUG` (o `db` nunca é logado) e medem a execução (`Took Xms ...`, promovido para `WARN` acima do `logSlowThresholdMs`), como no resto da biblioteca

### Documentação

- Novo guia [Raw query builder](./docs/raw-query-builder.pt-BR.md), cobrindo o `createRawQueryBuilder()`, a construção da query, subqueries (builder ou função), CTEs com `with()`/`withRecursive()`, execução (`toVSSql`/`toSql`/`execute`), transações/`setDb()`, clonagem, validação e logs — adicionado ao índice de documentação dos dois READMEs, com um cross-link a partir do guia [Query builder](./docs/query-builder.pt-BR.md)

## [2.6.0] - 2026-09-24

### Added

- **`createQueryBuilder(db?)`** — new method on every `VSRepository` that returns a fluent query builder for queries assembled at runtime. Chain `select`, `relations`, `where`, `orderBy`, `limit`, `offset`, `distinctOn` and `see`, then run it with `getResult()`, `getOneResult()`, `getOneResultOrThrow()`, `getCount()`, `getExistence()` or `getResultAndCount()`. `where()` takes the same `VSRepoWhere` filter used by the rest of the library (including `AND`/`OR`/`NOT`). The last terminal method fetches a page and the total of records matching the `where` (ignoring `order`/`pagination`, so it can be used for pagination) in parallel. The builder respects soft-delete (`see("active")` by default), `clone()` derives independent builders from a common base, and `setDb()` lets you choose lazily where the query runs — e.g. build it first and run it inside a `transaction()`. `distinctOn` only affects `getResult()`, since `count` doesn't support `distinct`
- **`VSQueryBuilder`** — the class is exported from the package entry point, so builders can be typed (e.g. as a function parameter). All its public methods are documented with JSDoc
- **`VSRepoErrorType.QUERY_BUILDER`** — new error type, thrown as a `VSRepoError` when an invalid argument is passed to a query builder method
- **Query builder logs** — the builder uses the repository's logger: at `DEBUG` it traces every chained call and the resolved query of each terminal method (the `db` is never logged), and each terminal method is timed (`Took Xms to run query builder <method>`, promoted to `WARN` above `logSlowThresholdMs`)
- **`Equals` / `NotEquals`** field-filter suffixes for dynamic methods — same effect as no suffix and `Not`, respectively; useful to disambiguate a field name that ends at the same camelCase boundary as an existing keyword suffix (e.g. `findByCheckInEquals` resolves to the field `checkIn`, instead of the default `check` + `In` reading)
- **`lazyDynamicMethods`** constructor option — when `true`, postpones resolving `@DynamicMethod`/`@QueryMethod` methods until the subclass calls the `protected resolveDynamicMethods()` itself, instead of resolving them synchronously in the constructor. Useful for deferring the resolution cost to a more convenient point in the app's lifecycle (e.g. an async init hook), and lets fields annotated with `@DynamicMethod`/`@QueryMethod` skip the `declare` modifier as long as `resolveDynamicMethods()` is called after calls `super()`. Calling `resolveDynamicMethods()` again after it already resolved once logs a `WARN`, since it's redundant

### Changed

- `pagination` validation is now stricter: `limit` and `offset` must be non-negative integers. Negative, decimal and infinite values, previously accepted, are now rejected
- `select` and `relations` passed in the `options` of any method are now validated recursively: every value must be a `boolean` or a nested object (previously any object was accepted)
- Dynamic-method name parsing is significantly more robust (inspired by Spring Data JPA's `PartTree`): keywords and operators (`Or`, `And`, `AND`, `Not`, `In`, `With`, `Without`, `Some`, `Every`, `None`, `Optional`, ...) are now only recognized at a camelCase word boundary, so field names that merely contain one of these words — `organizationId`, `notes`, `orderId`, `instagramHandle`, `withdrawnAt`, `androidVersion`, `everyoneId`, and the like — are no longer misparsed
- Using an ordering/pagination suffix (`Paginated`/`Ordered`/`OrderBy...`), `Distinct` or `IgnoreConflicts` on a dynamic-method prefix that doesn't support it, or using `Or` after an `AND` (all caps) block, now throws a `VSRepoError` (`RESOLVER`) when the repository is constructed, instead of silently becoming part of the field name

### Fixed

- A relation filter (`With`/`Without`/`Some`/`Every`/`None`) combined with equality and `IgnoreCase` (e.g. `findByAddressWithCityEqualsIgnoreCase`) now nests correctly as `{ equals, ignoreCase }`
- A dynamic-method name that places `Distinct` **after** `OrderBy` (e.g. `findByActiveOrderByCreatedAtDescDistinctName`) now throws a `VSRepoError` (`RESOLVER`) when the repository is constructed, instead of silently parsing `Distinct` as part of a non-existent ordering field

### Documentation

- Both READMEs document the query builder: new "Query builder" section, a new row in the base methods table, `QUERY_BUILDER` in the error types tables, and a note about the builder in the Logging section
- Both READMEs document `Equals`/`NotEquals`, the camelCase-boundary rule for keyword collisions (with the `Equals`/`NotEquals` disambiguation example), and the new explicit errors for unsupported suffix/prefix combinations and for `Or` after `AND`
- New "Lazily resolving dynamic methods" section in the dynamic-methods guide, covering `lazyDynamicMethods`, why `declare` becomes unnecessary once resolution is deferred, and the `WARN` logged on a redundant `resolveDynamicMethods()` call; `lazyDynamicMethods` also added to the constructor options table in the base-methods guide
- **Docs restructured**: the root READMEs (EN/PT) are now a short overview — intro, what changed from v1, adapter status, installation, basic usage, development, requirements, contributing — with a documentation index. Feature-by-feature detail (base methods & configuration, soft-delete, `select`/`relations`, dynamic methods, query methods, query builder, transactions, utility types, writing an adapter, error handling, logging) moved into its own guide under [`docs/`](./docs), each in English and Portuguese, with more examples than before (e.g. concrete DEBUG/WARN log output in the logging guide, transaction return-value/rollback and query-builder examples in the transactions guide)

---

## [2.6.0] - 2026-09-24 (Português)

### Adicionado

- **`createQueryBuilder(db?)`** — novo método em todo `VSRepository` que retorna um query builder fluente para queries montadas em tempo de execução. Encadeie `select`, `relations`, `where`, `orderBy`, `limit`, `offset`, `distinctOn` e `see`, e execute com `getResult()`, `getOneResult()`, `getOneResultOrThrow()`, `getCount()`, `getExistence()` ou `getResultAndCount()`. O `where()` recebe o mesmo filtro `VSRepoWhere` usado no resto da biblioteca (inclusive `AND`/`OR`/`NOT`). O último método terminal busca uma página e o total de registros que batem com o `where` (ignorando `order`/`pagination`, então serve para paginação) em paralelo. O builder respeita o soft-delete (`see("active")` por padrão), o `clone()` deriva builders independentes de uma base comum, e o `setDb()` permite escolher de forma lazy onde a query roda — ex.: montá-la antes e executá-la dentro de um `transaction()`. O `distinctOn` só afeta o `getResult()`, já que o `count` não suporta `distinct`
- **`VSQueryBuilder`** — a classe é exportada pelo ponto de entrada do pacote, então dá para tipar builders (ex.: como parâmetro de função). Todos os seus métodos públicos têm JSDoc
- **`VSRepoErrorType.QUERY_BUILDER`** — novo tipo de erro, lançado como `VSRepoError` quando um argumento inválido é passado para um método do query builder
- **Logs do query builder** — o builder usa o logger do repository: em `DEBUG` ele registra cada chamada encadeada e a query resolvida de cada método terminal (o `db` nunca é logado), e cada método terminal tem o tempo medido (`Took Xms to run query builder <método>`, promovido a `WARN` acima de `logSlowThresholdMs`)
- **Sufixos `Equals` / `NotEquals`** para métodos dinâmicos — mesmo efeito de sem sufixo e de `Not`, respectivamente; úteis para desambiguar um campo cujo nome termina na mesma fronteira de camelCase de um sufixo/palavra-chave já existente (ex.: `findByCheckInEquals` resolve para o campo `checkIn`, em vez da leitura padrão `check` + `In`)
- **Option `lazyDynamicMethods` do construtor** — quando `true`, adia a resolução dos métodos `@DynamicMethod`/`@QueryMethod` até que a própria subclasse chame o `protected resolveDynamicMethods()`, em vez de resolvê-los de forma síncrona no construtor. Útil para adiar o custo da resolução para um momento mais oportuno do ciclo de vida da aplicação (ex.: um hook de inicialização assíncrona), e permite que campos anotados com `@DynamicMethod`/`@QueryMethod` dispensem o modificador `declare`, desde que `resolveDynamicMethods()` seja chamado depois de chamar `super()`. Chamar `resolveDynamicMethods()` de novo depois que ele já resolveu uma vez registra um `WARN`, já que é redundante

### Alterado

- A validação de `pagination` ficou mais estrita: `limit` e `offset` precisam ser inteiros não negativos. Valores negativos, decimais e infinitos, antes aceitos, agora são rejeitados
- `select` e `relations` passados nas `options` de qualquer método agora são validados recursivamente: todo valor precisa ser `boolean` ou um objeto aninhado (antes qualquer objeto era aceito)
- A resolução de nomes de métodos dinâmicos ficou bem mais robusta (inspirada no `PartTree` do Spring Data JPA): palavras-chave e operadores (`Or`, `And`, `AND`, `Not`, `In`, `With`, `Without`, `Some`, `Every`, `None`, `Optional`, ...) só são reconhecidos numa fronteira de camelCase, então campos cujo nome apenas contém uma dessas palavras — `organizationId`, `notes`, `orderId`, `instagramHandle`, `withdrawnAt`, `androidVersion`, `everyoneId` e afins — deixam de ser interpretados errado
- Usar um sufixo de ordenação/paginação (`Paginated`/`Ordered`/`OrderBy...`), `Distinct` ou `IgnoreConflicts` num prefixo de método dinâmico que não os suporta, ou usar `Or` depois de um bloco `AND` (maiúsculo), agora lança um `VSRepoError` (`RESOLVER`) ao construir o repository, em vez de virar silenciosamente parte do nome do campo

### Corrigido

- Um filtro de relação (`With`/`Without`/`Some`/`Every`/`None`) combinado com igualdade e `IgnoreCase` (ex.: `findByAddressWithCityEqualsIgnoreCase`) agora aninha corretamente como `{ equals, ignoreCase }`
- Um nome de método dinâmico que coloca `Distinct` **depois** de `OrderBy` (ex.: `findByActiveOrderByCreatedAtDescDistinctName`) agora lança um `VSRepoError` (`RESOLVER`) ao construir o repository, em vez de silenciosamente interpretar o `Distinct` como parte de um campo de ordenação inexistente

### Documentação

- Ambos os READMEs documentam o query builder: nova seção "Query builder", uma nova linha na tabela de métodos base, `QUERY_BUILDER` nas tabelas de tipos de erro, e uma observação sobre o builder na seção de Logging
- Ambos os READMEs documentam `Equals`/`NotEquals`, a regra de fronteira de camelCase para colisões de palavra-chave (com o exemplo de desambiguação via `Equals`/`NotEquals`), e os novos erros explícitos para combinações de sufixo/prefixo não suportadas e para `Or` depois de `AND`
- Nova seção "Resolução lazy dos métodos dinâmicos" no guia de métodos dinâmicos, cobrindo o `lazyDynamicMethods`, o porquê do `declare` deixar de ser necessário quando a resolução é adiada, e o `WARN` registrado numa chamada redundante de `resolveDynamicMethods()`; `lazyDynamicMethods` também foi adicionado à tabela de options do construtor no guia de métodos base
- **Documentação reestruturada**: os READMEs da raiz (EN/PT) agora são uma visão geral curta — intro, o que mudou da v1, status dos adapters, instalação, uso básico, desenvolvimento, requisitos, contribuição — com um índice de documentação. O detalhamento de cada funcionalidade (métodos base & configuração, soft-delete, `select`/`relations`, métodos dinâmicos, query methods, query builder, transações, tipos utilitários, escrevendo um adapter, tratamento de erros, logging) foi para um guia próprio dentro de [`docs/`](./docs), cada um em português e em inglês, com mais exemplos do que antes (ex.: saída real de log em DEBUG/WARN no guia de logging, exemplos de valor de retorno/rollback de transação e de query builder no guia de transações)

---

## [2.5.0] - 2026-09-20

> Promotes `2.5.0-beta` to stable.

---

## [2.5.0] - 2026-09-20 (Português)

> Promove `2.5.0-beta` para estável.

---

## [2.5.0-beta] - 2026-09-19

### Added

- **`InferMethodReturn<T, Options>`** — new opt-in utility type for stricter return typing, exported from the package entry point. It narrows the type returned by a method (`Entity`, `Entity | null` or `Entity[]`) to the fields and relations actually requested through `select`/`relations`, instead of the whole entity: with no options only the scalar fields are returned; with `relations`, the scalar fields plus the requested relations (nested ones included); with `select`, only the selected fields (a relation set to `true` brings all of its scalar fields, and a nested `select` restricts it further). When both are passed, `select` takes precedence and `relations` is ignored. `null`/array-ness and optional (`?`) modifiers are preserved, and if the options are typed as a plain `MethodOptions<T>` (not narrowed) the whole entity is returned unchanged. The default typing of the methods is **not** changed
- **`InferMethodType<Args, Return, OrmTypes?>`** — new utility type, exported from the package entry point, to declare dynamic methods whose return type is inferred on each call from the `select`/`relations` passed in `options`: `@DynamicMethod() declare findByName: InferMethodType<[name: string], User[]>`. Calls without `options` return only the scalar fields. Unknown keys in `select`/`relations` (at any depth) are rejected at compile time, and the editor autocompletes them, just like with a plain `MethodOptions<T>` parameter. The third generic (`OrmTypes`) is optional and types the `db` option
- **`getPkName?(): string`** - new optional method that allows the adapter to declare the entity's primary key field to the repository. When instantiating a `VSRepository`, you can omit `pkName` from the constructor options, and it will be read from `adapter.getPkName()`. If you omit it and the adapter does not implement `getPkName()`, the constructor throws a `VSRepoError`

### Documentation

- Both READMEs document the new types: new "Strict return typing with `InferMethodReturn`" and "Strict return typing with `InferMethodType`" sections, a pointer in the dynamic-methods intro, and two new rows in the utility types table
- Documents the new optional `getPkName?(): string` method of `VSRepoAdapter`

### Fixed

- Fixed the `OrderByField` typing so it doesn't claim to accept nested ordering

---

## [2.5.0-beta] - 2026-09-19 (Português)

### Adicionado

- **`InferMethodReturn<T, Options>`** — novo tipo utilitário opt-in para uma tipagem de retorno mais restrita, exportado pelo entry point do pacote. Ele estreita o tipo retornado por um método (`Entity`, `Entity | null` ou `Entity[]`) para os campos e relações realmente pedidos via `select`/`relations`, em vez da entidade inteira: sem options, apenas os campos escalares; com `relations`, os campos escalares mais as relações pedidas (inclusive as aninhadas); com `select`, apenas os campos selecionados (uma relação com `true` traz todos os seus campos escalares, e um `select` aninhado a restringe ainda mais). Quando os dois são passados, `select` tem precedência e `relations` é ignorado. `null`/array e os modificadores opcionais (`?`) são preservados, e se as options estiverem tipadas como um `MethodOptions<T>` genérico (sem estreitamento) a entidade inteira é retornada sem alterações. A tipagem padrão dos métodos **não** foi alterada
- **`InferMethodType<Args, Return, OrmTypes?>`** — novo tipo utilitário, exportado pelo entry point do pacote, para declarar métodos dinâmicos cujo tipo de retorno é inferido a cada chamada a partir do `select`/`relations` passados em `options`: `@DynamicMethod() declare findByName: InferMethodType<[name: string], User[]>`. Chamadas sem `options` retornam apenas os campos escalares. Chaves inexistentes em `select`/`relations` (em qualquer profundidade) são rejeitadas em tempo de compilação, e o editor as sugere via autocomplete, igual a um parâmetro `MethodOptions<T>` comum. A terceira generic (`OrmTypes`) é opcional e tipa a option `db`
- **`getPkName?(): string`** - novo método opcional permite que o adapter declare ao repository qual campo é a primary key da entidade. Ao instanciar um `VSRepository`, você pode omitir o `pkName` das options do construtor e ele será lido do `adapter.getPkName()`. Se você omitir e o adapter não implementar o `getPkName()`, o construtor lança um `VSRepoError`

### Documentação

- Ambos os READMEs documentam os novos tipos: novas seções "Tipagem de retorno restrita com `InferMethodReturn`" e "Tipagem de retorno restrita com `InferMethodType`", uma indicação na introdução de métodos dinâmicos, e duas novas linhas na tabela de tipos utilitários
- Documenta o novo método opcional `getPkName?(): string` do `VSRepoAdapter`

### Corrigido

- Corrigida a tipagem do `OrderByField` para não dizer que aceita nested ordering

---

## [2.4.0] - 2026-09-16

### Added

- **`logSlowThresholdMs: false`** — passing `false` to `logSlowThresholdMs` (on `VSRepoOptions` or on the `VSLogger` constructor) now disables slow-operation warnings entirely, without having to set an arbitrarily large threshold. Passing `true` or omitting the option keeps the existing 300 ms default. The accepted type is now `number | boolean` instead of `number`

### Changed

- `@vsrepo/drizzle-adapter` is now available as an **alpha** release on npm — install it with `npm i @vsrepo/drizzle-adapter@alpha`. The API may still change before the stable release; check the [`DrizzleAdapter`](https://github.com/jaobrabo123/VSRepoDrizzleAdapter) repository for the current status and known limitations

### Documentation

- `proxyTo` decorator option now has a dedicated code example in both READMEs, showing the main use case: giving a method a custom name (e.g. a non-English name) while internally resolving it to a valid dynamic-method pattern
- `groupBy` is documented as **not planned** for v2; `aggregate` as a dynamic-method prefix is also unlikely to be added since the most common aggregate operations are already available as dedicated base methods (`sum`, `average`, `min`, `max`, `increment`, `decrement`, `multiply`, `divide`) — `@QueryMethod` with raw SQL is the recommended escape hatch for anything more complex
- Multiple README improvements: fixed and expanded the constructor-options table, corrected examples in the dynamic-methods section, improved descriptions across several utility-type entries, and removed the outdated TypeORM `relations` note from the `select`/`relations` section

---

## [2.4.0] - 2026-09-16 (Português)

### Adicionado

- **`logSlowThresholdMs: false`** — passar `false` em `logSlowThresholdMs` (no `VSRepoOptions` ou no construtor do `VSLogger`) agora desabilita completamente os avisos de operação lenta, sem precisar definir um threshold arbitrariamente grande. Passar `true` ou omitir a option mantém o padrão existente de 300 ms. O tipo aceito agora é `number | boolean` em vez de `number`

### Alterado

- `@vsrepo/drizzle-adapter` agora está disponível como versão **alpha** no npm — instale com `npm i @vsrepo/drizzle-adapter@alpha`. A API ainda pode mudar antes do release estável; veja o repositório do [`DrizzleAdapter`](https://github.com/jaobrabo123/VSRepoDrizzleAdapter) para o estado atual e limitações conhecidas

### Documentação

- A option `proxyTo` do decorador agora tem um exemplo de código dedicado em ambos os READMEs, mostrando o principal caso de uso: dar um nome customizado a um método (ex.: um nome em outro idioma) enquanto ele resolve internamente para um padrão de método dinâmico válido
- `groupBy` está documentado como **não planejado** para a v2; `aggregate` como prefixo de método dinâmico também dificilmente será adicionado, já que as operações de agregação mais comuns já estão disponíveis como métodos base dedicados (`sum`, `average`, `min`, `max`, `increment`, `decrement`, `multiply`, `divide`) — `@QueryMethod` com SQL raw é o escape hatch recomendado para qualquer coisa mais complexa
- Diversas melhorias nos READMEs: tabela de constructor options corrigida e expandida, exemplos na seção de métodos dinâmicos corrigidos, descrições melhoradas em várias entradas de tipos utilitários, e remoção da nota desatualizada sobre TypeORM e `relations` na seção `select`/`relations`

---

## [2.3.0] - 2026-09-14

### Added

- **`AdapterErrorCode.TRANSACTION_ROLLED_BACK`** — new adapter error code to signal that a database transaction was rolled back. Adapters can now throw `VSRepoAdapterError` with this code to give callers a clear, typed signal that the transaction did not commit

### Fixed

- Documentation and JSDoc across READMEs and JavaDocs now correctly state that SQL placeholders are **database-specific** (e.g. `?` for MySQL, `$1`/`$2` for PostgreSQL) instead of implying a single universal syntax

### Documentation

- Documented the current state of `VSRepoDrizzleAdapter` — available features, limitations, and planned work
- Documented the new `AdapterErrorCode.TRANSACTION_ROLLED_BACK` in all relevant READMEs and JSDoc

---

## [2.3.0] - 2026-09-14 (Português)

### Adicionado

- **`AdapterErrorCode.TRANSACTION_ROLLED_BACK`** — novo código de erro de adapter para sinalizar que uma transação no banco de dados foi revertida (_rolled back_). Adapters agora podem lançar `VSRepoAdapterError` com esse código para dar ao chamador um sinal claro e tipado de que a transação não foi commitada

### Corrigido

- A documentação e o JSDoc nos READMEs e JavaDocs agora informam corretamente que os placeholders de SQL são **específicos do banco de dados** (ex.: `?` para MySQL, `$1`/`$2` para PostgreSQL) em vez de implicar uma sintaxe universal única

### Documentação

- Documentado o estado atual do `VSRepoDrizzleAdapter` — funcionalidades disponíveis, limitações e trabalho planejado
- Documentado o novo `AdapterErrorCode.TRANSACTION_ROLLED_BACK` em todos os READMEs e JSDoc relevantes

---

## [2.2.1] - 2026-09-09

### Changed

- Build now generates **sourcemap files** (`sourceMap: true`) for easier debugging of the published package
- Added `stripInternal: true` to the build config — declarations for members marked `@internal` are now stripped from the published `.d.ts` files, keeping the public API surface clean
- Added `noImplicitOverride: true` to the TypeScript config, enforcing the `override` keyword on subclass members that override a parent

### Fixed

- Documentation and JSDoc for `VSRepoErrorType.DYNAMIC` now correctly state that the error can be thrown by both **dynamic** and **query** methods (previously only mentioned dynamic methods)

---

## [2.2.1] - 2026-09-09 (Português)

### Alterado

- A build agora gera **arquivos sourcemap** (`sourceMap: true`) para facilitar a depuração do pacote publicado
- Adicionado `stripInternal: true` na config de build — declarações de membros marcados com `@internal` agora são removidas dos arquivos `.d.ts` publicados, mantendo a superfície da API pública limpa
- Adicionado `noImplicitOverride: true` no config do TypeScript, forçando a palavra-chave `override` em membros de subclasses que sobrescrevem um pai

### Corrigido

- A documentação e o JSDoc do `VSRepoErrorType.DYNAMIC` agora informam corretamente que o erro pode ser lançado tanto por métodos **dynamic** quanto por **query methods** (antes mencionava apenas métodos dinâmicos)

---

## [2.2.0] - 2026-09-06

### Added

- **`singleResult` option** on `@QueryMethod` and `query()` — collapses an array result into its first element (`null` if the array is empty) instead of leaving it as an array. Has no effect on non-array results (e.g. a `modifying` query's affected-row count). Useful for queries known to return at most one row (a `SELECT ... LIMIT 1` or a lookup by a unique column)
- **`spreadArgs` option** on `@QueryMethod` — receive SQL placeholder values as separate positional arguments (`method(a, b, c)`), JpaRepository style, instead of a single `QueryMethodArg` object (`method({ args: [a, b, c] })`). Calling a method declared without `spreadArgs` using more than one argument now throws a `VSRepoError` (`type: VALIDATOR`), since the single-object call style is expected instead
- **`DbArg<T>` / `withDb()`** — wrap a database client or transaction (`withDb(tx)`) to pass it as the trailing argument of a `spreadArgs` call, running that query against `tx` instead of the repository's default client. Recognized via `instanceof`, so it never collides with a regular positional argument, even one that happens to be an object
- New public type `QueryArgs<T, O>` — types the spread parameter list of a `@QueryMethod` declared with `{ spreadArgs: true }`: `T`'s values in order, followed by an optional trailing `DbArg<O>`
- Implementation tests covering `singleResult` and `spreadArgs` (including the `DbArg`/`withDb` extraction and the call-arity guard), plus README docs and JSDoc for every new option, type and function

### Changed

- `QueryMethodOptions.modifying` is now optional (defaults to `false` at runtime, matching the decorator's existing behavior when `options` is omitted entirely) — previously required at the type level even though omitting it worked fine

---

## [2.2.0] - 2026-09-06 (Português)

### Adicionado

- **Option `singleResult`** no `@QueryMethod` e no `query()` — transforma um resultado em array no seu primeiro elemento (`null` se o array estiver vazio) em vez de deixá-lo como array. Não tem efeito em resultados que não são array (ex.: o número de linhas afetadas de uma query `modifying`). Útil para queries que já se sabe que retornam no máximo uma linha (um `SELECT ... LIMIT 1` ou uma busca por uma coluna única)
- **Option `spreadArgs`** no `@QueryMethod` — recebe os valores dos placeholders SQL como argumentos posicionais separados (`method(a, b, c)`), no estilo do JpaRepository, em vez de um único objeto `QueryMethodArg` (`method({ args: [a, b, c] })`). Chamar um método declarado sem `spreadArgs` usando mais de um argumento agora lança um `VSRepoError` (`type: VALIDATOR`), já que o estilo de chamada com objeto único é o esperado
- **`DbArg<T>` / `withDb()`** — embrulha um client ou transação do banco (`withDb(tx)`) para passá-lo como argumento final de uma chamada com `spreadArgs`, rodando aquela query contra `tx` em vez do client padrão do repository. Reconhecido via `instanceof`, então nunca é confundido com um argumento posicional comum, mesmo que esse argumento seja um objeto
- Novo tipo público `QueryArgs<T, O>` — tipa a lista de parâmetros via spread de um `@QueryMethod` declarado com `{ spreadArgs: true }`: os valores de `T`, em ordem, seguidos de um `DbArg<O>` opcional
- Testes de implementação cobrindo `singleResult` e `spreadArgs` (incluindo a extração de `DbArg`/`withDb` e o guard de arity da chamada), além de documentação nos READMEs e JSDoc para cada nova option, tipo e função

### Alterado

- `QueryMethodOptions.modifying` agora é opcional (default `false` em runtime, alinhado ao comportamento já existente do decorator quando `options` é omitido por completo) — antes era obrigatório no nível de tipos, mesmo que omiti-lo já funcionasse normalmente

---

## [2.1.0] - 2026-09-04

### Added

- **Atomic operations** — new `increment(pk, field, value)`, `decrement`, `multiply` and `divide` methods on `VSRepository`. They are evaluated **server-side** against the row's _current_ value (`UPDATE ... SET field = field + value`), not as a client-side read-modify-write, and each returns the record reflecting the state _after_ the write. The `value` argument accepts `number`, `bigint` or `DecimalLike` and is validated at runtime
- **Aggregation methods** — new `sum`, `average`, `min` and `max` methods that compute the value across every record matching an optional `where` (all records if omitted). All four return `number | null` — `null` when no record matches, mirroring SQL's `SUM()`/`AVG()`/`MIN()`/`MAX()`, which return `NULL` (not `0`) over an empty set
- **`VSRepoAdapter` contract extended** with the 8 corresponding abstract methods: `incrementOne`, `decrementOne`, `multiplyOne`, `divideOne`, `sum`, `average`, `min`, `max`
- New public types: `NumericKeys<T>` (extracts the numeric fields eligible as `field`), `NumericLike` (`number | bigint | DecimalLike`), `DecimalLike` (structural shape of arbitrary-precision decimals such as Prisma's `Prisma.Decimal`), and `RestrictMethodOptions`
- `Primitive` now also includes `DecimalLike`, so Decimal-typed fields are treated as scalar (non-relation) values when walking an entity's shape
- Implementation and typing tests covering the atomic and aggregate methods, plus README docs and JSDoc for every new method and type

> **Note for adapter authors:** the new abstract methods are **breaking** for anyone implementing a custom `VSRepoAdapter` — existing adapters must implement all 8 before they compile against 2.1.0. Published adapters (e.g. `@vsrepo/prisma7-adapter`) may not implement them yet; confirm the adapter version supports them before relying on `increment`/`sum`/etc.

### Changed

- `total`, `has`, `removeList`, `softRemoveList` and `restoreList` now accept the narrowed `RestrictMethodOptions` (`db`/`see` only) instead of the full `MethodOptions` — these methods don't shape/return an `Entity`, so `select`/`relations` no longer apply at the type level
- The `v1` folder was removed from the `main` branch — the v1 source and docs now live exclusively on the dedicated `v1` branch (READMEs updated to point there)

---

## [2.1.0] - 2026-09-04 (Português)

### Adicionado

- **Operações atômicas** — novos métodos `increment(pk, field, value)`, `decrement`, `multiply` e `divide` no `VSRepository`. Elas são avaliadas **server-side** contra o valor _atual_ do registro (`UPDATE ... SET field = field + value`), e não como um read-modify-write no cliente, e cada uma retorna o registro refletindo o estado _após_ a escrita. O argumento `value` aceita `number`, `bigint` ou `DecimalLike` e é validado em tempo de execução
- **Métodos de agregação** — novos métodos `sum`, `average`, `min` e `max` que calculam o valor entre todos os registros que correspondem a um `where` opcional (todos os registros se omitido). Os quatro retornam `number | null` — `null` quando nenhum registro corresponde, espelhando o `SUM()`/`AVG()`/`MIN()`/`MAX()` do SQL, que retornam `NULL` (não `0`) sobre um conjunto vazio
- **Contrato do `VSRepoAdapter` estendido** com os 8 métodos abstratos correspondentes: `incrementOne`, `decrementOne`, `multiplyOne`, `divideOne`, `sum`, `average`, `min`, `max`
- Novos tipos públicos: `NumericKeys<T>` (extrai os campos numéricos elegíveis como `field`), `NumericLike` (`number | bigint | DecimalLike`), `DecimalLike` (formato estrutural de decimais de alta precisão, como o `Prisma.Decimal` do Prisma) e `RestrictMethodOptions`
- `Primitive` agora também inclui `DecimalLike`, então campos com tipo Decimal são tratados como valores escalares (não-relation) ao percorrer a forma da entidade
- Testes de implementação e de tipagem cobrindo os métodos atômicos e de agregação, além de documentação nos READMEs e JSDoc para cada novo método e tipo

> **Nota para autores de adapters:** os novos métodos abstratos são uma mudança **breaking** para quem implementa um `VSRepoAdapter` customizado — adapters existentes precisam implementar os 8 antes de compilarem contra a 2.1.0. Adapters publicados (ex.: `@vsrepo/prisma7-adapter`) podem ainda não os implementar; confirme que a versão do adapter suporta antes de usar `increment`/`sum`/etc.

### Alterado

- `total`, `has`, `removeList`, `softRemoveList` e `restoreList` agora aceitam o `RestrictMethodOptions` restrito (somente `db`/`see`) em vez do `MethodOptions` completo — esses métodos não moldam/retornam uma `Entity`, então `select`/`relations` não se aplicam mais no nível de tipos
- A pasta `v1` foi removida da branch `main` — o código-fonte e a documentação da v1 agora vivem exclusivamente na branch `v1` dedicada (READMEs atualizados para apontar para lá)

---

## [2.0.0] - 2026-09-01

> Major rewrite. If you're upgrading from v1, see the [Migrating from v1](./docs/migrating-from-v1.md) guide for the full breakdown before migrating.

### Changed

- **BREAKING:** VSRepository is now **ORM-agnostic** — the core no longer talks to Prisma directly, it delegates every operation to a pluggable `VSRepoAdapter`. ORM support now ships as separate packages (e.g. `@vsrepo/prisma7-adapter`) instead of being bundled in the core `vsrepo` package
- **BREAKING:** Repositories are now defined with a single **class-based** API — `extends VSRepository<Entity, PKType, OrmTypes>` — replacing the v1 functional `setupVSRepo<T, M>()({...}).build(prisma)` and the `DynamicRepository` class
- **BREAKING:** Dynamic methods are now declared only with the `@DynamicMethod()` decorator on a `declare` field, replacing the `methods: { findByEmail: { map: true } }` config object
- **BREAKING:** Data projections are now ad-hoc `select`/`relations` passed per call — named, reusable `selectModels`/`defaultSelectModel` were removed
- **BREAKING:** Eager loading now uses an ORM-agnostic `relations` option instead of the Prisma-specific `include`/`includeModels`
- **BREAKING:** `requiredWhere` was removed; global scoping is now limited to `softRemoveKey` + a `see: "active" | "removed" | "all"` option
- **BREAKING:** The case-insensitive filter suffix was renamed from `Insensitive` to `IgnoreCase`
- **BREAKING:** The `createMany` duplicate-handling suffix was renamed from `SkipDuplicates` to `IgnoreConflicts`
- **BREAKING:** Error types were reworked — `VSRepoError` now carries a `type: VSRepoErrorType` field (`DECORATOR`, `RESOLVER`, `DYNAMIC`, `VALIDATOR`, `BASE`, `ADAPTER`); the old subclasses (`VSRepoConfigError`, `VSRepoBuildError`, `VSRepoExtendError`) were replaced by the new `VSRepoAdapterError`, which carries an `AdapterErrorCode` and the original ORM error
- **BREAKING:** Debug logging changed from a `showWorking: true` boolean to a `logLevel: VSLogLevel` (`DEBUG`/`INFO`/`WARN`/`ERROR`) option, plus a new `logSlowThresholdMs` for slow-query warnings
- **BREAKING:** The `vsrepo generate` CLI type-generation step is no longer part of the v2 core — types now come directly from your entity/ORM types
- Runtime validation (ordering, pagination, where, adapter config) now uses `valibot` instead of `zod`, for a lighter footprint
- Inline ordering can now be baked directly into a dynamic method name via `OrderBy<Field>Asc`/`OrderBy<Field>Desc` chains
- v1 source and docs moved to a dedicated `v1` branch for anyone who still needs the previous Prisma-only release

### Added

- An ad-hoc `query()` method for raw SQL queries, with transaction support via `db: tx`
- `VSRepoAdapterError` with a dedicated `AdapterErrorCode`, including a new `INVALID_ADAPTER_CONFIG` code, for surfacing adapter-level failures
- `VSLogger` exported for use inside custom adapters
- JSDoc added to every public API surface (everything marked `@publicApi`)
- First official adapter published: [`@vsrepo/prisma7-adapter`](https://github.com/jaobrabo123/VSRepoPrisma7Adapter) (Prisma 7); other ORMs (Prisma 8, TypeORM, Drizzle) are planned but not yet published

### Fixed

- The case-insensitive mode was being injected in the wrong place when combined with relation filters, producing an incorrect `where`
- Corrected the argument-index preview shown when an argument is a `where` object

### Removed

- `patchList` — for a batch partial update, use an `updateManyBy`/`updateManyWhere` dynamic method instead
- `aggregate`/`groupBy` passthrough support — not implemented yet in v2

---

## [2.0.0] - 2026-09-01 (Português)

> Reescrita major. Se você está migrando da v1, veja o guia [Migrando da v1](./docs/migrating-from-v1.pt-BR.md) para o detalhamento completo antes de migrar.

### Alterado

- **BREAKING:** O VSRepository agora é **agnóstico de ORM** — o core não conversa mais diretamente com o Prisma, delegando toda operação a um `VSRepoAdapter` plugável. O suporte a ORMs agora é publicado em pacotes separados (ex.: `@vsrepo/prisma7-adapter`) em vez de vir embutido no pacote core `vsrepo`
- **BREAKING:** Repositories agora são definidos com uma única API **baseada em classes** — `extends VSRepository<Entity, PKType, OrmTypes>` — substituindo o `setupVSRepo<T, M>()({...}).build(prisma)` funcional da v1 e a classe `DynamicRepository`
- **BREAKING:** Métodos dinâmicos agora são declarados somente com o decorator `@DynamicMethod()` em um campo `declare`, substituindo o objeto de config `methods: { findByEmail: { map: true } }`
- **BREAKING:** Projeções de dados agora são `select`/`relations` ad-hoc passados em cada chamada — os `selectModels`/`defaultSelectModel` nomeados e reutilizáveis foram removidos
- **BREAKING:** Eager loading agora usa uma option agnóstica de ORM chamada `relations`, no lugar do `include`/`includeModels` específico do Prisma
- **BREAKING:** O `requiredWhere` foi removido; o escopo global agora se limita a `softRemoveKey` + uma option `see: "active" | "removed" | "all"`
- **BREAKING:** O sufixo de filtro case-insensitive foi renomeado de `Insensitive` para `IgnoreCase`
- **BREAKING:** O sufixo de tratamento de duplicados do `createMany` foi renomeado de `SkipDuplicates` para `IgnoreConflicts`
- **BREAKING:** Os tipos de erro foram reformulados — `VSRepoError` agora carrega um campo `type: VSRepoErrorType` (`DECORATOR`, `RESOLVER`, `DYNAMIC`, `VALIDATOR`, `BASE`, `ADAPTER`); as antigas subclasses (`VSRepoConfigError`, `VSRepoBuildError`, `VSRepoExtendError`) foram substituídas pelo novo `VSRepoAdapterError`, que carrega um `AdapterErrorCode` e o erro original do ORM
- **BREAKING:** O log de debug mudou de um boolean `showWorking: true` para uma option `logLevel: VSLogLevel` (`DEBUG`/`INFO`/`WARN`/`ERROR`), além de um novo `logSlowThresholdMs` para avisos de queries lentas
- **BREAKING:** O passo de geração de tipos via CLI `vsrepo generate` não faz mais parte do core da v2 — os tipos agora vêm diretamente das suas entidades/tipos do ORM
- A validação em tempo de execução (ordering, pagination, where, config do adapter) agora usa `valibot` em vez de `zod`, por ser mais leve
- A ordenação inline agora pode ser embutida diretamente no nome do método dinâmico via cadeias `OrderBy<Campo>Asc`/`OrderBy<Campo>Desc`
- O código-fonte e a documentação da v1 foram movidos para uma branch `v1` dedicada, para quem ainda precisar da release anterior baseada apenas em Prisma

### Adicionado

- Um método `query()` ad-hoc para queries SQL raw, com suporte a transações via `db: tx`
- `VSRepoAdapterError` com um `AdapterErrorCode` dedicado, incluindo um novo código `INVALID_ADAPTER_CONFIG`, para expor falhas em nível de adapter
- `VSLogger` agora é exportado para uso dentro de adapters customizados
- JSDoc adicionado a toda a API pública (tudo marcado com `@publicApi`)
- Primeiro adapter oficial publicado: [`@vsrepo/prisma7-adapter`](https://github.com/jaobrabo123/VSRepoPrisma7Adapter) (Prisma 7); outros ORMs (Prisma 8, TypeORM, Drizzle) estão planejados mas ainda não publicados

### Corrigido

- O modo case-insensitive estava sendo injetado no lugar errado quando combinado com filtros de relação, gerando um `where` incorreto
- Corrigida a preview do índice do argumento exibida quando um argumento é um objeto `where`

### Removido

- `patchList` — para uma atualização parcial em lote, use um método dinâmico `updateManyBy`/`updateManyWhere`
- Suporte de passthrough para `aggregate`/`groupBy` — ainda não implementado na v2

---

## [1.4.2] - 2026-09-02

### Fixed

- `merge` method now strips `undefined` fields from the source object before merging — previously, when merging objects without relations, `undefined` values from the source were carried into the result, which could overwrite existing fields with `undefined`

---

## [1.4.2] - 2026-09-02 (Português)

### Corrigido

- O método `merge` agora remove campos com valor `undefined` do objeto de origem antes de mesclar — antes, ao mesclar objetos sem relations, valores `undefined` do objeto de origem eram propagados para o resultado, o que poderia sobrescrever campos existentes com `undefined`

---

## [1.4.1] - 2026-09-01

### Fixed

- `mode: "insensitive"` was being injected at the wrong level in relation filters — previously, `otherProps` (which includes `mode`) was being assigned to `path[argName]` (the nested relation object) instead of the current filter level, causing the insensitive mode to be placed incorrectly in the generated `where`

---

## [1.4.1] - 2026-09-01 (Português)

### Corrigido

- `mode: "insensive"` estava sendo injetado no nível errado em filtros de relations — antes, `otherProps` (que inclui `mode`) era atribuído a `path[argName]` (o objeto da relation aninhada) em vez do nível atual do filtro, causando colocação incorreta do modo insensitive no `where` gerado

---

## [1.4.0] - 2026-08-11

### Fixed

- Dynamic methods combining multiple filters on the **same relation** no longer lose all but the last filter — previously, filters like `findBy...AndEnderecoWithEstadoAndEnderecoWithCidadeNormalizadaStartsWith...` produced a `where` with only the last relation filter (`estado` was lost), because `resolveSpecificWhere` merged the generated paths with `Object.assign` (shallow merge). It now uses `deepmerge` (deep merge), so relation filters coexist correctly (e.g. `endereco: { is: { estado, cidadeNormalizada } }`)

### Added

- Regression tests (`test/implementation/specific-where.test.ts`) covering multiple filters on the same relation in `resolveSpecificWhere`, including plain fields, relation filters, OR/AND groups, pure `With` combined with `WithField`, and `betweenMode` combined with another operator on the same field

---

## [1.4.0] - 2026-08-11 (Português)

### Corrigido

- Métodos dinâmicos que combinam múltiplos filtros na **mesma relation** não perdem mais todos os filtros exceto o último — antes, filtros como `findBy...AndEnderecoWithEstadoAndEnderecoWithCidadeNormalizadaStartsWith...` geravam um `where` apenas com o último filtro da relation (`estado` era perdido), porque o `resolveSpecificWhere` mesclava os caminhos gerados com `Object.assign` (merge raso). Agora ele usa `deepmerge` (merge profundo), fazendo os filtros de relation coexistirem corretamente (ex.: `endereco: { is: { estado, cidadeNormalizada } }`)

### Adicionado

- Testes de regressão (`test/implementation/specific-where.test.ts`) cobrindo múltiplos filtros na mesma relation em `resolveSpecificWhere`, incluindo campos simples, filtros de relation, grupos OR/AND, `With` puro combinado com `WithCampo`, e `betweenMode` combinado com outro operador no mesmo campo

---

## [1.3.9] - 2026-08-10

### Added

- Now `README.md` and `README.pt-BR.md` include the `VSRepository` logo for visual identity.

---

## [1.3.9] - 2026-08-10 (Português)

### Adicionado

- Agora `README.md` e `README.pt-BR.md` contém a logo do `VSRepository` para identidade visual.

---

## [1.3.8] - 2026-08-03

### Fixed

- `vsrepo generate` now copies the README files from the `vsrepo` package root (`node_modules/vsrepo` or the repository itself) instead of the consumer project's root — previously it copied the consumer's own `README.md` and failed to find the other READMEs (`README.pt-BR.md`, `README-DynamicRepo.md`, `README-DynamicRepo.pt-BR.md`) when they didn't exist in the consumer project

### Changed

- The `files` field in `package.json` now explicitly includes the README files (`README.md`, `README.pt-BR.md`, `README-DynamicRepo.md`, `README-DynamicRepo.pt-BR.md`) so they are shipped inside the published npm package — previously only `README.md` and `README.pt-BR.md` were included automatically by npm, leaving the `README-DynamicRepo*` files missing from the installed package

---

## [1.3.8] - 2026-08-03 (Português)

### Corrigido

- `vsrepo generate` agora copia os READMEs da raiz do pacote `vsrepo` (`node_modules/vsrepo` ou o próprio repositório) em vez da raiz do projeto do consumidor — antes ele copiava o `README.md` do próprio consumidor e falhava ao não encontrar os demais READMEs (`README.pt-BR.md`, `README-DynamicRepo.md`, `README-DynamicRepo.pt-BR.md`) quando eles não existiam no projeto do consumidor

### Alterado

- O campo `files` no `package.json` agora inclui explicitamente os arquivos README (`README.md`, `README.pt-BR.md`, `README-DynamicRepo.md`, `README-DynamicRepo.pt-BR.md`) para que sejam empacotados no pacote npm publicado — antes apenas `README.md` e `README.pt-BR.md` eram incluídos automaticamente pelo npm, deixando os arquivos `README-DynamicRepo*` ausentes do pacote instalado

---

## [1.3.7] - 2026-08-03

### Added

- `vsrepo generate` now copies the project READMEs (`README.md`, `README.pt-BR.md`, `README-DynamicRepo.md`, `README-DynamicRepo.pt-BR.md`) to a `docs/` folder inside the generated output directory

### Changed

- The generated output now includes a `docs/` directory containing the project documentation

---

## [1.3.7] - 2026-08-03 (Português)

### Adicionado

- `vsrepo generate` agora copia os READMEs do projeto (`README.md`, `README.pt-BR.md`, `README-DynamicRepo.md`, `README-DynamicRepo.pt-BR.md`) para uma pasta `docs/` dentro do diretório de saída gerado

### Alterado

- A saída gerada agora inclui um diretório `docs/` contendo a documentação do projeto

---

## [1.3.6] - 2026-08-01

### Added

- `ordering` support in method options, replacing `ordenation` as the preferred name while keeping full backward compatibility — `ordenation` is now marked as deprecated
- GitHub Actions CI workflow (`.github/workflows/ci.yml`) to lint, typecheck and test the project on every push and pull request
- Error handling tests (`test/implementation/error-handling.test.ts`) covering the `VSRepoRuntimeError` error codes
- Documentation of all `VSRepoRuntimeError` error codes in README.md and README.pt-BR.md

### Fixed

- Generated `index.ts` now exports the `VSRepoDecoratorError` class (previously missing from the generated output, preventing consumers from importing it)
- Fixed internal typo `dinamic` → `dynamic` in file names, constants and types (e.g. `dynamic-method-info`, `dynamic-method-customization`, `dynamic-methods-key`)

### Changed

- Tests, examples and documentation updated to use `ordering` instead of `ordenation`
- `ordenation` marked as deprecated in favor of `ordering` (still fully supported)
- Reformatted Markdown documentation files for better consistency and readability

---

## [1.3.6] - 2026-08-01 (Português)

### Adicionado

- Suporte a `ordering` nas options dos métodos, substituindo `ordenation` como nome preferido mantendo compatibilidade total com versões anteriores — `ordenation` agora está marcado como deprecated
- Workflow de CI do GitHub Actions (`.github/workflows/ci.yml`) para executar lint, typecheck e testes a cada push e pull request
- Testes de error handling (`test/implementation/error-handling.test.ts`) cobrindo os códigos de erro do `VSRepoRuntimeError`
- Documentação de todos os códigos de erro do `VSRepoRuntimeError` no README.md e README.pt-BR.md

### Corrigido

- O `index.ts` gerado agora exporta a classe `VSRepoDecoratorError` (antes ausente na saída gerada, impedindo que consumidores conseguissem importá-la)
- Corrigido typo interno `dinamic` → `dynamic` em nomes de arquivos, constantes e tipos (ex.: `dynamic-method-info`, `dynamic-method-customization`, `dynamic-methods-key`)

### Alterado

- Testes, exemplos e documentação atualizados para usar `ordering` no lugar de `ordenation`
- `ordenation` marcado como deprecated em favor de `ordering` (ainda totalmente suportado)
- Reformatados os arquivos de documentação Markdown para melhor consistência e legibilidade

---

## [1.3.5] - 2026-07-27

### Added

- Raw `select` support in method options (`options.select`): pass a raw Prisma `select` directly in a method call, without registering it beforehand in `selectModels` — mirrors the existing raw `include` (`options.include`)
- Full typing for `options.select`: works across all base methods (`get`, `getOrThrow`, `getList`, `remove`, `save`, `saveList`, `patch`, `patchList`, `merge`, `getAll`, `softRemove`, `restore`) and dynamics, narrows the return type to exactly the selected fields, and is mutually exclusive with `selectModel`, `includeModel` and `include`
- `select` field added to `DynamicMethodOptions` (class-based `DynamicRepository` API)
- Documentation for raw `select` in README.md, README-DynamicRepo.md and their Portuguese counterparts
- Runtime validation for `QueryMethod`'s `value` parameter — throws `VSRepoDecoratorError` if it isn't a string
- Reorganized the project's tests into a dedicated `test/` folder: `test/implementation` (Jest-based runtime tests, replacing the old root-level `teste.ts`/`teste-class.ts`) and `test/typing` (compile-time type tests checked via `tsc --noEmit`, using `@ts-expect-error` to assert invalid usages are rejected)
- New npm scripts: `test`, `test:implementation`, `test:implementation:watch`, `test:typing`
- Implementation and typing tests for raw `select`, covering both the functional (`setupVSRepo`) and class-based (`DynamicRepository`) APIs

### Fixed

- Generated `VSRepoError.ts` now also exports `VSRepoDecoratorError` (previously missing from the generated output, causing consumers to be unable to import it)

### Changed

- Updated the generated file tree diagram in the README to include the `DynamicRepository.ts`/`DynamicRepository.types.d.ts` files

---

## [1.3.5] - 2026-07-27 (Português)

### Adicionado

- Suporte a `select` cru nas options dos métodos (`options.select`): permite passar um `select` bruto do Prisma diretamente na chamada, sem precisar registrá-lo antecipadamente em `selectModels` — espelha o `include` cru (`options.include`) já existente
- Tipagem completa para `options.select`: funciona em todos os métodos base (`get`, `getOrThrow`, `getList`, `remove`, `save`, `saveList`, `patch`, `patchList`, `merge`, `getAll`, `softRemove`, `restore`) e dinâmicos, restringe o tipo de retorno exatamente aos campos selecionados, e é mutuamente exclusivo com `selectModel`, `includeModel` e `include`
- Campo `select` adicionado ao `DynamicMethodOptions` (API baseada em classes `DynamicRepository`)
- Documentação do `select` cru no README.md, README-DynamicRepo.md e suas versões em português
- Validação em tempo de execução do parâmetro `value` do `QueryMethod` — lança `VSRepoDecoratorError` caso não seja uma string
- Reorganização dos testes do projeto em uma pasta `test/` dedicada: `test/implementation` (testes de runtime com Jest, substituindo os antigos `teste.ts`/`teste-class.ts` na raiz) e `test/typing` (testes de tipagem em tempo de compilação, checados com `tsc --noEmit`, usando `@ts-expect-error` para garantir que usos inválidos são rejeitados)
- Novos scripts npm: `test`, `test:implementation`, `test:implementation:watch`, `test:typing`
- Testes de implementação e de tipagem para o `select` cru, cobrindo tanto a API funcional (`setupVSRepo`) quanto a baseada em classes (`DynamicRepository`)

### Corrigido

- O `VSRepoError.ts` gerado agora também exporta `VSRepoDecoratorError` (antes ausente na saída gerada, impedindo que consumidores conseguissem importá-lo)

### Alterado

- Atualizado o diagrama da árvore de arquivos gerados no README para incluir os arquivos `DynamicRepository.ts`/`DynamicRepository.types.d.ts`

---

## [1.3.4] - 2026-07-25

### Added

- Query Methods: new `@QueryMethod` decorator (class-based) and `query` config (functional) for defining raw SQL query methods that bypass the name-parsing engine
- Support for non-modifying queries (`$queryRawUnsafe`) and modifying queries (`$executeRawUnsafe`, `modifying: true`)
- `QueryMethodArg` type for typing the `{ args, db? }` parameter
- Transaction support for query methods via `db: tx` parameter
- Query methods documentation
- Query methods examples
- Tests for query methods in both functional and class-based approaches

### Changed

- Clarified in documentation that the `WRelations` generic in `DynamicRepository` is optional and explained when to use it
- Translated documentation to Portuguese

---

## [1.3.4] - 2026-07-25 (Português)

### Adicionado

- Query Methods: novo decorador `@QueryMethod` (abordagem class-based) e config `query` (abordagem funcional) para definir métodos de query SQL raw que ignoram o engine de parsing por nome
- Suporte para queries não-modificantes (`$queryRawUnsafe`) e modificantes (`$executeRawUnsafe`, `modifying: true`)
- Tipo `QueryMethodArg` para tipar o parâmetro `{ args, db? }`
- Suporte a transações para query methods via parâmetro `db: tx`
- Documentação dos query methods
- Exemplos dos query methods
- Testes para query methods nas abordagens funcional e class-based

### Alterado

- Esclarecido na documentação que a generic `WRelations` no `DynamicRepository` é opcional e explicado quando utilizá-la
- Documentação traduzida para português

---

## [1.3.3] - 2026-07-22

### Added

- DynamicRepository: base structure for dynamic repository functionality
- Complete typing for DynamicRepository and DynamicMethod
- Native Prisma `include` support in method options typing
- Real implementation for raw include support
- Improved build logging
- DynamicRepository documentation (README-DynamicRepo.md)
- DynamicRepository examples
- Tests for DynamicRepository and include parameter

### Fixed

- Fixed typing for objects with relations
- Fixed DynamicRepository typing
- Fixed DynamicMethod typing
- Fixed pushWhere error in some dynamic methods

### Changed

- Translated package.json description to English

---

## [1.3.3] - 2026-07-22 (Português)

### Adicionado

- DynamicRepository: estrutura base da funcionalidade de repositório dinâmico
- Tipagem completa para DynamicRepository e DynamicMethod
- Suporte nativo ao `include` do Prisma na tipagem das opções de método
- Implementação real do suporte ao include raw
- Melhoria nos logs de build
- Documentação do DynamicRepository (README-DynamicRepo.md)
- Exemplos para DynamicRepository
- Testes para DynamicRepository e parâmetro include

### Corrigido

- Correção da tipagem dos objetos com relations
- Correção da tipagem do DynamicRepository
- Correção da tipagem do DynamicMethod
- Correção do erro do pushWhere em alguns métodos dinâmicos

### Alterado

- Descrição do package.json traduzida para inglês

---
