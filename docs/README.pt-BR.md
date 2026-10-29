# Documentação

🇧🇷 Português | [🇺🇸 English](./README.md)

[← Voltar para o README principal](../README.pt-BR.md)

Guias detalhados para cada funcionalidade do VSRepository. Para o quickstart e status dos adapters, veja o [README principal](../README.pt-BR.md). Atualizando? O checklist v2 → v3 está em [Migrando da v2 para a v3](./migrating-from-v2-to-v3.pt-BR.md); vindo da v1, veja antes [Migrando da v1 para a v2](./migrating-from-v1-to-v2.pt-BR.md).

| Guia                                                                | Cobre                                                                                                                                                                            |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Status dos adapters](./adapters.pt-BR.md)                          | Quais adapters de ORM existem hoje e o que "agnóstico de ORM por design" significa na prática.                                                                                   |
| [Métodos base, configuração & soft-delete](./base-methods.pt-BR.md) | Options do construtor, configuração global, os métodos CRUD automáticos, soft-delete nativo (`@EnableSoftDelete`), e os métodos atômicos/de agregação (`increment`, `sum`, ...). |
| [`select` e `relations`](./select-and-relations.pt-BR.md)           | Seleção de campos e carregamento de relações ad-hoc em qualquer chamada, e o `InferMethodReturn` para estreitar o tipo de retorno de acordo.                                     |
| [Métodos dinâmicos](./dynamic-methods.pt-BR.md)                     | Métodos no estilo `findByEmail`, resolvidos a partir de um nome de método `declare`d: prefixos, filtros de campo, operadores lógicos, filtros de relação, ordenação/paginação.   |
| [Query methods (SQL raw)](./query-methods.pt-BR.md)                 | SQL raw via `@QueryMethod`, fragmentos parametrizados `VSSql` e os placeholders agnósticos `?1`/`?2` (`vsPlaceholders`).                                                         |
| [Query builder](./query-builder.pt-BR.md)                           | A API fluente `createQueryBuilder()` para queries montadas em tempo de execução, incluindo paginação, visibilidade de soft-delete e transações.                                  |
| [Raw query builder](./raw-query-builder.pt-BR.md)                   | A API fluente `createRawQueryBuilder()` para queries `SELECT` escritas à mão, específicas demais para o query builder — joins, subqueries, CTEs (`with`/`withRecursive`).        |
| [Transações](./transactions.pt-BR.md)                               | Rodando vários repositories na mesma transação nativa do ORM.                                                                                                                    |
| [Tipos utilitários](./utility-types.pt-BR.md)                       | Os tipos utilitários exportados (`InferMethodType`, `InferMethodReturn`, `KeysOfType`, ...) e onde cada um é usado.                                                              |
| [Escrevendo seu próprio adapter](./writing-an-adapter.pt-BR.md)     | Do que um adapter é responsável, como implementar o contrato `VSRepoAdapter` para um novo ORM ou banco, e como publicá-lo.                                                       |
| [Tratamento de erros](./error-handling.pt-BR.md)                    | `VSRepoError`, `VSRepoErrorType`, e `VSRepoAdapterError`/`AdapterErrorCode`.                                                                                                     |
| [Logging](./logging.pt-BR.md)                                       | `logLevel`, e o formato de log usado pelo repository e pelo query builder.                                                                                                       |
| [Migrando da v2 para a v3](./migrating-from-v2-to-v3.pt-BR.md)      | Tudo o que mudou entre a v2 e a v3 — métodos base, soft-delete, métodos dinâmicos, query methods, adapters e requisitos — como um checklist passo a passo.                       |
| [Migrando da v1 para a v2](./migrating-from-v1-to-v2.pt-BR.md)      | Tudo o que mudou entre a v1 e a v2 — API, config, sufixos renomeados, funcionalidades removidas — e um passo a passo de migração.                                                |
