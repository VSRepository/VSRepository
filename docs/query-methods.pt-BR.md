<a id="top"></a>

🇧🇷 Português | [🇺🇸 English](./query-methods.md)

[← Voltar para o Sumário](./README.pt-BR.md)

# Query methods (SQL raw)

`@QueryMethod` ignora totalmente o engine de parsing por nome e executa uma instrução SQL raw através do método `query()` do adapter. Use placeholders para os valores passados como argumentos — nunca interpole valores diretamente na string SQL.

Existem três formas de escrever valores numa query raw:

- **Os placeholders agnósticos do VSRepository** (o padrão) — strings cruas usam `?1`, `?2`, ... (base 1, estilo Spring Data JPA) independentemente do banco por trás do adapter. Veja [Placeholders agnósticos com `vsPlaceholders`](#placeholders-agnósticos-com-vsplaceholders).
- **A sintaxe nativa de placeholder do seu adapter** — defina `vsPlaceholders: false` e escreva o estilo do próprio banco: `$1`, `$2`, ... no PostgreSQL, `?` no MySQL/SQLite. Consulte a documentação do seu adapter para saber a sintaxe exata.
- **Fragmentos `VSSql`** — monte a query como um fragmento componível com o template literal com tag `VSSql.sql` e passe direto para `query()`; os valores são parametrizados automaticamente. Veja [Fragmentos parametrizados com `VSSql`](#fragmentos-parametrizados-com-vssql).

```typescript
class UserRepository extends VSRepository<User, string> {
    @QueryMethod('SELECT * FROM "user" WHERE email = ?1')
    declare findByEmailRaw: (email: string, db?: DbArg) => Promise<User[]>;

    @QueryMethod('UPDATE "user" SET active = true WHERE id = ?1', { modifying: true })
    declare activateUser: (id: string, db?: DbArg) => Promise<number>;

    // Aqui só se espera uma linha, então `singleResult` transforma o array
    // em um único objeto (ou `null` quando nenhuma linha corresponde).
    @QueryMethod('SELECT * FROM "user" WHERE id = ?1 LIMIT 1', { singleResult: true })
    declare findByIdRaw: (id: string, db?: DbArg) => Promise<User | null>;
}
```

| Option         | Tipo      | Padrão  | Descrição                                                                                                                                                                                                                                                                           |
| -------------- | --------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modifying`    | `boolean` | `false` | Quando `true`, o SQL é executado como instrução que modifica dados (`INSERT`/`UPDATE`/`DELETE`) e o método resolve para o número de linhas afetadas. Quando `false`, executa como query de leitura e resolve para o tipo de retorno declarado.                                      |
| `singleResult` | `boolean` | `false` | Quando `true`, transforma um resultado em array no seu primeiro elemento (`null` se vazio), permitindo declarar o tipo de retorno como um objeto único em vez de array. Não tem efeito em resultados que não são array (ex.: o número de linhas afetadas de uma query `modifying`). |

Query methods são herdados pelas subclasses assim como os métodos dinâmicos — veja [Herdando de outro repository](./dynamic-methods.pt-BR.md#herdando-de-outro-repository).

## Argumentos e transações

Um `@QueryMethod` recebe os valores dos placeholders como **argumentos posicionais** simples, na ordem de `?1`, `?2`, ...:

```typescript
class UserRepository extends VSRepository<User, string> {
    @QueryMethod('SELECT * FROM "user" WHERE email = ?1 AND "userType" = ?2')
    declare findByEmailAndType: (email: string, userType: string, db?: DbArg) => Promise<User[]>;
}

const admins = await userRepository.findByEmailAndType("joao@email.com", "admin");
```

Para rodar a query com um client ou transação específico em vez do client padrão do repository, passe `withDb(tx)` como argumento final — ele embrulha `tx` em um `DbArg`, que o resolver reconhece via `instanceof`, então nunca é confundido com um argumento posicional comum, mesmo que esse argumento seja um objeto. Declare `db?: DbArg` como último parâmetro para tipá-lo:

```typescript
await userRepository.transaction(async tx => {
    await userRepository.findByEmailAndType("joao@email.com", "admin", withDb(tx));
});
```

Isso vale apenas para campos declarados com `@QueryMethod`. O `query()` mantém o seu próprio objeto de options `{ args, db? }`.

## Queries raw pontuais com `query()`

Para SQL raw pontual que não justifica declarar um `@QueryMethod` na classe do repository, chame `query()` diretamente — ele está disponível em toda instância de `VSRepository` e usa o `query()` do adapter por baixo dos panos:

```typescript
const users = await userRepository.query<User[]>('SELECT * FROM "user" WHERE email = ?1', {
    args: ["maria@email.com"],
});

const linhasAfetadas = await userRepository.query<number>('UPDATE "user" SET active = true WHERE id = ?1', {
    args: ["123"],
    modifying: true,
});

// Aqui só se espera uma linha, então `singleResult` transforma o array
// em um único objeto (ou `null` quando nenhuma linha corresponde).
const user = await userRepository.query<User | null>('SELECT * FROM "user" WHERE id = ?1 LIMIT 1', {
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

| Option         | Tipo      | Padrão                      | Descrição                                                                                                                                                                                                                                                                                                             |
| -------------- | --------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `args`         | `any[]`   | `undefined`                 | Parâmetros posicionais injetados nos placeholders do SQL — `?1`, `?2`, ... por padrão, ou a sintaxe nativa do seu banco quando `vsPlaceholders` é `false` (veja abaixo). Nunca interpole valores diretamente na string SQL. Não é aceito quando `sql` é um fragmento `VSSql` — os valores dele já vêm parametrizados. |
| `db`           | `any`     | Client padrão do repository | Client ou transação do banco em que essa query deve rodar.                                                                                                                                                                                                                                                            |
| `modifying`    | `boolean` | `false`                     | Quando `true`, retorna o número de linhas afetadas.                                                                                                                                                                                                                                                                   |
| `singleResult` | `boolean` | `false`                     | Quando `true`, transforma um resultado em array no seu primeiro elemento (`null` se vazio). Não tem efeito em resultados que não são array (ex.: o número de linhas afetadas de uma query `modifying`).                                                                                                               |

Assim como os métodos base, dinâmicos e query, `query()` aceita `db` em `options` para participar de um bloco `transaction()`.

## Placeholders agnósticos com `vsPlaceholders`

As strings SQL cruas passadas para `query()` e `@QueryMethod` não dependem do dialeto de placeholders do seu adapter/banco: elas usam os placeholders próprios, agnósticos e posicionais do VSRepository — `?1`, `?2`, ... (base 1, estilo Spring Data JPA). Esse é o padrão (`vsPlaceholders: true`); defina como `false` nas [options do construtor](./base-methods.pt-BR.md#options-do-construtor) — ou globalmente com `VSRepository.setGlobalConfig()` — para escrever a sintaxe nativa do seu banco.

```typescript
class UserRepository extends VSRepository<User, string> {
    @QueryMethod('SELECT * FROM "user" WHERE email = ?1 AND active = ?2')
    declare findByEmailAndActive: (email: string, active: boolean) => Promise<User[]>;
}

const users = await userRepository.query<User[]>('SELECT * FROM "user" WHERE email = ?1', {
    args: ["maria@email.com"],
});
```

> [!NOTE]
>
> - O mesmo índice pode aparecer mais de uma vez (`?1 ... ?1`) para reutilizar o mesmo argumento — cada ocorrência vira seu próprio par placeholder/valor na saída compilada.
> - Um `?N` dentro de um literal de string com aspas simples (ex.: `SELECT ... WHERE note = 'use ?1 literally'`) **não** é tratado como placeholder — ele passa intacto para o SQL e não consome nenhuma entrada de `args`. Escapes do SQL padrão são respeitados, então `''` dentro de um literal não o encerra (`'it''s ?1'` é ignorado por completo). Edge cases: - Não existe mecanismo de escape **fora** de um literal: se uma query precisar de texto literal `?` + dígitos num contexto sem aspas, monte essa parte com um fragmento `VSSql`. - O matching só dispara quando `?` é seguido **imediatamente** de um dígito, então operadores como `?` do PostgreSQL (existência de chave JSONB), `?|` e `?&` não são afetados.
> - `?1` é compilado via `getPlaceholder()` do adapter.
> - Isso é independente dos fragmentos `VSSql`: um `VSSql` passado para `query()` sempre compila através do `getPlaceholder()`, independentemente dessa option.

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
> - Um fragmento `VSSql` é compilado através do `getPlaceholder()` do adapter (então usa a sintaxe nativa do seu banco, independentemente do `vsPlaceholders`). As outras options do `query()` (`modifying`, `singleResult`, `db`) continuam funcionando normalmente.
> - Valores interpolados via `${...}` (incluindo elementos de `join`) viram sempre parâmetros; só o `VSSql.raw` insere texto como está. Se você não puder descartar input do usuário para um nome de tabela/coluna, valide contra uma lista fixa antes de usar — `raw` não oferece nenhuma proteção.

[⬆️ Voltar ao topo](#top)
