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
- Se `select` e `relations` podem ser combinados depende do adapter (veja abaixo).

> **Como difere da v1:** as projeções eram nomeadas e reutilizáveis (`selectModels`/`defaultSelectModel`). Isso não existe mais — cada chamada passa seu próprio `select`/`relations`. Veja [Migrando da v1](./migrating-from-v1.pt-BR.md) para o detalhamento completo.

> ⚠️ **Comportamento de `relations` depende do adapter:**
>
> O core apenas repassa `MethodOptions.select` e `MethodOptions.relations` ao adapter — cada adapter decide como traduzi-los para o ORM subjacente:
>
> - **Prisma 7 (`@vsrepo/prisma7-adapter` / `VSRepoPrisma7Adapter`)** — `relations` é convertido para `include` do Prisma (`parsePrismaInclude`). **Se `select` estiver presente, `relations` é ignorado** porque o Prisma não permite `select` + `include` na mesma query:
>     ```typescript
>     // Prisma7: relations é ignorado quando select existe
>     await userRepository.get(id, {
>         select: { id: true, name: true },
>         relations: { address: true }, // ← ignorado, include = undefined
>     });
>     ```
>
> Adapters customizados podem mapear `relations` de forma diferente — consulte a documentação do adapter para a semântica exata.

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

const users: InferMethodReturn<User[], typeof options> = await userRepository.getAll(options);
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

- `see` e `db` não afetam o resultado.
- Mantenha os tipos literais das options, usando `satisfies MethodOptions<T>` (como acima) ou passando-as inline. Se estiverem tipadas como um `MethodOptions<T>` genérico (ex.: `const options: MethodOptions<User> = ...`), nada é conhecido em tempo de compilação e `T` é retornado sem alterações.
- Campos e relações opcionais (`?`) da entidade continuam opcionais.
- Para ter essa inferência direto nos métodos dinâmicos, veja [Tipagem de retorno restrita com `InferMethodType`](./dynamic-methods.pt-BR.md#tipagem-de-retorno-restrita-com-infermethodtype).

[⬆️ Voltar ao topo](#top)
