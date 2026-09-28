<a id="top"></a>

🇧🇷 Português | [🇺🇸 English](./query-methods.md)

[← Voltar para o Sumário](./README.pt-BR.md)

# Query methods (SQL raw)

`@QueryMethod` ignora totalmente o engine de parsing por nome e executa uma instrução SQL raw através do método `query()` do adapter. Use placeholders para os valores passados via `args` — nunca interpole valores diretamente na string SQL.

Existem três formas de escrever valores numa query raw:

- **A sintaxe nativa de placeholder do seu adapter** — o estilo `$1`, `$2`, ... usado nos exemplos abaixo é a convenção do PostgreSQL; o MySQL, por exemplo, usa `?`. Consulte a documentação do seu adapter para saber a sintaxe exata.
- **Os placeholders nativos e agnósticos do VSRepository** — com `vsPlaceholders: true` nas options do construtor, strings cruas usam `?1`, `?2`, ... (base 1, estilo Spring Data JPA) independentemente do banco por trás do adapter. Veja [Placeholders agnósticos com `vsPlaceholders`](#placeholders-agnósticos-com-vsplaceholders).
- **Fragmentos `VSSql`** — monte a query como um fragmento componível com o template literal com tag `VSSql.sql` e passe direto para `query()`; os valores são parametrizados automaticamente. Veja [Fragmentos parametrizados com `VSSql`](#fragmentos-parametrizados-com-vssql).

```typescript
class UserRepository extends VSRepository<User, string> {
    @QueryMethod('SELECT * FROM "user" WHERE email = $1')
    declare findByEmailRaw: (arg: QueryMethodArg<[email: string]>) => Promise<User[]>;

    @QueryMethod('UPDATE "user" SET active = true WHERE id = $1', { modifying: true })
    declare activateUser: (arg: QueryMethodArg<[id: string]>) => Promise<number>;

    // Aqui só se espera uma linha, então `singleResult` transforma o array
    // em um único objeto (ou `null` quando nenhuma linha corresponde).
    @QueryMethod('SELECT * FROM "user" WHERE id = $1 LIMIT 1', { singleResult: true })
    declare findByIdRaw: (arg: QueryMethodArg<[id: string]>) => Promise<User | null>;
}
```

| Option         | Tipo      | Padrão  | Descrição                                                                                                                                                                                                                                                                           |
| -------------- | --------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modifying`    | `boolean` | `false` | Quando `true`, o método resolve para o número de linhas afetadas. Quando `false`, executa como query de leitura e resolve para o tipo de retorno declarado.                                                                                                                         |
| `singleResult` | `boolean` | `false` | Quando `true`, transforma um resultado em array no seu primeiro elemento (`null` se vazio), permitindo declarar o tipo de retorno como um objeto único em vez de array. Não tem efeito em resultados que não são array (ex.: o número de linhas afetadas de uma query `modifying`). |

Query methods aceitam `{ args, db? }` na chamada — `db` permite que participem de um bloco `transaction()`, assim como os métodos base e dinâmicos.

## Argumentos via spread com `spreadArgs`

Por padrão, um `@QueryMethod` recebe seus valores de placeholder através de um único objeto `QueryMethodArg` (`method({ args: [...] })`). Defina `spreadArgs: true` para recebê-los como argumentos posicionais separados:

```typescript
class UserRepository extends VSRepository<User, string> {
    @QueryMethod('SELECT * FROM "user" WHERE email = $1 AND "userType" = $2', {
        spreadArgs: true,
    })
    declare findByEmailAndType: (...args: QueryArgs<[email: string, userType: string]>) => Promise<User[]>;

    // Ao invés de usar o `QueryArgs`, você também pode simplesmente definir `DbArg` como último parâmetro
    @QueryMethod('SELECT * FROM "user" WHERE id = $1', { spreadArgs: true })
    declare findById: (id: string, db?: DbArg) => Promise<User[]>;
}

const admins = await userRepository.findByEmailAndType("joao@email.com", "admin");
```

Para rodar a query com um client ou transação específico em vez do client padrão do repository, passe `withDb(tx)` como argumento final — ele embrulha `tx` em um `DbArg`, que o resolver reconhece via `instanceof`, então nunca é confundido com um argumento posicional comum, mesmo que esse argumento seja um objeto:

```typescript
await userRepository.transaction(async tx => {
    await userRepository.findByEmailAndType("joao@email.com", "admin", withDb(tx));
});
```

`spreadArgs` afeta apenas campos declarados com `@QueryMethod` — o padrão é `false`, e chamar um método declarado sem essa opção usando mais de um argumento lança erro, já que se espera o estilo de chamada com um único `QueryMethodArg`. Não tem efeito sobre `query()`, que sempre aceita `{ args, db? }`.

## Queries raw pontuais com `query()`

Para SQL raw pontual que não justifica declarar um `@QueryMethod` na classe do repository, chame `query()` diretamente — ele está disponível em toda instância de `VSRepository` e usa o `query()` do adapter por baixo dos panos:

```typescript
const users = await userRepository.query<User[]>('SELECT * FROM "user" WHERE email = $1', {
    args: ["maria@email.com"],
});

const linhasAfetadas = await userRepository.query<number>('UPDATE "user" SET active = true WHERE id = $1', {
    args: ["123"],
    modifying: true,
});

// Aqui só se espera uma linha, então `singleResult` transforma o array
// em um único objeto (ou `null` quando nenhuma linha corresponde).
const user = await userRepository.query<User | null>('SELECT * FROM "user" WHERE id = $1 LIMIT 1', {
    args: ["123"],
    singleResult: true,
});
```

O segundo overload aceita um fragmento `VSSql` (veja [Fragmentos parametrizados com `VSSql`](#fragmentos-parametrizados-com-vssql)) — deixe o fragmento trazer seus próprios valores parametrizados em vez de passar `args`:

```typescript
const users = await userRepository.query<User[]>(
    VSSql.sql`SELECT * FROM "user" WHERE email = ${"maria@email.com"} AND active = ${true}`,
);

const linhasAfetadas = await userRepository.query<number>(
    VSSql.sql`UPDATE "user" SET active = true WHERE id = ${"123"}`,
    { modifying: true },
);
```

| Option         | Tipo      | Padrão                      | Descrição                                                                                                                                                                                                                                                                                                                                        |
| -------------- | --------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `args`         | `any[]`   | `undefined`                 | Parâmetros posicionais injetados nos placeholders do SQL — a sintaxe dos placeholders depende do banco/driver usado pelo seu adapter (ou use `vsPlaceholders` para placeholders `?1`, veja abaixo). Nunca interpole valores diretamente na string SQL. Não é aceito quando `sql` é um fragmento `VSSql` — os valores dele já vêm parametrizados. |
| `db`           | `any`     | Client padrão do repository | Client ou transação do banco em que essa query deve rodar.                                                                                                                                                                                                                                                                                       |
| `modifying`    | `boolean` | `false`                     | Quando `true`, retorna o número de linhas afetadas.                                                                                                                                                                                                                                                                                              |
| `singleResult` | `boolean` | `false`                     | Quando `true`, transforma um resultado em array no seu primeiro elemento (`null` se vazio). Não tem efeito em resultados que não são array (ex.: o número de linhas afetadas de uma query `modifying`).                                                                                                                                          |

Assim como os métodos base, dinâmicos e query, `query()` aceita `db` em `options` para participar de um bloco `transaction()`.

## Placeholders agnósticos com `vsPlaceholders`

Para não depender do dialeto de placeholders do seu adapter/banco, defina `vsPlaceholders: true` nas [options do construtor](./base-methods.pt-BR.md#options-do-construtor) e as strings SQL cruas passadas para `query()` e `@QueryMethod` deixam de usar a sintaxe nativa do seu banco — elas passam a usar os placeholders próprios, posicionais e agnósticos do VSRepository: `?1`, `?2`, ... (base 1, estilo Spring Data JPA).

```typescript
class UserRepository extends VSRepository<User, string> {
    constructor() {
        super({ adapter, pkName: "id", vsPlaceholders: true });
    }

    @QueryMethod('SELECT * FROM "user" WHERE email = ?1 AND active = ?2', { spreadArgs: true })
    declare findByEmailAndActive: (email: string, active: boolean) => Promise<User[]>;
}

const users = await userRepository.query<User[]>('SELECT * FROM "user" WHERE email = ?1', {
    args: ["maria@email.com"],
});
```

> [!NOTE]
>
> - O mesmo índice pode aparecer mais de uma vez (`?1 ... ?1`) para reutilizar o mesmo argumento — cada ocorrência vira seu próprio par placeholder/valor na saída compilada.
> - Um `?N` dentro de um literal de string com aspas simples (ex.: `SELECT ... WHERE note = 'use ?1 literally'`) **não** é tratado como placeholder — ele passa intacto para o SQL e não consome nenhuma entrada de `args`. Escapes do SQL padrão são respeitados, então `''` dentro de um literal não o encerra (`'it''s ?1'` é ignorado por completo). Edge cases:
    - Não existe mecanismo de escape **fora** de um literal: se uma query precisar de texto literal `?` + dígitos num contexto sem aspas, monte essa parte com um fragmento `VSSql`.
    - O matching só dispara quando `?` é seguido **imediatamente** de um dígito, então operadores como `?` do PostgreSQL (existência de chave JSONB), `?|` e `?&` não são afetados.
> - Como `?1` é compilado via `adapter.getPlaceholder()`, o adapter precisa implementá-lo — o construtor lança um `VSRepoError` se `vsPlaceholders` estiver ligado e o adapter não implementar. `@QueryMethod` também resolve via `getPlaceholder()`, então vale a mesma exigência.
> - Isso é independente dos fragmentos `VSSql`: passar um `VSSql` para `query()` exige `getPlaceholder()` independentemente dessa option, e sempre compila através dela.

## Fragmentos parametrizados com `VSSql`

`VSSql` é um fragmento SQL agnóstico de ORM e componível, que compila para qualquer sintaxe de placeholder que o seu adapter declarar via `getPlaceholder()` — em vez de assumir uma. Um `VSSql` nunca toca no banco sozinho: monte um e passe direto para `VSRepository.query()`, que compila e executa.

Valores interpolados com `${...}` são **sempre** enviados como parâmetros ligados — nunca embutidos no texto SQL — então fragmentos são seguros contra SQL injection por construção:

```typescript
import { VSSql } from "vsrepo";

const fragment = VSSql.sql`SELECT * FROM "user" WHERE email = ${email}`;
const users = await userRepository.query<User[]>(fragment);
```

### `VSSql.sql` — template literal com tag

Cada `${value}` interpolado vira um parâmetro, exceto outro fragmento `VSSql`, que é "spliced" (seu texto é mesclado no atual e seus próprios parâmetros são acrescentados em ordem):

```typescript
const condition = VSSql.sql`AND active = ${true}`;
const fragment = VSSql.sql`
    SELECT * FROM "user" WHERE 1=1 ${condition}
`;
```

### `VSSql.raw` — identificadores confiáveis

Insere `text` na query **como está, sem parametrizar** — para identificadores (nomes de tabela/coluna) ou palavras-chave SQL que não podem ser ligadas como parâmetro. `text` nunca é escapado nem validado: **passe apenas input confiável, que não venha do usuário**.

```typescript
const table = VSSql.raw('"user"');
const fragment = VSSql.sql`SELECT * FROM ${table} WHERE active = ${true}`;
```

### `VSSql.join` — listas parametrizadas

Junta `values` em um único fragmento, separados por `separator` (padrão `", "`), envoltos por `prefix`/`suffix` opcionais. Cada elemento é um valor de parâmetro ou um fragmento `VSSql` aninhado. Usado principalmente para montar uma lista `IN (...)`:

```typescript
const ids = ["user-1", "user-2", "user-3"];

// compila para WHERE id IN ($1, $2, $3)
const fragment = VSSql.sql`SELECT * FROM "user" WHERE id IN (${VSSql.join(ids)})`;
```

### `VSSql.empty` — fragmentos condicionais

Não contribui com texto nem parâmetros — o ramo "nada" ao compor um fragmento condicionalmente:

```typescript
const onlyActive = true;

// compila para AND active = $1 quando onlyActive, e para nada caso contrário
const filter = onlyActive ? VSSql.sql`AND active = ${true}` : VSSql.empty;
```

### Compondo fragmentos

Fragmentos compõem livremente — aninhe-os à vontade e a numeração dos placeholders continua correta. Uma query realista combinando tudo acima:

```typescript
const onlyActive = true;
const ids = ["user-1", "user-2", "user-3"];

const filter = onlyActive ? VSSql.sql`AND active = ${true}` : VSSql.empty;

const fragment = VSSql.sql`
    SELECT * FROM ${VSSql.raw('"user"')}
    WHERE id IN (${VSSql.join(ids)})
    ${filter}
`;

const users = await userRepository.query<User[]>(fragment);
```

> [!NOTE]
>
> - Passar um fragmento `VSSql` para `query()` exige que o adapter implemente `getPlaceholder()` — caso contrário, `query()` lança um `VSRepoError`. As outras options do adapter (`modifying`, `singleResult`, `db`) continuam funcionando normalmente.
> - Valores interpolados via `${...}` (incluindo elementos de `join`) viram sempre parâmetros; só o `VSSql.raw` insere texto como está. Se você não puder descartar input do usuário para um nome de tabela/coluna, valide contra uma lista fixa antes de usar — `raw` não oferece nenhuma proteção.

[⬆️ Voltar ao topo](#top)
