<a id="top"></a>

🇧🇷 Português | [🇺🇸 English](./dynamic-methods.md)

[← Voltar para o Sumário](./README.pt-BR.md)

# Métodos dinâmicos

Métodos dinâmicos são declarados como um campo `declare` anotado com `@DynamicMethod()`. O comportamento deles — qual método do adapter chamar, quais filtros aplicar e como os argumentos se mapeiam para eles — é inferido inteiramente a partir do **nome** do campo.

```typescript
class UserRepository extends VSRepository<User, string> {
    @DynamicMethod()
    declare findByEmail: (email: string, options?: MethodOptions<User>) => Promise<User[]>;

    @DynamicMethod()
    declare findOneByEmail: (email: string, options?: MethodOptions<User>) => Promise<User | null>;

    @DynamicMethod()
    declare updateById: (id: string, data: DeepPartial<User>, options?: MethodOptions<User>) => Promise<User>;

    // Baseado em where: VSRepoWhere<T> como primeiro parâmetro, pagination penúltimo, MethodOptions por último
    @DynamicMethod()
    declare findWherePaginated: (
        where: VSRepoWhere<User>,
        pagination: Pagination,
        options?: MethodOptions<User>,
    ) => Promise<User[]>;

    // filtros de campo, depois pagination, depois MethodOptions
    @DynamicMethod()
    declare findByNameIgnoreCaseOrAgeBetweenOrderByCreatedAtAscPaginated: (
        name: string,
        age: [number, number],
        pagination: Pagination,
        options?: MethodOptions<User>,
    ) => Promise<User[]>;
}
```

> **O `MethodOptions` é sempre aceito:** todo método dinâmico, qualquer que seja o prefixo, aceita um `MethodOptions<Entity, OrmTypes>` opcional (`select`, `relations`, `see`, `db`, ...) como seu **último** argumento — o resolver trata qualquer argumento além do que o nome exige como `MethodOptions` e o valida como tal. Você ainda precisa **declará-lo na assinatura TS** para o TypeScript deixar você passá-lo (como em todos os exemplos acima); os exemplos mais abaixo às vezes o omitem por brevidade, ao demonstrar outra coisa, mas ele está disponível em todos eles também.

> Quer que o tipo de retorno acompanhe o `select`/`relations` passados, em vez de ser sempre a entidade inteira? Declare o método com [`InferMethodType`](#tipagem-de-retorno-restrita-com-infermethodtype).

## Prefixos disponíveis

| Prefixo                    | Método do adapter     | Retorna          | Observações                                                                               |
| -------------------------- | --------------------- | ---------------- | ----------------------------------------------------------------------------------------- |
| `findBy`                   | `findMany`            | `Entity[]`       | Filtros de campo seguem o prefixo.                                                        |
| `findOneBy`                | `findOne`             | `Entity \| null` | Filtros de campo seguem o prefixo; resultado único.                                       |
| `findOneOrThrowBy`         | `findOneOrThrow`      | `Entity`         | Lança erro se não encontrar.                                                              |
| `findOneOrThrow`           | `findOneOrThrow`      | `Entity`         | Sem filtros de campo; aplica só soft-delete/`see`.                                        |
| `findOneOrThrowWhere`      | `findOneOrThrow`      | `Entity`         | Recebe um `VSRepoWhere<T>` como primeiro argumento.                                       |
| `findWhere`                | `findMany`            | `Entity[]`       | Recebe um `VSRepoWhere<T>` como primeiro argumento.                                       |
| `findOneWhere`             | `findOne`             | `Entity \| null` | Recebe um `VSRepoWhere<T>` como primeiro argumento.                                       |
| `findOne`                  | `findOne`             | `Entity \| null` | Sem filtros de campo; aplica só soft-delete/`see`.                                        |
| `countBy`                  | `count`               | `number`         | Filtros de campo seguem o prefixo.                                                        |
| `countWhere`               | `count`               | `number`         | Recebe um `VSRepoWhere<T>` como primeiro argumento.                                       |
| `count`                    | `count`               | `number`         | Sem filtros de campo.                                                                     |
| `existsBy`                 | `exists`              | `boolean`        | Filtros de campo seguem o prefixo.                                                        |
| `existsWhere`              | `exists`              | `boolean`        | Recebe um `VSRepoWhere<T>` como primeiro argumento.                                       |
| `create`                   | `create`              | `Entity`         | Recebe `DeepPartial<Entity>` como argumento.                                              |
| `createMany`               | `createMany`          | `CountResult`    | Recebe `DeepPartial<Entity>[]` como argumento; suporta `IgnoreConflicts`.                 |
| `createManyReturning`      | `createManyReturning` | `Entity[]`       | Recebe `DeepPartial<Entity>[]` como argumento; suporta `IgnoreConflicts`.                 |
| `updateBy`                 | `update`              | `Entity`         | Filtros de campo + `DeepPartial<Entity>` como argumento.                                  |
| `updateWhere`              | `update`              | `Entity`         | Recebe um `VSRepoWhere<T>` como primeiro argumento, depois `DeepPartial<Entity>`.         |
| `updateManyBy`             | `updateMany`          | `CountResult`    | Filtros de campo + `DeepPartial<Entity>`.                                                 |
| `updateManyWhere`          | `updateMany`          | `CountResult`    | Recebe um `VSRepoWhere<T>` como primeiro argumento, depois `DeepPartial<Entity>`.         |
| `updateManyReturningBy`    | `updateManyReturning` | `Entity[]`       | Filtros de campo + `DeepPartial<Entity>`.                                                 |
| `updateManyReturningWhere` | `updateManyReturning` | `Entity[]`       | Recebe um `VSRepoWhere<T>` como primeiro argumento, depois `DeepPartial<Entity>`.         |
| `upsertBy`                 | `upsert`              | `Entity`         | Filtros de campo + payloads `create`/`update`.                                            |
| `upsertWhere`              | `upsert`              | `Entity`         | Recebe um `VSRepoWhere<T>` como primeiro argumento, depois os payloads `create`/`update`. |
| `deleteBy`                 | `delete`              | `Entity`         | Filtros de campo seguem o prefixo.                                                        |
| `deleteWhere`              | `delete`              | `Entity`         | Recebe um `VSRepoWhere<T>` como primeiro argumento.                                       |
| `deleteManyBy`             | `deleteMany`          | `CountResult`    | Filtros de campo seguem o prefixo.                                                        |
| `deleteManyWhere`          | `deleteMany`          | `CountResult`    | Recebe um `VSRepoWhere<T>` como primeiro argumento.                                       |
| `deleteManyReturningBy`    | `deleteManyReturning` | `Entity[]`       | Filtros de campo seguem o prefixo.                                                        |
| `deleteManyReturningWhere` | `deleteManyReturning` | `Entity[]`       | Recebe um `VSRepoWhere<T>` como primeiro argumento.                                       |

> `groupBy` **não está planejado** — ele não se encaixa bem no contrato agnóstico de ORM. Um prefixo `aggregate` separado também dificilmente será implementado: as operações de agregação mais comuns (`sum`, `average`, `min`, `max`, `increment`, `decrement`, `multiply`, `divide`) já estão disponíveis como métodos base dedicados — veja [Métodos atômicos e de agregação](./base-methods.pt-BR.md#métodos-atômicos-e-de-agregação). Para qualquer coisa mais complexa, use um `@QueryMethod` com SQL raw.

## Filtros de campo

Aplicados como sufixos ao nome do campo dentro do método:

| Sufixo                    | Significado                                                    | Argumento                        |
| ------------------------- | -------------------------------------------------------------- | -------------------------------- |
| _(sem sufixo)_ / `Equals` | igualdade (`=`)                                                | sim                              |
| `Not` / `NotEquals`       | negação                                                        | sim                              |
| `In`                      | está em                                                        | sim (array)                      |
| `NotIn`                   | não está em                                                    | sim (array)                      |
| `Contains`                | contém substring                                               | sim                              |
| `NotContains`             | não contém substring                                           | sim                              |
| `StartsWith`              | começa com                                                     | sim                              |
| `NotStartsWith`           | não começa com                                                 | sim                              |
| `EndsWith`                | termina com                                                    | sim                              |
| `NotEndsWith`             | não termina com                                                | sim                              |
| `GreaterThan`             | `>`                                                            | sim                              |
| `GreaterThanEqual`        | `>=`                                                           | sim                              |
| `LessThan`                | `<`                                                            | sim                              |
| `LessThanEqual`           | `<=`                                                           | sim                              |
| `Between`                 | intervalo inclusivo                                            | sim (tupla `[min, max]`)         |
| `NotBetween`              | fora de um intervalo inclusivo                                 | sim (tupla `[min, max]`)         |
| `IsNull`                  | campo é `null`                                                 | não                              |
| `IsNotNull`               | campo não é `null`                                             | não                              |
| `IsTrue`                  | campo é `true`                                                 | não                              |
| `IsFalse`                 | campo é `false`                                                | não                              |
| `IgnoreCase`              | combinador case-insensitive para filtros de texto              | sim                              |
| `Optional`                | flag opcional para deixar explícito que o parâmetro é opcional | sim _(na prática não muda nada)_ |

```typescript
@DynamicMethod()
declare findByNameContainsIgnoreCase: (name: string) => Promise<User[]>;

@DynamicMethod()
declare findByAgeBetween: (age: [number, number]) => Promise<User[]>;
```

> **Colisão de palavra-chave em nome de campo:** um sufixo/operador só é reconhecido numa fronteira de camelCase — seguido de letra maiúscula, de caractere não-ASCII ou (para sufixos de campo) do fim do nome — então `findByOrganizationId` e `findByNotes` resolvem para os campos `organizationId` e `notes`, não para as palavras-chave `Or`/`Not`. Ainda fica um caso ambíguo: um campo cujo nome termina de fato numa fronteira com as mesmas letras de uma palavra-chave (ex.: `checkIn`, que por padrão é lido como o campo `check` + o sufixo `In`). Adicione `Equals` (ou `NotEquals`) para forçar igualdade e desambiguar: `findByCheckInEquals` resolve para o campo `checkIn`.

## Operadores lógicos

| Operador | Uso no nome                    | Exemplo                                             |
| -------- | ------------------------------ | --------------------------------------------------- |
| `And`    | entre dois campos              | `findOneByIdAndEmail`                               |
| `Or`     | entre dois campos              | `findByNameOrEmail`                                 |
| `AND`    | separa um bloco final em `AND` | `findByEmailOrNameANDActiveStatusAndAgeGreaterThan` |

Regras do `AND` (em capslock): só é permitido **um** `AND` por nome de método; todo campo conectado por `And` depois dele é aninhado dentro de `AND: []`; `Or` não pode aparecer depois de um `AND` — usar dessa forma lança um `VSRepoError` (`RESOLVER`) ao construir o repository. Veja [Tratamento de erros](./error-handling.pt-BR.md#tratamento-de-erros).

## Filtros de relação

Filtram por campos de entidades relacionadas. Internamente, mapeiam para os operadores `_some`/`_every`/`_none`/`_with`/`_without` de `VSRepoWhere` (veja [`select` e `relations`](./select-and-relations.pt-BR.md#select-e-relations) para o equivalente de eager loading).

| Sufixo         | Significado                                       | Restrição                                                               |
| -------------- | ------------------------------------------------- | ----------------------------------------------------------------------- |
| `Some`         | pelo menos um registro relacionado corresponde    | apenas relações to-many                                                 |
| `SomeField`    | filtra dentro dos registros relacionados          | apenas relações to-many                                                 |
| `Every`        | todo registro relacionado corresponde             | apenas relações to-many (precisa de `Field` para ser um filtro efetivo) |
| `EveryField`   | filtra dentro dos registros relacionados          | apenas relações to-many                                                 |
| `None`         | nenhum registro relacionado corresponde           | apenas relações to-many                                                 |
| `NoneField`    | filtra dentro dos registros relacionados          | apenas relações to-many                                                 |
| `With`         | o registro relacionado existe                     | apenas relações to-one                                                  |
| `WithField`    | filtra um campo dentro do registro relacionado    | apenas relações to-one                                                  |
| `Without`      | o registro relacionado não existe                 | apenas relações to-one                                                  |
| `WithoutField` | filtro negado em um campo do registro relacionado | apenas relações to-one                                                  |

```typescript
@DynamicMethod()
declare findByAddressWithCityStartsWithIgnoreCase: (city: string) => Promise<User[]>;

@DynamicMethod()
declare findByProductsSome: () => Promise<User[]>;
```

## Ordenação, paginação e distinct

| Sufixo                                     | Efeito                                                                                                                                                                                                                                 |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Paginated`                                | Injeta um argumento `pagination` (`{ limit?, offset? }`) como **penúltimo** parâmetro (antes do `MethodOptions` opcional).                                                                                                             |
| `Ordered`                                  | Injeta um argumento `order: Ordering<T>` como **penúltimo** parâmetro (antes do `MethodOptions` opcional).                                                                                                                             |
| `OrderedAndPaginated`                      | Injeta `order` como antepenúltimo, depois `pagination` como penúltimo — ambos antes do `MethodOptions`.                                                                                                                                |
| `PaginatedAndOrdered`                      | Injeta `pagination` como antepenúltimo, depois `order` como penúltimo — ambos antes do `MethodOptions`.                                                                                                                                |
| `OrderBy<Campo>Asc` / `OrderBy<Campo>Desc` | Embute uma ordenação fixa diretamente no nome do método — encadeie campos com `And` (ex.: `OrderByCreatedAtAscAndNameDesc`). Não precisa de argumento `order`. _OBS: Se você não especificar `Asc` ou `Desc` ele considera como `Asc`_ |
| `Distinct<Campo>And<Campo>...`             | Embute campos `distinct` fixos diretamente no nome do método (só válido em métodos da família `findBy`/`findWhere`).                                                                                                                   |
| `IgnoreConflicts`                          | No `createMany`/`createManyReturning`, ignora registros que violariam uma constraint única, em vez de lançar erro.                                                                                                                     |

> ⚠️ **Ordem dos parâmetros:** `pagination` e `order` sempre vêm **antes** do último argumento opcional `MethodOptions<T>`. Quando `order` e `pagination` estão presentes juntos, a ordem relativa entre eles segue o nome do sufixo (`OrderedAndPaginated` → order, pagination; `PaginatedAndOrdered` → pagination, order).
>
> Usar `Paginated`/`Ordered`/`OrderBy`, `Distinct` ou `IgnoreConflicts` num prefixo que não os suporta (ex.: `Distinct` em `findOneBy`, `Paginated` em `existsBy`, `IgnoreConflicts` em `create`) lança um `VSRepoError` (`RESOLVER`) ao construir o repository, em vez de virar silenciosamente parte do nome do campo.

```typescript
// Paginated: pagination é o penúltimo parâmetro (antes do MethodOptions)
@DynamicMethod()
declare findByActiveOrderByCreatedAtDescPaginated:
    (active: boolean, pagination: Pagination, options?: MethodOptions<User>) => Promise<User[]>;

// OrderedAndPaginated: order, depois pagination, depois MethodOptions
@DynamicMethod()
declare findByNameContainsIgnoreCaseOrderedAndPaginated:
    (name: string, order: Ordering<User>, pagination: Pagination, options?: MethodOptions<User>) => Promise<User[]>;

@DynamicMethod()
declare createManyIgnoreConflicts: (data: DeepPartial<User>[]) => Promise<CountResult>;

// createManyReturning: mesmo comportamento do createMany, mas retorna os registros criados
@DynamicMethod()
declare createManyReturningIgnoreConflicts: (data: DeepPartial<User>[]) => Promise<User[]>;

// findOne sem filtro (equivalente ao findOneOrThrow sem filtro, mas retorna null em vez de lançar)
@DynamicMethod()
declare findOne: (options?: MethodOptions<User>) => Promise<User | null>;
```

> ⚠️ **Precedência entre `Distinct` e `OrderBy`:** quando os dois são usados no mesmo nome de método, **`Distinct` deve vir antes de `OrderBy`**:
>
> ```typescript
> @DynamicMethod()
> declare findByActiveDistinctNameOrderByCreatedAtDesc:
>     (active: boolean) => Promise<User[]>;
> ```
>
> Colocar `OrderBy` antes de `Distinct` (ex.: `findByActiveOrderByCreatedAtDescDistinctName`) não é um padrão válido e lança um `VSRepoError` (`RESOLVER`) ao construir o repository: `The "Distinct" modifier cannot appear after the "OrderBy" modifier.`

## Options do decorador

`@DynamicMethod<T>(options?)` aceita:

| Option           | Tipo          | Descrição                                                                                                                                |
| ---------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `proxyTo`        | `string`      | Redireciona a lógica do método para outro padrão de método dinâmico válido — útil para nomes que não seguem a convenção de nomenclatura. |
| `injectOrdering` | `Ordering<T>` | Ordenação fixa injetada automaticamente, sobrescrevendo o `defaultOrdering` do repository.                                               |

```typescript
// proxyTo: dá um nome customizado ao método reutilizando um padrão existente
@DynamicMethod<User>({ proxyTo: "findByEmail" })
declare buscarPorEmail: (email: string, options?: MethodOptions<User>) => Promise<User[]>;

// injectOrdering: sempre ordena por createdAt desc, sobrescrevendo o defaultOrdering
@DynamicMethod<User>({ injectOrdering: { createdAt: "desc" } })
declare findByStatus: (status: string) => Promise<User[]>;
```

## Tipagem de retorno restrita com `InferMethodType`

Normalmente você escreve à mão a assinatura de um método dinâmico, e o retorno é o que você declarar (em geral a entidade inteira). `InferMethodType<Args, Return, OrmTypes?>` declara o método para você e infere o retorno **a cada chamada** a partir do `select`/`relations` passados — com as mesmas regras do [`InferMethodReturn`](./select-and-relations.pt-BR.md#tipagem-de-retorno-restrita-com-infermethodreturn):

```typescript
class UserRepository extends VSRepository<User, string, MyOrmTypes> {
    @DynamicMethod()
    declare findByName: InferMethodType<[name: string], User[], MyOrmTypes>;

    // a terceira generic (OrmTypes) é opcional
    @DynamicMethod()
    declare findOneByEmail: InferMethodType<[email: string], User | null>;
}

await userRepository.findByName("John");
// { id: string; name: string; email: string }[]  (apenas os campos escalares)

await userRepository.findByName("John", { select: { id: true, products: { id: true } } });
// { id: string; products: { id: string }[] }[]

await userRepository.findOneByEmail("john@example.com", { relations: { address: true } });
// { id: string; name: string; email: string; address: Address | null } | null
```

| Generic    | Descrição                                                                                                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Args`     | Tupla com os argumentos posicionais do método, **sem** `options` — ex.: `[name: string]` ou `[where: VSRepoWhere<User>, pagination: Pagination]`.                           |
| `Return`   | O que o método resolve: `Entity`, `Entity \| null` ou `Entity[]`. O tipo da entidade usado em `select`/`relations` é extraído daqui.                                        |
| `OrmTypes` | _Opcional._ `VSRepoOrmTypes` do seu ORM, usado para tipar a option `db` (veja [Criando um repository](../README.pt-BR.md#criando-um-repository)). Padrão: `VSRepoOrmTypes`. |

- `options` (`MethodOptions<Entity, OrmTypes>`) é sempre o **último** parâmetro, opcional, depois de todos os argumentos de `Args`. Se algum desses argumentos for opcional, passe `undefined` explicitamente para alcançar `options`.
- Sem `options` o resultado tem apenas os campos escalares; com elas, segue as [mesmas regras](./select-and-relations.pt-BR.md#tipagem-de-retorno-restrita-com-infermethodreturn) do `InferMethodReturn` (inclusive `select` vencendo `relations`).
- Chaves inexistentes em `select`/`relations` (em qualquer profundidade) são rejeitadas em tempo de compilação, e o editor as sugere via autocomplete — igual a um parâmetro `MethodOptions<Entity>` comum.
- Funciona junto com as [options do decorador](#options-do-decorador) (`proxyTo`, `injectOrdering`).
- Foi pensado para métodos dinâmicos que retornam entidades (`findBy…`, `findOneBy…`, `findWhere…`, …). Os que não retornam — `countBy…`, `existsBy…` — mantêm a assinatura normal.

## Resolução lazy dos métodos dinâmicos

Por padrão, o construtor do `VSRepository` já resolve todo `@DynamicMethod`/`@QueryMethod` da subclasse de forma síncrona. Passando `lazyDynamicMethods: true` nas options do construtor, essa resolução é adiada — o repository fica pronto para uso (métodos base como `get`, `save`, etc.), mas os métodos dinâmicos só existem depois que a própria subclasse chamar o método `protected resolveDynamicMethods()`, herdado de `VSRepository`:

```typescript
class UserRepository extends VSRepository<User, string> {
    constructor() {
        super({ pkName: "id", adapter, lazyDynamicMethods: true });
        this.resolveDynamicMethods();
    }

    @DynamicMethod()
    declare findByEmail: (email: string) => Promise<User[]>;
}
```

Adiar a chamada ainda mais — para um hook de ciclo de vida posterior — é igualmente válido, e é onde a option realmente se torna útil: dá para empurrar o custo da resolução (relevante em repositories com muitos métodos decorados) para um momento mais oportuno do ciclo de vida da aplicação, ex.: um hook de inicialização assíncrona:

```typescript
class UserRepository extends VSRepository<User, string> {
    constructor() {
        super({ pkName: "id", adapter, lazyDynamicMethods: true });
    }

    @DynamicMethod()
    declare findByEmail: (email: string) => Promise<User[]>;

    // ex.: chamado no onModuleInit do Nest
    init() {
        this.resolveDynamicMethods();
    }
}
```

### O `declare` se torna opcional

Normalmente, o campo anotado com `@DynamicMethod()`/`@QueryMethod()` precisa do modificador `declare`:

```typescript
@DynamicMethod()
declare findByEmail: (email: string) => Promise<User[]>;
```

Isso existe por causa do `useDefineForClassFields` do TypeScript: sem `declare`, o compilador emite um `this.findByEmail = undefined` como parte da inicialização dos campos da subclasse, que roda logo após o `super()` retornar — ou seja, **depois** que o construtor do `VSRepository` já atribuiu a função ao método. Sem `declare`, esse `undefined` sobrescreveria a função recém-atribuída.

Com `lazyDynamicMethods: true`, essa inicialização de campo já rodou no momento em que `resolveDynamicMethods()` executa — seja chamado na linha seguinte ao `super(...)`, seja num hook posterior como o `onModuleInit` — então não tem mais nada para sobrescrever a função atribuída, e o `declare` se torna opcional:

```typescript
class UserRepository extends VSRepository<User, string> {
    constructor() {
        super({ pkName: "id", adapter, lazyDynamicMethods: true });
        this.resolveDynamicMethods();
    }

    // sem "declare"
    @DynamicMethod()
    findByEmail: (email: string) => Promise<User[]>;
}
```

### Chamando `resolveDynamicMethods()` mais de uma vez

Chamar `resolveDynamicMethods()` de novo depois que os métodos dinâmicos já foram resolvidos (seja porque você chamou manualmente mais de uma vez, seja por engano em cima de uma resolução eager) não lança erro — ela só reexecuta a resolução, sobrescrevendo os métodos com closures equivalentes. Como isso normalmente é redundante e indica um engano, o repository registra um `WARN` no logger interno nesse caso.

[⬆️ Voltar ao topo](#top)
