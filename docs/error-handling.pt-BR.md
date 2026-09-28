<a id="top"></a>

🇧🇷 Português | [🇺🇸 English](./error-handling.md)

[← Voltar para o Sumário](./README.pt-BR.md)

# Tratamento de erros

O modelo de erros é construído em torno de uma única classe base `VSRepoError` carregando um campo `type: VSRepoErrorType`, além de uma subclasse dedicada `VSRepoAdapterError` (veja abaixo) para falhas vindas do ORM/banco subjacente. (Se você está migrando da v1, isso está coberto em [Migrando da v1](./migrating-from-v1.pt-BR.md).)

```typescript
import { VSRepoError } from "vsrepo";

try {
    await userRepository.get(id);
} catch (error) {
    if (error instanceof VSRepoError) {
        console.error(`[${error.type}] ${error.message}`);
    }
}
```

| `VSRepoErrorType` | Quando é lançado                                                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `DECORATOR`       | Argumentos inválidos foram passados para `@DynamicMethod` ou `@QueryMethod`.                                                                   |
| `RESOLVER`        | A biblioteca falhou ao resolver a configuração de um método dinâmico/de query em um método chamável (ex.: um nome de método desconhecido).     |
| `DYNAMIC`         | Um dynamic/query method já resolvido falhou em tempo de execução (ex.: argumentos faltando).                                                   |
| `VALIDATOR`       | Options ou argumentos de método inválidos foram detectados durante a validação (ex.: `pkName` ausente quando o adapter não tem `getPkName()`). |
| `BASE`            | Uso inválido de um método base (`get`, `save`, `remove`, etc).                                                                                 |
| `ADAPTER`         | Um `VSRepoAdapter` falhou ao falar com o ORM/banco subjacente — sempre é lançado como `VSRepoAdapterError`.                                    |
| `QUERY_BUILDER`   | Um argumento inválido foi passado para um método do [query builder](./query-builder.pt-BR.md#validação-e-erros) (ex.: um `limit` negativo).    |

## `VSRepoAdapterError` e `AdapterErrorCode`

Quando um adapter fala com o ORM/banco subjacente e essa operação falha, o adapter encapsula a falha em um `VSRepoAdapterError` — uma subclasse de `VSRepoError` com `type: VSRepoErrorType.ADAPTER`. Ele carrega um `code: AdapterErrorCode` **estável e agnóstico de adapter** além do erro bruto lançado pelo ORM/driver, para que quem chama possa reagir às falhas sem depender do formato de erro de nenhum ORM específico:

```typescript
import { VSRepoAdapterError, AdapterErrorCode } from "vsrepo";

try {
    await userRepository.save({ name: "Maria" });
} catch (error) {
    if (error instanceof VSRepoAdapterError) {
        console.error(`[${error.code}] ${error.message}`, error.originalError);

        if (error.code === AdapterErrorCode.UNIQUE_CONSTRAINT_VIOLATION) {
            // tratar chave duplicada, ex.: retornar uma mensagem amigável
        }
    }
}
```

| Propriedade     | Tipo               | Descrição                                                                         |
| --------------- | ------------------ | --------------------------------------------------------------------------------- |
| `code`          | `AdapterErrorCode` | Código estável e agnóstico que classifica a falha.                                |
| `originalError` | `unknown`          | O erro bruto (ou `null`/`undefined`) lançado pelo driver do ORM/banco subjacente. |
| `message`       | `string`           | Descrição legível da falha do adapter.                                            |
| `type`          | `VSRepoErrorType`  | Sempre `VSRepoErrorType.ADAPTER`.                                                 |
| `cause`         | `unknown`          | Causa raiz opcional da qual o erro foi encadeado.                                 |

As implementações de adapter o constroem diretamente ao mapear uma falha do ORM:

```typescript
import { VSRepoAdapterError, AdapterErrorCode } from "vsrepo";

throw new VSRepoAdapterError(
    "falha ao criar o usuário",
    AdapterErrorCode.UNIQUE_CONSTRAINT_VIOLATION,
    originalError, // erro bruto do banco/driver
);
```

### `AdapterErrorCode`

`AdapterErrorCode` é um enum de códigos granulares e agnósticos que um adapter pode lançar através de `VSRepoAdapterError`. Eles espelham as falhas mais comuns lançadas por ORMs e drivers de banco, para que erros de qualquer ORM possam ser mapeados para o mesmo código estável:

```typescript
import { AdapterErrorCode } from "vsrepo";

console.log(AdapterErrorCode.UNIQUE_CONSTRAINT_VIOLATION); // "UNIQUE_CONSTRAINT_VIOLATION"
```

| Código                        | Significado                                                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `UNKNOWN`                     | Erro não classificado/desconhecido; o fallback quando nenhum código mais específico corresponde.                 |
| `TRANSACTION_ROLLED_BACK`     | Alguns adapters podem usar esse código para rollbacks forçados de transações (como o `tx.rollback()` do Drizzle) |
| `MISSING_DB_CLIENT`           | Cliente de banco (ou pool de conexões) não fornecido ou que não pôde ser resolvido.                              |
| `CONNECTION_FAILED`           | Não foi possível alcançar/conectar ao banco, ou uma conexão estabelecida foi perdida/terminada.                  |
| `CONNECTION_POOL_EXHAUSTED`   | Pool de conexões esgotado/depletado — nenhuma conexão disponível, todas ocupadas ou o limite foi atingido.       |
| `TIMEOUT`                     | O banco não respondeu a tempo; uma query excedeu o timeout permitido.                                            |
| `UNIQUE_CONSTRAINT_VIOLATION` | Violação de constraint unique (chave duplicada). Ex.: Postgres/SQLite `23505`, MySQL `1062`.                     |
| `FOREIGN_KEY_VIOLATION`       | Violação de constraint de foreign key (linha referenciada não existe).                                           |
| `NOT_NULL_VIOLATION`          | Violação de constraint NOT NULL.                                                                                 |
| `CHECK_VIOLATION`             | Violação de constraint CHECK.                                                                                    |
| `CONSTRAINT_VIOLATION`        | Violação geral de integridade/constraint não coberta por um código mais específico.                              |
| `NOT_FOUND`                   | Registro solicitado não encontrado (ex.: uma operação tipo `findOneOrThrow`).                                    |
| `INVALID_DATA`                | Valor de campo inválido para o tipo/tamanho, ou um valor obrigatório ausente.                                    |
| `VALUE_TOO_LONG`              | Valor fornecido excede o limite de tamanho da coluna/campo.                                                      |
| `CONVERSION_ERROR`            | Um valor não pôde ser convertido/convertido para o tipo alvo. Ex.: Postgres `22P02`, MySQL `1366`.               |
| `INVALID_QUERY`               | A query/stored procedure SQL está malformada ou é inválida.                                                      |
| `TABLE_OR_COLUMN_NOT_FOUND`   | A tabela/coluna/relação referenciada não existe.                                                                 |
| `DEADLOCK`                    | Operação abortada por timeout de lock ou deadlock entre transações concorrentes.                                 |
| `LOCK_TIMEOUT`                | Não foi possível adquirir um lock de banco obrigatório a tempo.                                                  |
| `LOCKED`                      | O registro está travado e não pode ser modificado.                                                               |
| `ACCESS_DENIED`               | O usuário/role atual não tem permissão para a operação.                                                          |
| `INVALID_CREDENTIALS`         | Credenciais de conexão inválidas (host/usuário/senha).                                                           |
| `ROW_NOT_ALLOWED`             | O usuário autenticado não é dono do registro / a segurança em nível de linha rejeitou.                           |
| `MODEL_NOT_FOUND`             | Entidade/modelo ou tabela não definida/mapeada no ORM, ou o adapter não tem os metadados do modelo.              |
| `FIELD_NOT_FOUND`             | Nome de campo/coluna nos dados ou no `where` não existe na entidade/modelo.                                      |
| `TRANSACTION_CLOSED`          | Transação usada depois de commit/rollback.                                                                       |
| `TRANSACTION_ALREADY_STARTED` | Uma transação aninhada não pôde ser aberta (ex.: chamadas `transaction()` aninhadas).                            |
| `TRANSACTION_CONFLICT`        | Uma transação falhou ao commitar e foi desfeita.                                                                 |
| `TRANSACTION_NOT_STARTED`     | Nenhuma transação ativa quando uma era obrigatória.                                                              |
| `CONNECTION_CLOSED`           | Conexão fechada/terminada enquanto uma transação ou query estava em andamento.                                   |
| `INVALID_PARTIAL`             | `merge`/`upsert`/`update` recebeu um objeto parcial inválido ou faltando chaves obrigatórias.                    |
| `NOT_SUPPORTED`               | Feature/operação não suportada solicitada ao adapter (ex.: `query()` bruto não suportado).                       |
| `INVALID_ADAPTER_CONFIG`      | Configuração do adapter inválida ou incompleta (options obrigatórias ausentes, ou com tipo/valor inválido).      |
| `INTERNAL`                    | Bug interno do adapter ou estado irrecuperável; deve raramente ser usado — prefira um código mais específico.    |

### `VSRepoError` vs. erros brutos do ORM

Erros de uso/configuração fora do adapter lançam o `VSRepoError` base. Falhas lançadas _pelo ORM subjacente_ enquanto um método do adapter roda são **encapsuladas** em `VSRepoAdapterError` (classificadas por um `AdapterErrorCode`, com o erro original preservado em `originalError`) em vez de se propagarem cruas — é isso que torna quem chama independente do formato de erro de qualquer ORM específico.

[⬆️ Voltar ao topo](#top)
