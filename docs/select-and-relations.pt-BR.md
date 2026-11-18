<a id="top"></a>

🇧🇷 Português | [🇺🇸 English](./select-and-relations.md)

[← Voltar para o Sumário](./README.pt-BR.md)

# `select` e `relations`

Você passa `select` e `relations` diretamente em cada chamada:

```typescript
const usuario = await userRepository.get(id, {
    select: { id: true, name: true, address: { city: true } },
});

const usuarioComEndereco = await userRepository.get(id, {
    relations: { address: true },
});
```

- `select` espelha o formato da entidade: campos escalares recebem um `boolean`; campos de relação recebem um `boolean` ou um `select` aninhado.
- `relations` carrega registros relacionados; cada campo de relação recebe um `boolean` ou um objeto `relations` aninhado.
- `relationsOptions` filtra, ordena e pagina os registros relacionados que `select`/`relations` carregam (veja [abaixo](#filtrando-ordenando-e-paginando-relations-com-relationsoptions)).
- Se `select` e `relations` podem ser combinados depende do adapter (veja abaixo).

> [!WARNING]
>
> **Comportamento de `relations` depende do adapter:**
>
> O core apenas repassa `MethodOptions.select`, `MethodOptions.relations` e `MethodOptions.relationsOptions` ao adapter — cada adapter decide como traduzi-los para o ORM subjacente:
>
> - **Prisma 7 (`@vsrepo/prisma7-adapter` / `VSRepoPrisma7Adapter`)** — `relations` é convertido para `include` do Prisma (`parsePrismaInclude`). **Se `select` estiver presente, `relations` é ignorado** porque o Prisma não permite `select` + `include` na mesma query:
>
>     ```typescript
>     // Prisma7: relations é ignorado quando select existe
>     await userRepository.get(id, {
>         select: { id: true, name: true },
>         relations: { address: true }, // ← ignorado, include = undefined
>     });
>     ```
>
> - **Drizzle (`@vsrepo/drizzle-adapter` / `VSRepoDrizzleAdapter`, atualmente em alpha)** — `select` é convertido para o `columns` do Drizzle e `relations` para o `with`. **Se `select` estiver presente, `relations` é ignorado** (assim como no Prisma), mas campos de relação dentro do próprio `select` são movidos automaticamente para o `with`:
>     ```typescript
>     // Drizzle: relations é ignorado quando select existe
>     await userRepository.get(id, {
>         select: { id: true, name: true, address: { city: true } }, // address vai para o `with`
>         relations: { posts: true }, // ← ignorado
>     });
>     ```
>     Os detalhes (como o reconhecimento de relações marcadas como `true` dentro do `select`) e as limitações conhecidas estão na documentação do [`VSRepoDrizzleAdapter`](https://github.com/jaobrabo123/VSRepoDrizzleAdapter), que é a referência oficial. Como o adapter ainda está em alpha, esse comportamento pode mudar.
>
> Adapters customizados podem mapear `relations` de forma diferente — consulte a documentação do adapter para a semântica exata.

## Filtrando, ordenando e paginando relations com `relationsOptions`

`select` e `relations` decidem **quais** relações são carregadas. `relationsOptions` decide **quais registros** dessas relações voltam: filtrados com `where`, ordenados com `order` e paginados com `pagination`, usando os mesmos formatos do nível principal da chamada.

```typescript
const usuario = await userRepository.get(id, {
    relations: { posts: { comments: true }, address: true },
    relationsOptions: {
        posts: {
            where: { published: true },
            order: { createdAt: "desc" },
            pagination: { limit: 10 },
            relationsOptions: { comments: { pagination: { limit: 5 } } },
        },
    },
});
```

Cada chave de `relationsOptions` é um campo de relação da entidade, e as chaves aceitas dependem do tipo da relação:

| Relação                                                             | Chaves aceitas                                      |
| ------------------------------------------------------------------- | --------------------------------------------------- |
| To-many (`one-to-many`, `many-to-many`)                             | `where`, `order`, `pagination` e `relationsOptions` |
| To-one que pode ser `null`/`undefined` (`profile: Profile \| null`) | `where` e `relationsOptions`                        |
| To-one obrigatória (`author: User`)                                 | `relationsOptions`                                  |

- O `relationsOptions` aninhado tem o mesmo formato um nível abaixo, para as relações da relação (`posts.comments` no exemplo acima).
- `where` filtra os registros **carregados**, não os pais: `{ posts: { where: { published: true } } }` ainda retorna todos os usuários, cada um apenas com seus posts publicados. Para filtrar os usuários pelos seus posts, use os operadores `_some`/`_every`/`_none` no `where` principal (veja os [filtros por relações](./dynamic-methods.pt-BR.md#filtros-de-relação)). Os dois podem ser combinados.
- `pagination` vale **por registro pai**: `limit: 10` traz até 10 posts de cada usuário, não 10 posts no total.
- Funciona igual para relações carregadas via `relations` e via `select`.
- Ele só configura uma relação, não a carrega: uma entrada para uma relação que não está em `select`/`relations` não tem efeito.
- Ele não altera o tipo de retorno, já que só muda quais registros são carregados — `InferMethodReturn` e `InferMethodType` continuam olhando apenas para `select` e `relations`.
- É aceito por todo método que aceita `select`/`relations` (`MethodOptions` e `SimpleMethodOptions`), incluindo os [métodos dinâmicos](./dynamic-methods.pt-BR.md) e o [query builder](./query-builder.pt-BR.md) (`relationsOptions()`):

```typescript
const usuarios = await userRepository
    .createQueryBuilder()
    .relations({ posts: true })
    .relationsOptions({ posts: { order: { createdAt: "desc" }, pagination: { limit: 3 } } })
    .getResult();
```

## Tipagem de retorno restrita com `InferMethodReturn`

Por padrão, os métodos são tipados como se retornassem a **entidade inteira**, ignorando o `select` e o `relations` que você passa (a mesma abordagem do TypeORM). Se você prefere uma tipagem mais restrita, `InferMethodReturn<T, Options>` a estreita para o que foi realmente pedido. É opt-in e puramente em nível de tipos — nada muda em runtime.

```typescript
import type { InferMethodReturn, MethodOptions } from "vsrepo";

type Address = { id: string; city: string };
type Product = { id: string; name: string };
type User = {
    id: string;
    name: string;
    email: string;
    address: Address | null;
    products: Product[];
};

const options = {
    select: { id: true, name: true, products: { id: true } },
} satisfies MethodOptions<User>;

const users: InferMethodReturn<User[], typeof options> = await userRepository.find({}, options);
// { id: string; name: string; products: { id: string }[] }[]
```

- O **primeiro** argumento de tipo é o que o método retorna: `User`, `User | null` ou `User[]`. `null` e array são preservados — inclusive nos campos de relação (`address: Address | null`).
- O **segundo** é o objeto de options passado ao método (`typeof options`). Pode ser omitido, o que equivale a não passar options.

| Options passadas       | Resultado inferido                                                                                                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nenhuma (ou `{}`)      | Apenas os campos escalares da entidade — sem relações.                                                                                                                                                    |
| `relations`            | Os campos escalares mais as relações pedidas (inclusive as aninhadas); cada relação traz todos os seus campos escalares.                                                                                  |
| `select`               | Apenas os campos selecionados. Uma relação com `true` traz todos os seus campos escalares; um `select` aninhado a restringe ainda mais. Relações selecionadas assim são carregadas mesmo sem `relations`. |
| `select` + `relations` | `select` vence e `relations` é ignorado.                                                                                                                                                                  |

- `see`, `db` e `relationsOptions` não afetam o resultado.
- Mantenha os tipos literais das options, usando `satisfies MethodOptions<T>` (como acima) ou passando-as inline. Se estiverem tipadas como um `MethodOptions<T>` genérico (ex.: `const options: MethodOptions<User> = ...`), nada é conhecido em tempo de compilação e `T` é retornado sem alterações.
- Campos e relações opcionais (`?`) da entidade continuam opcionais.
- Para ter essa inferência direto nos métodos dinâmicos, veja [Tipagem de retorno restrita com `InferMethodType`](./dynamic-methods.pt-BR.md#tipagem-de-retorno-restrita-com-infermethodtype).

[⬆️ Voltar ao topo](#top)
