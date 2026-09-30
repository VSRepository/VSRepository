# Contribuindo com o VSRepository

🇧🇷 Português | [🇺🇸 English](./CONTRIBUTING.md)

Contribuições são muito bem-vindas — especialmente adapters, reports de bug e documentação. Este repositório é o **core agnóstico de ORM**; saber em qual metade a sua mudança se encaixa é o caminho mais rápido para ela ser mergeada.

- **Montar o repo e os principais scripts** → [Montando o repo](#montando-o-repo) e [Scripts](#scripts)
- **Quais adapters de ORM existem hoje** → [Status dos adapters](./docs/adapters.pt-BR.md)

## Montando o repo

| Ferramenta | Versão |
| ---------- | ------ |
| Node.js    | 22+    |
| Bun        | latest |
| TypeScript | 6.x    |

```bash
bun install
```

## Scripts

| Script                    | O que faz                                                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `bun run full-validation` | `typecheck` + `lint` + `format:check` + `test` — o gate a rodar antes de abrir um PR.                                       |
| `bun run build`           | `clean` + `tsc -p tsconfig.build.json` — compila `src/` em `dist/` com `rootDir: src`, gerando JS e as declarações `.d.ts`. |
| `bun run test`            | `test:typing` e depois `test:implementation`, nessa ordem.                                                                  |
| `bun run typecheck`       | `tsc --noEmit -p tsconfig.build.json` — validação de tipagem.                                                               |
| `bun run lint`            | `oxlint --type-aware src/ test/`.                                                                                           |
| `bun run format:check`    | Prettier em modo de check sobre `src/**/*.ts` e `test/**/*.ts`.                                                             |

As duas suítes de teste também rodam sozinhas — `test:typing` (asserções em tempo de compilação) e `test:implementation` (comportamento em runtime contra um adapter falso), com `test:implementation:watch` para o modo watch. Todos os outros scripts (`format`, `clean`, `prepack`) estão no [`package.json`](./package.json).

```bash
bun run full-validation
```

## Escopo: o core vs. um adapter

Esta é a coisa mais importante a acertar antes de abrir uma Issue ou um PR.

| Sua mudança pertence ao… | Quando                                                                                                                                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **core (`vsrepo`)**      | A classe de repository, os decorators `@DynamicMethod`/`@QueryMethod`, o engine de parsing de nomes, os query builders, transações, soft-delete, tratamento de erros, logging, e o próprio contrato `VSRepoAdapter`. |
| **adapter**              | Tudo que é específico de ORM: traduzir um `VSRepoWhere` no `where`/`include` do Prisma, mapear erros do driver, a sintaxe de placeholders, `runInTransaction`.                                                       |

O core **nunca importa um ORM**. O suporte a Prisma 7 e Drizzle é distribuído como pacotes separados exatamente para o core poder continuar agnóstico de ORM:

- [Escrevendo seu próprio adapter](./docs/writing-an-adapter.pt-BR.md) — o contrato, método a método
- [Publicando um adapter](./docs/writing-an-adapter.pt-BR.md#publicando-um-adapter) — publicando o seu em qualquer escopo, e o checklist para um `@vsrepo/*-adapter` oficial

Você nunca precisa de permissão para publicar um adapter com um nome que você controla. Publicar sob o escopo `@vsrepo` é um passo separado e com gate: abra uma issue com o link do seu repositório e, depois que o seu repositório for aprovado para publicação no npm, abra um PR adicionando uma linha na tabela de [`docs/adapters.pt-BR.md`](./docs/adapters.pt-BR.md) (e na versão em inglês).

## Reportando um bug

Abra uma **Issue** primeiro.

1. Versão do VSRepository, do adapter, do ORM e do Node.
2. O que você esperava, e o que aconteceu.
3. Uma reprodução mínima: a classe de repository, o adapter, e a chamada que se comporta mal.
4. O erro completo, incluindo o stack e qualquer `VSRepoError`/`AdapterErrorCode`.

## Pedindo uma feature

Abra uma **Issue** descrevendo a funcionalidade e os casos de uso.

## Enviando um pull request

1. **Faça um Fork** do projeto e clone o seu fork.
2. **Crie uma branch** a partir de `main`, nomeada conforme a mudança.
3. **Faça a mudança.** Mantenha o histórico legível — [Conventional Commits](https://www.conventionalcommits.org/), com a descrição escrita em português, como o resto do histórico.
4. **Rode o gate completo localmente**: `bun run full-validation` (typecheck + lint + format:check + testes). A CI roda as mesmas checagens, mais o build.
5. **Suba** a branch e abra um **Pull Request** contra a `main`.

Uma boa descrição de PR responde:

- **O que** mudou e **por quê** — o problema, não só o diff.
- **Como** você verificou — quais testes foram adicionados, o que você rodou.
- **Se quebra algo** — um novo método obrigatório no adapter, um tipo de retorno alterado, uma option renomeada, uma validação que agora lança onde antes não lançava.
- **Os dois idiomas** — se você tocou em `docs/`, a versão em inglês e a em português mudaram juntas, no mesmo PR. Um guia é `foo.md` + `foo.pt-BR.md`.
- **Uma entrada no `CHANGELOG.md`**, se a mudança for visível para quem usa o pacote. Mudanças só de documentação e internas não precisam de uma.

## Revisão

Todo PR roda a suíte completa da CI antes de poder ser mergeado, e todo PR passa por revisão.

## Código de conduta

Seja respeitoso e presuma boa intenção. Revisões são sobre o código, não sobre quem escreveu. Assédio ou ataques pessoais de qualquer natureza não são tolerados em issues, PRs ou discussões.

## Reportando uma falha de segurança

Por favor, não abra uma issue pública para uma vulnerabilidade. Reporte em privado para [joaodev.azevedo@outlook.com](mailto:joaodev.azevedo@outlook.com), para que uma correção possa ser preparada antes de os detalhes virarem públicos.

---

## Estrutura do repositório

```text
src/
  index.ts           # entry point público — a superfície de export única do `vsrepo`
  VSRepository.ts    # a classe de repository: métodos base, transações
  VSRepoAdapter.ts   # o contrato abstrato de adapter que toda integração de ORM implementa
  decorators/        # @DynamicMethod e @QueryMethod
  errors/            # VSRepoError e VSRepoAdapterError
  internal/          # chaves de metadata, enums, o parser de nomes, loggers, query builders, VSSql
  types/             # tipos
test/
  implementation/    # Jest — comportamento em runtime, contra um adapter falso
  typing/            # só tsc --noEmit — asserções em tempo de compilação
  helpers/           # adapter falso, entidades, repositories de exemplo
docs/                # a documentação bilíngue
```

O `src/index.ts` é a única superfície pública: tudo que não é re-exportado por ele é interno.

## Convenções

- **Decorators** — a biblioteca usa decorators legacy/experimentais. `experimentalDecorators: true` está no `tsconfig.json` e é requirement de `@DynamicMethod`/`@QueryMethod`.
- **Formatação** — Prettier (veja [.prettierrc](./.prettierrc)).
- **Lint** — oxlint (veja [.oxlintrc.json](./.oxlintrc.json)).
- **Commits** — [Conventional Commits](https://www.conventionalcommits.org/), com a descrição escrita em português: `feat:`, `fix(scope):`, `docs:`, `test:`, `build:`, `ci:`, `style:`, `chore:` e `version: X.Y.Z` para o bump de release.
- **Docs** — todo guia existe em inglês e em português (`foo.md` / `foo.pt-BR.md`), e mudar um é mudar os dois.

## Build e consumo local

```bash
# Gerar o tarball instalável (prepack -> bun run build roda automaticamente)
npm pack

# Consumir a partir de outro projeto
npm install ../caminho/vsrepo-*.tgz
```

Esse é o loop que quem escreve um adapter quer: buildar o core localmente, empacotar, e instalar o tarball num projeto de rascunho para testar o adapter contra o core atual.

## CI

O `.github/workflows/ci.yml` roda a cada push e pull request para `main`, com `concurrency` cancelando qualquer run em andamento do mesmo ref. Três jobs, todos em `ubuntu-latest` com Bun:

| Job     | Roda                                                 | Depende de     |
| ------- | ---------------------------------------------------- | -------------- |
| `lint`  | `bun run lint` e `bun run format:check`              | —              |
| `test`  | `bun run test` (tipagem + implementação)             | —              |
| `build` | `bun run build`, depois sobe o `dist/` como artifact | `lint`, `test` |
