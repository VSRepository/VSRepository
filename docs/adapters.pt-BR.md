<a id="top"></a>

🇧🇷 Português | [🇺🇸 English](./adapters.md)

[← Voltar para o Sumário](./README.pt-BR.md)

# Status dos adapters

O VSRepository é **agnóstico de ORM por design**. O pacote core (`vsrepo`) traz apenas a classe de repository, os decoradores, o engine de parsing de nomes, o tratamento de erros e o logging — ele **não** inclui um adapter de produção. O suporte de fato a cada ORM/banco deve viver em **pacotes separados, versionados de forma independente**, um por ORM (e, quando fizer sentido, um por versão principal do ORM), por exemplo:

- `@vsrepo/prisma7-adapter`
- `@vsrepo/prisma8-adapter`
- `@vsrepo/typeorm-adapter`
- `@vsrepo/drizzle-adapter`

Como cada adapter é versionado por conta própria, ele pode acompanhar o ciclo de releases do seu ORM sem forçar uma nova major no core, e uma breaking change em um ORM nunca vaza para repositories construídos para outro.

| Adapter                               | Status                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma 7 (`@vsrepo/prisma7-adapter`)  | 🟢 **Lançado** — publicado no npm, implementa o contrato de `VSRepoAdapter` (CRUD, relations, transactions, `merge`, logging, etc.) com testes; veja o [`VSRepoPrisma7Adapter`](https://github.com/jaobrabo123/VSRepoPrisma7Adapter) para o código-fonte e docs.                                                                                  |
| Drizzle (`@vsrepo/drizzle-adapter`)   | 🔵 **Alpha** — uma versão inicial já está disponível no npm; instale com `npm i @vsrepo/drizzle-adapter@alpha`. A API ainda pode mudar antes do release estável. Veja o repositório do [`DrizzleAdapter`](https://github.com/jaobrabo123/VSRepoDrizzleAdapter) para o estado atual e limitações conhecidas, e sinta-se à vontade para contribuir. |
| Outros ORMs (Prisma 8, TypeORM, etc.) | 🟡 **Planejados, ainda não publicados.** Nenhum pacote oficial existe ainda — por enquanto, escreva o seu próprio adapter (veja [Escrevendo seu próprio adapter](#escrevendo-seu-próprio-adapter)) e considere publicá-lo/contribuir de volta com o projeto.                                                                                      |
| Adapters customizados                 | 🟢 Totalmente suportados hoje — implemente você mesmo a classe abstrata [`VSRepoAdapter`](./writing-an-adapter.pt-BR.md#o-contrato-vsrepoadapter) para qualquer ORM/banco que precisar, no seu próprio projeto ou pacote.                                                                                                                         |

## Instalando um adapter

Um adapter é um pacote npm comum. Instale o core mais o que corresponde ao seu ORM:

```bash
npm i vsrepo @vsrepo/prisma7-adapter
```

Adapters em prerelease são instalados por dist-tag, então o seu lockfile fixa o build alpha em vez de resolver para `latest` mais tarde:

```bash
npm i @vsrepo/drizzle-adapter@alpha
```

## Escrevendo seu próprio adapter

Você nunca precisa esperar por um pacote oficial: `VSRepoAdapter` é uma classe abstrata comum, e implementá-la é o ponto de extensão oficialmente suportado.

- **[Escrevendo seu próprio adapter](./writing-an-adapter.pt-BR.md)** — o passo a passo completo: o que você vai implementar, o contrato `VSRepoAdapter` inteiro método a método, os hooks opcionais `getPkName()`/`getPlaceholder()`, e como logar a partir do seu adapter no mesmo formato do core.
- **[Métodos base, configuração & soft-delete](./base-methods.pt-BR.md#escrevendo-um-adapter)** — como as 8 operações atômicas/de agregação devem se comportar no seu ORM, e o que um adapter precisa retornar para elas.
- **[Transações](./transactions.pt-BR.md)** — o que `runInTransaction()` precisa devolver para `transaction()`.

## Publicando um adapter

Você pode publicar o seu próprio adapter com qualquer nome e escopo que controlar. Tornar-se um `@vsrepo/*-adapter` **oficial** é outra história: passa por um checklist de validação.

Os dois caminhos por completo — as recomendações para o seu pacote, o checklist, e como o acesso de publicação no npm é concedido: [Escrevendo seu próprio adapter → Publicando um adapter](./writing-an-adapter.pt-BR.md#publicando-um-adapter).

Leia o [CONTRIBUTING.pt-BR.md](../CONTRIBUTING.pt-BR.md) para o fluxo completo de contribuição, e mantenha as mudanças de documentação em português e em inglês.

[⬆️ Voltar ao topo](#top)
