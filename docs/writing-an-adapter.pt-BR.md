<a id="top"></a>

🇧🇷 Português | [🇺🇸 English](./writing-an-adapter.md)

[← Voltar para o Sumário](./README.pt-BR.md)

# Escrevendo seu próprio adapter

Como o núcleo é agnóstico de ORM e é distribuído sem um adapter embutido, adicionar suporte a um ORM/banco — seja como solução provisória para o seu próprio projeto, seja como candidato a um futuro pacote `@vsrepo/*-adapter` — significa implementar a classe abstrata `VSRepoAdapter<T>`.

## O que você vai implementar

Antes do contrato em si, vale deixar claro **o que um adapter realmente faz**: o escopo dele é bem delimitado, mas isso não significa que o trabalho seja pequeno — dependendo do ORM, escrever um adapter completo pode dar bastante trabalho.

O `VSRepository` é dono de toda a abstração. Dado uma chamada como `userRepository.get("user-1", { relations: { address: true } })`, o repository:

- resolve a primary key em um `VSRepoWhere<T>` (`{ id: "user-1" }`),
- junta o filtro de soft-delete implícito por `softRemoveKey`/`see`,
- valida as options,
- loga a operação e mede o tempo,
- e então chama **exatamente um** método no seu adapter, com o `where` e as options já resolvidos.

Tudo acima é agnóstico de ORM e compartilhado por todos os adapters. O que fica com você é o último passo — e é nele que está a maior parte do esforço: transformar um `VSRepoWhere<T>` mais um `AdapterMethodOptions<T>` em uma leitura ou escrita real contra o seu banco, e transformar o resultado de volta em um `T`. O seu adapter é o **único** código da stack que sabe que o seu ORM existe.

Os tipos que você vai encontrar pelo contrato estão todos documentados em [Tipos utilitários](./utility-types.pt-BR.md):

| Tipo                      | Papel no contrato                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `VSRepoWhere<T>`          | O filtro já resolvido. Deve ser convertido para o equivalente do ORM do seu Adapter.                                           |
| `AdapterMethodOptions<T>` | As options da chamada: `select`, `relations`, `see` e o handle da transação.                                                   |
| `DeepPartial<T>`          | Uma entidade parcial para escritas — uma `DeepPartial` aninhada de uma relação é uma parcial aninhada, não um objeto completo. |
| `CountResult`             | O que `createMany`/`deleteMany`/`updateMany` resolvem quando quem chama só quer `{ count }`.                                   |
| `NumericKeys<T>`          | Restringe o argumento `field` dos métodos atômicos/de agregação a colunas numéricas (ou `DecimalLike`).                        |

## O contrato `VSRepoAdapter`

O contrato é a classe abstrata `VSRepoAdapter<T>`. Todos os métodos abaixo são `abstract`, exceto os dois opcionais no final. Esta é a visão geral — as assinaturas exatas e o JSDoc de cada método ficam em [`src/VSRepoAdapter.ts`](https://github.com/jaobrabo123/VSRepository/blob/main/src/VSRepoAdapter.ts), que é a fonte de verdade do contrato:

| Grupo                      | Métodos                                                                                      | Papel                                                                                                                            |
| -------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Infraestrutura             | `runInTransaction`, `getDbClient`, `query`                                                   | Transação nativa do ORM, acesso ao client do ORM e execução de SQL raw (usado por `query()`/`@QueryMethod`).                     |
| Leitura                    | `findOne`, `findOneOrThrow`, `findMany`, `count`, `exists`                                   | Recebem um `VSRepoWhere<T>` e `AdapterMethodOptions<T>` já resolvidos. `findMany` também aceita `distinct`.                      |
| Escrita                    | `save`, `saveMany`, `create`, `createMany`, `createManyReturning`, `upsert`, `merge`         | Criação, upsert e merge em memória. `createMany`/`createManyReturning` aceitam `ignoreConflicts`; `merge` **não** persiste nada. |
| Atualização e remoção      | `update`, `updateMany`, `updateManyReturning`, `delete`, `deleteMany`, `deleteManyReturning` | Versões que retornam a entidade, uma lista ou só `{ count }` (`CountResult`).                                                    |
| Atômicos                   | `incrementOne`, `decrementOne`, `multiplyOne`, `divideOne`                                   | Update aritmético avaliado no servidor contra o valor atual da linha, restrito a `NumericKeys<T>`.                               |
| Agregações                 | `sum`, `average`, `min`, `max`                                                               | Retornam `number \| null` — `null` quando nenhum registro bate no filtro.                                                        |
| Opcionais (não `abstract`) | `getPkName?()`, `getPlaceholder?(index)`                                                     | Veja abaixo.                                                                                                                     |

O `getPkName()` opcional permite que o adapter declare ao repository qual campo é a primary key da entidade. Ao instanciar um `VSRepository`, você pode omitir o `pkName` das options do construtor e ele será lido do `adapter.getPkName()`. Se você omitir e o adapter não implementar o `getPkName()`, o construtor lança um `VSRepoError`.

O `getPlaceholder?(index)` opcional declara a sintaxe de placeholder que seu banco/driver espera para o N-ésimo (base 0) parâmetro ligado numa query raw — ex.: PostgreSQL retorna `` `$${index + 1}` `` (`$1`, `$2`, ...), enquanto SQLite/MySQL ignoram `index` e sempre retornam `"?"`. Implementá-lo é o que libera os recursos de query parametrizada: `query()` passa a aceitar um fragmento `VSSql`, e `vsPlaceholders: true` compila os placeholders `?1`, `?2`, ... do próprio VSRepository — ambos através do `getPlaceholder()`. Sem ele, passar um fragmento `VSSql` ou ligar `vsPlaceholders` lança um `VSRepoError`. Veja [Query methods](./query-methods.pt-BR.md#fragmentos-parametrizados-com-vssql).

O `VSRepository` nunca fala diretamente com o ORM — ele só chama esses métodos com um `VSRepoWhere<T>` e um `AdapterMethodOptions<T>` já resolvidos. Uma vez que um adapter implemente esse contrato, todo método base, método dinâmico e query method passa a funcionar com ele automaticamente — mas chegar a uma implementação correta e completa exige traduzir com cuidado o comportamento de cada método para o ORM.

Duas regras cobrem os corpos dos métodos:

- **Não reconstrua o filtro — mas traduza.** O `where` já está resolvido, validado e já carrega o filtro de soft-delete. Traduzir a _forma_ dele para o vocabulário do seu ORM é seu trabalho, e é o assunto da próxima seção.
- **Encapsule todo erro do ORM — nunca deixe ele escapar cru.** Qualquer erro lançado pelo ORM/driver precisa ser capturado e relançado como um `VSRepoAdapterError`, com o erro bruto mantido em `originalError` e a falha classificada por um `AdapterErrorCode` (veja [`VSRepoAdapterError` e `AdapterErrorCode`](./error-handling.pt-BR.md#vsrepoadaptererror-e-adaptererrorcode)). Engoli-lo, ou deixar a classe de erro do próprio ORM chegar a quem chama, quebra a garantia de que quem chama nunca depende do formato de erro de um ORM específico:

    ```typescript
    import { VSRepoAdapterError, AdapterErrorCode } from "vsrepo";

    try {
        return await this.orm.user.create({ data: obj });
    } catch (err) {
        throw new VSRepoAdapterError(
            "adapter create falhou",
            mapOrmError(err), // o erro do próprio ORM → um AdapterErrorCode estável
            err, // o erro original, preservado em `originalError`
        );
    }
    ```

Pra uma implementação completa e funcional, veja o repositório externo [`VSRepoPrisma7Adapter`](https://github.com/jaobrabo123/VSRepoPrisma7Adapter).

## Persistência de relações depende do adapter

O core não sabe persistir relações: um `save`/`create`/`update`/`upsert` com um campo de relação no payload (por exemplo, `{ name: "Ana", address: { city: "Recife" } }`) chega ao adapter exatamente assim, e é o adapter quem decide como transformar isso em escritas no ORM — `create`/`connectOrCreate`/`disconnect` aninhados no Prisma, inserts e updates feitos imperativamente no Drizzle, e assim por diante.

Adapters como o [`VSRepoPrisma7Adapter`](https://github.com/jaobrabo123/VSRepoPrisma7Adapter) e o [`VSRepoDrizzleAdapter`](https://github.com/jaobrabo123/VSRepoDrizzleAdapter) fazem isso por meio de uma configuração de `relations` no construtor, que descreve para cada campo de relação a cardinalidade (`oto`/`otm`/`mto`/`mtm`), como tratar itens já existentes e ausentes do payload (`restriction`), se a relação aceita `null` (`nullable`) e as colunas de chave estrangeira envolvidas. Note que essa configuração de _escrita_ é diferente do `relations` passado nas options de um método, que apenas controla o carregamento na leitura (veja [`select` e `relations`](./select-and-relations.pt-BR.md)).

É de grande importância que o seu adapter implemente algo parecido: sem isso, quem usa o adapter precisa persistir cada relação manualmente, item por item, e perde boa parte do ganho do `VSRepository`. Isso **não é obrigatório** — um adapter que repassa o payload ao ORM sem tratar relações continua cumprindo o contrato — mas, se você escolher não implementar, deixe isso explícito na documentação do adapter.

## Traduzindo os argumentos genéricos para o seu ORM

`VSRepoWhere<T>`, por exemplo, é um filtro **genérico e agnóstico de ORM** — não é a sintaxe de query de nenhum ORM específico. O repository o resolve para você; transformá-lo em algo que o seu ORM entenda é tarefa do adapter.

Pegue `{ name: { equals: "Ana", contains: "an", ignoreCase: true }, age: { between: [18, 65] } }`:

```typescript
// Prisma 7 — `equals` sobrevive, `between` se expande, `ignoreCase` vira um mode
{ name: { equals: "Ana", contains: "an", mode: "insensitive" }, age: { gte: 18, lte: 65 } }

// Drizzle — `equals` vira `eq`, o filtro de string vira um `ilike` com wildcard
{ name: { eq: "Ana", ilike: "%an%" }, age: { gte: 18, lte: 65 } }
```

Mesma entrada, duas saídas diferentes, e nenhuma das duas é pass-through: `between: [min, max]` precisa virar `gte: min, lte: max` nos dois, e `equals` só mantém o nome no Prisma. Operadores que já batem com as chaves do seu ORM (`gt`, `gte`, `lt`, `lte`, `in`, `notIn`) _podem_ ser repassados intactos — os que não batem precisam ser reescritos.

## Logging a partir do seu adapter

O `vsrepo` exporta a mesma classe `VSLogger` usada internamente pelo core, então seu adapter pode logar no mesmo formato/estilo (timestamps, labels de nível coloridos, avisos de operação lenta) em vez de implementar o seu próprio:

```typescript
import { VSLogger, VSLogLevel, VSRepoAdapterError, AdapterErrorCode } from "vsrepo";

export class MyOrmAdapter<T> extends VSRepoAdapter<T> {
    private readonly logger = new VSLogger(VSLogLevel.WARN, "MyOrmAdapterLogger");

    async findOne(where: VSRepoWhere<T>, options?: AdapterMethodOptions<T>) {
        const start = this.logger.startPerformLog("adapter findOne");
        try {
            // ... fala com o ORM ...
            this.logger.endPerformLog(start);
            return result;
        } catch (err) {
            this.logger.endPerformLog(start);
            this.logger.logError("adapter findOne falhou", err);
            throw new VSRepoAdapterError("adapter findOne falhou", AdapterErrorCode.UNKNOWN, err);
        }
    }
}
```

O logger apenas observa a falha; o `VSRepoAdapterError` é o que quem chama realmente recebe, que é o encapsulamento que a regra acima exige.

| Método                                               | Descrição                                                                                                                                                                                                                                                  |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `new VSLogger(logLevel, name, slowThresholdMs?)`     | Cria um logger; `name` prefixa cada linha. `slowThresholdMs` controla o threshold de operação lenta: um `number` define o valor em ms (padrão 300), `false` desabilita os avisos de operação lenta completamente, `true` ou omitido usa o padrão de 300ms. |
| `logDebug/logInfo/logWarn(text, obj?)`               | Loga no nível dado se `logLevel` permitir; `obj` é anexado como JSON formatado.                                                                                                                                                                            |
| `logError(text, err?)`                               | Loga em `ERROR`; se `err` for uma `Error`, só `name`/`message`/`stack`/`cause` são logados.                                                                                                                                                                |
| `startPerformLog(operation)` / `endPerformLog(data)` | Envolve um trecho de código para logar sua duração, escalando pra `WARN` se ultrapassar `slowThresholdMs`.                                                                                                                                                 |
| `getLogLevel()`                                      | Retorna o `VSLogLevel` configurado do logger.                                                                                                                                                                                                              |

Isso é puramente uma conveniência para autores de adapters — nada no core exige que seu adapter o utilize.

## Publicando um adapter

Um adapter não mora neste repositório, e não precisa ser oficial para ser útil. Existem dois caminhos, e eles são genuinamente diferentes: **publicar o seu** está inteiramente sob o seu controle, enquanto **tornar-se um `@vsrepo/*-adapter` oficial** é um processo com gate e uma régua de validação.

### Publicando o seu próprio adapter

Publicar o seu próprio adapter está inteiramente sob o seu controle: escolha o nome e o escopo, hospede onde quiser e lance no seu próprio ritmo.

Esse caminho nunca fecha. Se o adapter se provar depois, você pode pedir que ele seja revisado e promovido a um `@vsrepo/*-adapter` oficial — que é exatamente o que a próxima subseção cobre.

### Tornando-se um adapter oficial

Um adapter oficial é publicado sob o escopo `@vsrepo` no npm, que o projeto controla. Publicar nesse escopo passa pelo _staged publishing_ do npm, então o seu repositório precisa de um workflow que consiga publicar:

- um environment `npm-publish`, que é onde o acesso é concedido e revisado;
- `npm stage publish --tag <dist-tag>`, que faz o stage do release em vez de publicar direto no `latest`; o workflow deriva a dist-tag da tag git (`v1.2.0` → `latest`, `v1.2.0-beta.1` → `beta`).

É o mesmo pipeline que o core usa — veja [`.github/workflows/publish.yml`](https://github.com/jaobrabo123/VSRepository/blob/main/.github/workflows/publish.yml). O acesso é concedido uma vez que o checklist abaixo passa.

| Requisito              | O que significa                                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contrato completo      | Todos os métodos abstratos de `VSRepoAdapter`, incluindo as 8 operações atômicas/de agregação (`incrementOne`, `decrementOne`, `multiplyOne`, `divideOne`, `sum`, `average`, `min`, `max`). |
| Testes de contrato     | Um client falso mais uma suíte que verifica _quais_ métodos do adapter o repository chama e _com quais argumentos_.                                                                         |
| Testes de integração   | **Testes contra um banco real**, exercitando o SQL que o seu adapter realmente gera.                                                                                                        |
| `getPlaceholder()`     | Implementado, senão `query()`, fragmentos `VSSql` e `vsPlaceholders` não funcionam.                                                                                                         |
| Peer dependencies      | O ORM e o core `vsrepo` declarados como `peerDependencies`.                                                                                                                                 |
| Repositório próprio    | No seu próprio repositório, versionado e released de forma independente do core.                                                                                                            |
| Dist-tag de maturidade | `latest` quando o adapter estiver pronto para produção; `alpha`/`beta` enquanto não estiver. Nunca publique trabalho em andamento como `latest`.                                            |
| Registro               | Um PR adicionando uma linha na tabela oficial em [Status dos adapters](./adapters.pt-BR.md#status-dos-adapters).                                                                            |

Para solicitar, abra uma issue com o link do seu repositório e uma nota curta sobre quais versões de ORM você suporta.

Se você quer contribuir **diretamente** com um novo adapter oficial — em vez de manter o seu próprio adapter e pedir a promoção depois — entre em contato pelo e-mail [joaodev.azevedo@outlook.com](mailto:joaodev.azevedo@outlook.com).

[⬆️ Voltar ao topo](#top)
