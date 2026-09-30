<div align="center">
  <img src="https://res.cloudinary.com/ddbfifdxd/image/upload/w_200,q_auto,f_auto/v1786386427/VS_logo_TextoAbaixo_yev4tq.png" alt="VSRepository Logo" width="200"/>

  <p style="margin-top: 12px;">
    <img src="https://img.shields.io/npm/v/vsrepo?style=flat-square" alt="npm version"/>
    <img src="https://img.shields.io/npm/l/vsrepo?style=flat-square" alt="npm license"/>
    <img src="https://img.shields.io/npm/dt/vsrepo?style=flat-square" alt="npm downloads"/>
    <img src="https://img.shields.io/badge/inspired%20by-Spring%20Data%20JPA-E6DB33F?style=flat-square" alt="inspired by Spring Data JPA"/>
  </p>
</div>

# VSRepository

🇧🇷 Você está lendo a versão em português. [🇺🇸 Read in English](./README.md)

O VSRepository é uma **biblioteca de repository pattern agnóstica de ORM para TypeScript**. Inspirada no **Spring Data JPA**, ela fornece uma camada de abstração consistente, com suporte a **métodos de consulta derivados**, **query builders**, **soft-delete nativo** e outros recursos. Tudo isso por meio de **adapters**, permitindo que o VSRepository seja utilizado com diferentes ORMs.

O VSRepository permite criar repositories fortemente tipados com:

- **Métodos base** automáticos: `get`, `getOrThrow`, `getList`, `save`, `saveList`, `remove`, `removeList`, `patch`, `merge`, `getAll`, `total`, `has`
- **Soft-delete nativo**: `softRemove`, `softRemoveList`, `restore`, `restoreList`
- **Métodos dinâmicos** inferidos a partir do nome de um campo `declare` via o decorador `@DynamicMethod`: `findOneByEmail`, `findByStatusPaginated`, `updateById`
- **Métodos de query SQL raw** através do decorador `@QueryMethod` (ignorando totalmente o engine de parsing por nome), fragmentos parametrizados `VSSql` para chamadas pontuais de `query()`, e placeholders agnósticos `?1`, `?2` com `vsPlaceholders`
- **`select`/`relations`** ad-hoc em cada chamada
- Tipagem forte com **TypeScript** em toda a API do repositório
- **Transações** nativas do ORM, compartilhadas entre repositories
- Um **núcleo agnóstico de ORM** — a mesma classe de repository funciona com qualquer implementação de `VSRepoAdapter`

---

## Instalação

O VSRepository é instalado como o pacote core mais um pacote de adapter para o seu ORM, por exemplo:

```bash
npm i vsrepo @vsrepo/prisma7-adapter
```

---

## Uso básico

### Criando um repository

```typescript
// src/repositories/user.repository.ts
import { VSRepository, DynamicMethod } from "vsrepo";
import { Prisma7Adapter } from "@vsrepo/prisma7-adapter";
import prisma from "../configs/db";
import type { UserGetPayload } from "../../generated/prisma/models";

type User = UserGetPayload<{ include: { address: true } }>;

class UserRepository extends VSRepository<User, string> {
    constructor() {
        super({
            adapter: new Prisma7Adapter(prisma, { tableName: "user", pkName: "id" }),
            softRemoveKey: "deletedAt",
            defaultOrdering: { createdAt: "desc" },
        });
    }

    @DynamicMethod()
    declare findByEmail: (email: string) => Promise<User[]>;

    @DynamicMethod()
    declare findOneByEmail: (email: string) => Promise<User | null>;
}

export default new UserRepository();
```

> A API do core (`VSRepository`, `VSRepoAdapter`, `DynamicMethod`, `QueryMethod`, `VSRepoError`, enums e tipos) é importada do entry point único `vsrepo`. O adapter concreto vem de um pacote **separado** (`@vsrepo/*-adapter`). No Prisma 7, instale o [`@vsrepo/prisma7-adapter`](https://github.com/jaobrabo123/VSRepoPrisma7Adapter).

### Usando o repository

```typescript
import userRepository from "./repositories/user.repository";

const usuario = await userRepository.save({
    name: "Joao",
    email: "joao@email.com",
    password: "password",
});

const encontrado = await userRepository.get(usuario.id);
const todos = await userRepository.getAll();
const porEmail = await userRepository.findByEmail("joao@email.com");

await userRepository.patch(usuario.id, { name: "Joao Pedro" });
await userRepository.remove(usuario.id);
```

---

## Documentação

As seções acima (instalação, uso básico) são o essencial para começar. Tudo sobre uma funcionalidade específica — com mais detalhe e mais exemplos — vive em um guia próprio dentro de [`docs/`](./docs/README.pt-BR.md), cada um disponível em português e em [English](./docs/README.md):

### Guias

| Guia                                                                     | Cobre                                                                                                                                                                                   |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Status dos adapters](./docs/adapters.pt-BR.md)                          | Quais adapters de ORM existem hoje, o que "agnóstico de ORM por design" significa na prática, e como instalar, escrever ou publicar o seu.                                              |
| [Métodos base, configuração & soft-delete](./docs/base-methods.pt-BR.md) | Options do construtor, os 12 métodos CRUD automáticos, soft-delete nativo, e os 8 métodos atômicos/de agregação (`increment`, `sum`, ...).                                              |
| [`select` e `relations`](./docs/select-and-relations.pt-BR.md)           | Seleção de campos e carregamento de relações ad-hoc em qualquer chamada, e o `InferMethodReturn` para estreitar o tipo de retorno de acordo.                                            |
| [Métodos dinâmicos](./docs/dynamic-methods.pt-BR.md)                     | Métodos no estilo `findByEmail`, resolvidos a partir de um nome de método `declare`d: prefixos, filtros de campo, operadores lógicos, filtros de relação, ordenação/paginação/distinct. |
| [Query methods (SQL raw)](./docs/query-methods.pt-BR.md)                 | SQL raw via `@QueryMethod`, fragmentos parametrizados `VSSql` e os placeholders agnósticos `?1`/`?2` (`vsPlaceholders`).                                                                |
| [Query builder](./docs/query-builder.pt-BR.md)                           | A API fluente `createQueryBuilder()` para queries montadas em tempo de execução, incluindo paginação, visibilidade de soft-delete e transações.                                         |
| [Raw query builder](./docs/raw-query-builder.pt-BR.md)                   | A API fluente `createRawQueryBuilder()` para queries `SELECT` escritas à mão, específicas demais para o query builder — joins, subqueries, CTEs (`with`/`withRecursive`).               |
| [Transações](./docs/transactions.pt-BR.md)                               | Rodando vários repositories na mesma transação nativa do ORM.                                                                                                                           |
| [Tipos utilitários](./docs/utility-types.pt-BR.md)                       | Os tipos utilitários exportados (`InferMethodType`, `InferMethodReturn`, `KeysOfType`, ...) e onde cada um é usado.                                                                     |
| [Escrevendo seu próprio adapter](./docs/writing-an-adapter.pt-BR.md)     | Do que um adapter é responsável, e como implementar o contrato `VSRepoAdapter` para um novo ORM ou banco.                                                                               |
| [Tratamento de erros](./docs/error-handling.pt-BR.md)                    | `VSRepoError`, `VSRepoErrorType`, e `VSRepoAdapterError`/`AdapterErrorCode`.                                                                                                            |
| [Logging](./docs/logging.pt-BR.md)                                       | `logLevel`, `logSlowThresholdMs`, e o formato de log usado pelo repository e pelo query builder.                                                                                        |
| [Contribuindo](./CONTRIBUTING.pt-BR.md)                                  | Estrutura do repositório, os principais scripts, convenções e CI — mais o próprio fluxo de contribuição (issues, pull requests, revisão).                                               |
| [Migrando da v1](./docs/migrating-from-v1.pt-BR.md)                      | Tudo o que mudou entre a v1 e a v2 — API, config, sufixos renomeados, funcionalidades removidas — em uma única referência para migrar repositories existentes.                          |

---

## Status dos adapters

O VSRepository é **agnóstico de ORM por design**: o pacote core (`vsrepo`) traz apenas a classe de repository, os decoradores, o engine de parsing de nomes, o tratamento de erros e o logging — nenhum adapter de produção. O suporte a ORM vive em pacotes `@vsrepo/*-adapter` separados e versionados de forma independente, então cada um pode acompanhar o ciclo de releases do seu próprio ORM.

| Adapter                               | Status                                                                                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma 7 (`@vsrepo/prisma7-adapter`)  | 🟢 **Lançado** — publicado no npm, com testes. [Código e docs](https://github.com/jaobrabo123/VSRepoPrisma7Adapter).                              |
| Drizzle (`@vsrepo/drizzle-adapter`)   | 🔵 **Alpha** — `npm i @vsrepo/drizzle-adapter@alpha`. A API ainda pode mudar. [Repositório](https://github.com/jaobrabo123/VSRepoDrizzleAdapter). |
| Outros ORMs (Prisma 8, TypeORM, etc.) | 🟡 **Planejados, ainda não publicados.** Escreva o seu enquanto isso — é totalmente suportado.                                                    |
| Adapters customizados                 | 🟢 Totalmente suportados — implemente o `VSRepoAdapter` você mesmo, no seu projeto ou pacote.                                                     |

O status completo e como instalar cada um: [Status dos adapters](./docs/adapters.pt-BR.md). Para publicar o seu, veja [Publicando o seu próprio adapter](./docs/writing-an-adapter.pt-BR.md#publicando-o-seu-próprio-adapter).

---

## Requisitos

- Node.js 22+
- TypeScript, com **decorators legacy/experimentais** habilitados (necessário para `@DynamicMethod`/`@QueryMethod`):

```json
{
    "compilerOptions": {
        "experimentalDecorators": true
    }
}
```

- `reflect-metadata` (já incluso como dependência, importado internamente — você não precisa importá-lo você mesmo)
- Pelo menos um `VSRepoAdapter` funcional para o seu banco — no Prisma 7, instale o [`@vsrepo/prisma7-adapter`](https://github.com/jaobrabo123/VSRepoPrisma7Adapter) já publicado (veja [Status dos adapters](#status-dos-adapters))

---

## Contribuindo

Contribuições são bem-vindas — adapters, reports de bug e documentação. O core é agnóstico de ORM, então trabalho específico de ORM pertence ao seu próprio pacote de adapter; veja as regras de escopo antes de abrir um PR.

- **[CONTRIBUTING.pt-BR.md](./CONTRIBUTING.pt-BR.md)** — como reportar um bug, pedir uma feature e enviar um pull request.
