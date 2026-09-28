// Testes dedicados ao PARSER de métodos dinâmicos (`DynamicMethodsResolver`).
//
// `dynamic-methods.test.ts` cobre o uso "do dia a dia" de forma realista.
// Este arquivo é mais implacável: existe uma variante para cada
// sufixo/prefixo/operador que o parser suporta, cada uma isolada num
// `it()` próprio, comparando o `where`/args resolvido contra o valor exato
// esperado. O objetivo é travar (e documentar, via nome do teste) o
// comportamento real do parser — inclusive detalhes não óbvios só visíveis
// lendo o código-fonte do resolver, como:
//
//   - `Between`/`NotBetween` viram `{ between: [min, max] }` (não `gte`/`lte`);
//   - `IsNull`/`IsNotNull` resolvem pra `null` / `{ not: null }` puro, sem
//     objeto "operator" (ex.: NÃO é `{ equals: null }`);
//   - `IgnoreCase` sem operador (e com `Equals`) vira `{ equals: valor, ignoreCase: true }`,
//     e `IgnoreCase` em operadores negados (`NotContains`, `NotEndsWith`, ...) fica DENTRO
//     do objeto do operador: `{ not: { contains: valor, ignoreCase: true } }`;
//   - campos da MESMA relação repetidos no nome (`AddressWithCityAndAddressWithCountry...`,
//     `ProductsSomeNameContainsAndProductsSomePrice...`) são mesclados de forma PROFUNDA
//     (deep merge) num único objeto `_with`/`_some` — e não sobrescrevem um ao outro;
//   - blocos `AND`/`Or` combinados (`campoOrCampoANDcampoAndCampo...`) geram
//     as chaves `OR`/`AND` do Prisma-like where, cada uma com um array de
//     sub-where's mesclados.
//
// Tudo isso foi conferido rodando o parser de verdade (não é uma suposição
// de como "deveria" funcionar) antes de virar asserção fixa aqui.

import "reflect-metadata";
import { describe, it, expect, beforeEach } from "@jest/globals";
import { VSRepoAdapter } from "../../src/VSRepoAdapter";
import { VSRepoError } from "../../src/errors/VSRepoError";
import { createFakeAdapter } from "../helpers/fake-adapter";
import { ParserRepository } from "../helpers/parser-repository";

let fakeAdapter: jest.Mocked<VSRepoAdapter<any>>;
let repo: ParserRepository;

beforeEach(() => {
    fakeAdapter = createFakeAdapter<any>();
    repo = new ParserRepository(fakeAdapter);
    // Retorno padrão pra métodos que este arquivo não configura caso a caso.
    fakeAdapter.findMany.mockResolvedValue([]);
    fakeAdapter.findOne.mockResolvedValue(null);
    fakeAdapter.findOneOrThrow.mockResolvedValue({});
});

function where(): unknown {
    return fakeAdapter.findMany.mock.calls[0]?.[0];
}

// =============================================================================
// Filtros de campo (sufixos)
// =============================================================================

describe("filtros de campo — sem operador (igualdade)", () => {
    it("'findByName' -> { name: <valor> }", async () => {
        await repo.findByName("João");
        expect(where()).toEqual({ name: "João" });
    });

    it("'findByNameOptional' -> sufixo 'Optional' não muda a resolução, só o nome do campo", async () => {
        await repo.findByNameOptional("João");
        expect(where()).toEqual({ name: "João" });
    });

    it("'findByNameEquals' -> { name: <valor> } (igual a sem sufixo; existe para desambiguar colisões, ver abaixo)", async () => {
        await repo.findByNameEquals("João");
        expect(where()).toEqual({ name: "João" });
    });

    it("'findByNameNotEquals' -> { name: { not: <valor> } } (igual a 'Not', mesma ideia de desambiguação)", async () => {
        await repo.findByNameNotEquals("João");
        expect(where()).toEqual({ name: { not: "João" } });
    });
});

describe("robustez contra colisão de palavra-chave em nome de campo", () => {
    // O parser só reconhece uma palavra-chave (Or/And/Not/In/With/Every/Optional/...) quando ela
    // termina numa fronteira de camelCase: seguida de maiúscula, de caractere não-ASCII, ou (para
    // sufixos de campo) do fim do nome. Um campo que contém a palavra-chave no meio, sem essa
    // fronteira, é tratado como um único nome de campo — não é cortado.
    it("'findByNotes' -> { notes: <valor> } ('Not' no meio de 'Notes' não é a palavra-chave 'Not')", async () => {
        await repo.findByNotes("anotação");
        expect(where()).toEqual({ notes: "anotação" });
    });

    it("'findByOrganizationId' -> { organizationId: <valor> } ('Or' seguido de minúscula não é o operador 'Or')", async () => {
        await repo.findByOrganizationId("org-1");
        expect(where()).toEqual({ organizationId: "org-1" });
    });

    it("'findByOrderId' -> { orderId: <valor> } (mesma ideia: 'Or' de 'Order' não é o operador 'Or')", async () => {
        await repo.findByOrderId("order-1");
        expect(where()).toEqual({ orderId: "order-1" });
    });

    it("'findByInstagramHandle' -> { instagramHandle: <valor> } ('In' seguido de minúscula não é o sufixo 'In')", async () => {
        await repo.findByInstagramHandle("@joao");
        expect(where()).toEqual({ instagramHandle: "@joao" });
    });

    it("'findByWithdrawnAt' -> { withdrawnAt: <valor> } ('With' seguido de minúscula não é o infixo de relação 'With')", async () => {
        const date = new Date("2026-01-01");
        await repo.findByWithdrawnAt(date);
        expect(where()).toEqual({ withdrawnAt: date });
    });

    it("'findByAndroidVersion' -> { androidVersion: <valor> } ('And' seguido de minúscula não é o operador 'And')", async () => {
        await repo.findByAndroidVersion("14");
        expect(where()).toEqual({ androidVersion: "14" });
    });

    it("'findByEveryoneId' -> { everyoneId: <valor> } ('Every' seguido de minúscula não é o infixo de relação 'Every')", async () => {
        await repo.findByEveryoneId("everyone-1");
        expect(where()).toEqual({ everyoneId: "everyone-1" });
    });

    it("'findByCheckIn' continua ambíguo por padrão -> { check: { in: <valor> } } ('In' no fim de 'CheckIn' É uma fronteira válida)", async () => {
        await repo.findByCheckIn(["a", "b"]);
        expect(where()).toEqual({ check: { in: ["a", "b"] } });
    });

    it("'findByCheckInEquals' desambigua com 'Equals' -> { checkIn: <valor> }", async () => {
        await repo.findByCheckInEquals("2026-01-01");
        expect(where()).toEqual({ checkIn: "2026-01-01" });
    });
});

describe("filtros de campo — negação e conjuntos", () => {
    it("'findByNameNot' -> { name: { not: <valor> } }", async () => {
        await repo.findByNameNot("João");
        expect(where()).toEqual({ name: { not: "João" } });
    });

    it("'findByUserTypeIn' -> { userType: { in: [...] } }", async () => {
        await repo.findByUserTypeIn(["ADMIN", "COMMON"]);
        expect(where()).toEqual({ userType: { in: ["ADMIN", "COMMON"] } });
    });

    it("'findByUserTypeNotIn' -> { userType: { notIn: [...] } }", async () => {
        await repo.findByUserTypeNotIn(["ADMIN"]);
        expect(where()).toEqual({ userType: { notIn: ["ADMIN"] } });
    });
});

describe("filtros de campo — texto (Contains/StartsWith/EndsWith) e suas negações", () => {
    it("'findByNameContains' -> { name: { contains: <valor> } }", async () => {
        await repo.findByNameContains("oã");
        expect(where()).toEqual({ name: { contains: "oã" } });
    });

    it("'findByNameNotContains' -> { name: { not: { contains: <valor> } } }", async () => {
        await repo.findByNameNotContains("oã");
        expect(where()).toEqual({ name: { not: { contains: "oã" } } });
    });

    it("'findByNameStartsWith' -> { name: { startsWith: <valor> } }", async () => {
        await repo.findByNameStartsWith("Jo");
        expect(where()).toEqual({ name: { startsWith: "Jo" } });
    });

    it("'findByNameNotStartsWith' -> { name: { not: { startsWith: <valor> } } }", async () => {
        await repo.findByNameNotStartsWith("Jo");
        expect(where()).toEqual({ name: { not: { startsWith: "Jo" } } });
    });

    it("'findByNameEndsWith' -> { name: { endsWith: <valor> } }", async () => {
        await repo.findByNameEndsWith("ão");
        expect(where()).toEqual({ name: { endsWith: "ão" } });
    });

    it("'findByNameNotEndsWith' -> { name: { not: { endsWith: <valor> } } }", async () => {
        await repo.findByNameNotEndsWith("ão");
        expect(where()).toEqual({ name: { not: { endsWith: "ão" } } });
    });

    it("'findByNameContainsIgnoreCase' -> 'ignoreCase: true' fica dentro do MESMO objeto do operador de texto", async () => {
        await repo.findByNameContainsIgnoreCase("jo");
        expect(where()).toEqual({ name: { contains: "jo", ignoreCase: true } });
    });
});

describe("filtros de campo — combinador 'IgnoreCase' em todos os operadores de texto", () => {
    it("'findByNameIgnoreCase' (sem operador) -> { name: { equals: valor, ignoreCase: true } }", async () => {
        await repo.findByNameIgnoreCase("João");
        expect(where()).toEqual({ name: { equals: "João", ignoreCase: true } });
    });

    it("'findByNameEqualsIgnoreCase' -> { name: { equals: valor, ignoreCase: true } } (mesma forma do 'IgnoreCase' puro)", async () => {
        await repo.findByNameEqualsIgnoreCase("João");
        expect(where()).toEqual({ name: { equals: "João", ignoreCase: true } });
    });

    it("'findByNameNotEqualsIgnoreCase' -> 'ignoreCase' fica dentro do MESMO objeto do operador de texto", async () => {
        await repo.findByNameNotEqualsIgnoreCase("João");
        expect(where()).toEqual({ name: { not: "João", ignoreCase: true } });
    });

    it("'findByNameStartsWithIgnoreCase' -> { name: { startsWith: valor, ignoreCase: true } }", async () => {
        await repo.findByNameStartsWithIgnoreCase("Jo");
        expect(where()).toEqual({ name: { startsWith: "Jo", ignoreCase: true } });
    });

    it("'findByNameNotStartsWithIgnoreCase' -> { name: { not: { startsWith: valor, ignoreCase: true } } }", async () => {
        await repo.findByNameNotStartsWithIgnoreCase("Jo");
        expect(where()).toEqual({ name: { not: { startsWith: "Jo", ignoreCase: true } } });
    });

    it("'findByNameEndsWithIgnoreCase' -> { name: { endsWith: valor, ignoreCase: true } }", async () => {
        await repo.findByNameEndsWithIgnoreCase("ão");
        expect(where()).toEqual({ name: { endsWith: "ão", ignoreCase: true } });
    });

    it("'findByNameNotContainsIgnoreCase' -> { name: { not: { contains: valor, ignoreCase: true } } }", async () => {
        await repo.findByNameNotContainsIgnoreCase("oã");
        expect(where()).toEqual({ name: { not: { contains: "oã", ignoreCase: true } } });
    });

    it("'findByNameNotEndsWithIgnoreCase' -> { name: { not: { endsWith: valor, ignoreCase: true } } }", async () => {
        await repo.findByNameNotEndsWithIgnoreCase("ão");
        expect(where()).toEqual({ name: { not: { endsWith: "ão", ignoreCase: true } } });
    });

    it("'findByUserTypeInIgnoreCase' -> { userType: { in: [...], ignoreCase: true } }", async () => {
        await repo.findByUserTypeInIgnoreCase(["ADMIN"]);
        expect(where()).toEqual({ userType: { in: ["ADMIN"], ignoreCase: true } });
    });
});

describe("filtros de campo — sufixo 'Optional' combinado com operador", () => {
    it("'findByNameContainsOptional' -> { name: { contains: valor } } ('Optional' é só documental, não muda a resolução)", async () => {
        await repo.findByNameContainsOptional("oã");
        expect(where()).toEqual({ name: { contains: "oã" } });
    });
});

describe("filtros de campo — comparação numérica/data", () => {
    const d = new Date("2026-01-01T00:00:00.000Z");

    it("'findByCreatedAtGreaterThan' -> { createdAt: { gt: <valor> } }", async () => {
        await repo.findByCreatedAtGreaterThan(d);
        expect(where()).toEqual({ createdAt: { gt: d } });
    });

    it("'findByCreatedAtGreaterThanEqual' -> { createdAt: { gte: <valor> } }", async () => {
        await repo.findByCreatedAtGreaterThanEqual(d);
        expect(where()).toEqual({ createdAt: { gte: d } });
    });

    it("'findByCreatedAtLessThan' -> { createdAt: { lt: <valor> } }", async () => {
        await repo.findByCreatedAtLessThan(d);
        expect(where()).toEqual({ createdAt: { lt: d } });
    });

    it("'findByCreatedAtLessThanEqual' -> { createdAt: { lte: <valor> } }", async () => {
        await repo.findByCreatedAtLessThanEqual(d);
        expect(where()).toEqual({ createdAt: { lte: d } });
    });

    it("'findByCreatedAtBetween' -> { createdAt: { between: [min, max] } } (NÃO vira gte/lte)", async () => {
        const range = [new Date("2026-01-01"), new Date("2026-02-01")];
        await repo.findByCreatedAtBetween(range);
        expect(where()).toEqual({ createdAt: { between: range } });
    });

    it("'findByCreatedAtNotBetween' -> { createdAt: { not: { between: [min, max] } } }", async () => {
        const range = [new Date("2026-01-01"), new Date("2026-02-01")];
        await repo.findByCreatedAtNotBetween(range);
        expect(where()).toEqual({ createdAt: { not: { between: range } } });
    });
});

describe("filtros de campo — nulidade e boolean (IsNull/IsNotNull/IsTrue/IsFalse)", () => {
    it("'findByEmailIsNull' -> { email: null } (valor puro, sem args e sem objeto operador)", async () => {
        await repo.findByEmailIsNull();
        expect(where()).toEqual({ email: null });
    });

    it("'findByEmailIsNotNull' -> { email: { not: null } } (sem args)", async () => {
        await repo.findByEmailIsNotNull();
        expect(where()).toEqual({ email: { not: null } });
    });

    it("'findByActiveIsTrue' -> { active: true } (sem args)", async () => {
        await repo.findByActiveIsTrue();
        expect(where()).toEqual({ active: true });
    });

    it("'findByActiveIsFalse' -> { active: false } (sem args)", async () => {
        await repo.findByActiveIsFalse();
        expect(where()).toEqual({ active: false });
    });
});

// =============================================================================
// Operadores lógicos
// =============================================================================

describe("operador 'And' entre dois campos simples", () => {
    it("'findOneByIdAndEmail' combina os dois campos no mesmo objeto 'where' (sem 'AND' aninhado)", async () => {
        fakeAdapter.findOne.mockResolvedValueOnce({});

        await repo.findOneByIdAndEmail("user-1", "joao@email.com");

        expect(fakeAdapter.findOne.mock.calls[0]?.[0]).toEqual({
            id: "user-1",
            email: "joao@email.com",
        });
    });
});

describe("operador 'Or' entre dois campos simples", () => {
    it("'findByNameOrEmail' gera 'where.OR' com um sub-where por campo", async () => {
        await repo.findByNameOrEmail("Nome", "e@x.com");
        expect(where()).toEqual({ OR: [{ name: "Nome" }, { email: "e@x.com" }] });
    });
});

describe("bloco composto 'campoOrCampoANDcampoAndCampoOperador' (OR + AND)", () => {
    it("separa em 'OR' (antes do 'AND' maiúsculo) e 'AND' (depois), cada bloco com seu próprio 'And' interno", async () => {
        // findByEmailOrNameANDActiveStatusAndAgeGreaterThan(email, name, activeStatus, age)
        //   -> "EmailOrName"                antes do "AND" -> vira o array OR: email OR name
        //   -> "ActiveStatusAndAgeGreaterThan" depois do "AND" -> vira o array AND: activeStatus E age > x
        await repo.findByEmailOrNameANDActiveStatusAndAgeGreaterThan("e@x.com", "Nome", true, 18);

        expect(where()).toEqual({
            OR: [{ email: "e@x.com" }, { name: "Nome" }],
            AND: [{ activeStatus: true, age: { gt: 18 } }],
        });
    });
});

describe("operador 'And' com três ou mais campos", () => {
    it("'findOneByIdAndEmailAndActive' combina todos os campos no mesmo objeto 'where'", async () => {
        fakeAdapter.findOne.mockResolvedValueOnce({});

        await repo.findOneByIdAndEmailAndActive("user-1", "joao@email.com", true);

        expect(fakeAdapter.findOne.mock.calls[0]?.[0]).toEqual({
            id: "user-1",
            email: "joao@email.com",
            active: true,
        });
    });
});

describe("operador 'Or' com três ou mais ramos", () => {
    it("'findByNameOrEmailOrAgeGreaterThan' gera um sub-where por ramo, na ordem do nome", async () => {
        await repo.findByNameOrEmailOrAgeGreaterThan("Nome", "e@x.com", 18);
        expect(where()).toEqual({ OR: [{ name: "Nome" }, { email: "e@x.com" }, { age: { gt: 18 } }] });
    });

    it("'findByNameContainsOrEmailStartsWith' combina 'Or' com operadores de texto em cada ramo", async () => {
        await repo.findByNameContainsOrEmailStartsWith("oã", "jo");
        expect(where()).toEqual({ OR: [{ name: { contains: "oã" } }, { email: { startsWith: "jo" } }] });
    });
});

describe("operador 'And' com operador de campo embutido", () => {
    it("'findOneByEmailAndAgeGreaterThan' mantém o operador dentro do próprio campo", async () => {
        fakeAdapter.findOne.mockResolvedValueOnce({});

        await repo.findOneByEmailAndAgeGreaterThan("e@x.com", 18);

        expect(fakeAdapter.findOne.mock.calls[0]?.[0]).toEqual({ email: "e@x.com", age: { gt: 18 } });
    });
});

// =============================================================================
// Filtros de relação (_some / _every / _none / _with / _without)
// =============================================================================

describe("filtros de relação — coleção (Some/Every/None)", () => {
    it("'findByProductsSome' sem sub-filtro -> { products: { _some: {} } }", async () => {
        await repo.findByProductsSome();
        expect(where()).toEqual({ products: { _some: {} } });
    });

    it("'findByProductsSomeNameContains' -> sub-filtro do campo relacionado dentro de '_some'", async () => {
        await repo.findByProductsSomeNameContains("Camiseta");
        expect(where()).toEqual({ products: { _some: { name: { contains: "Camiseta" } } } });
    });

    it("'findByProductsEveryActiveIsTrue' -> sub-filtro booleano dentro de '_every'", async () => {
        await repo.findByProductsEveryActiveIsTrue();
        expect(where()).toEqual({ products: { _every: { active: true } } });
    });

    it("'findByProductsNone' sem sub-filtro -> { products: { _none: {} } }", async () => {
        await repo.findByProductsNone();
        expect(where()).toEqual({ products: { _none: {} } });
    });
});

describe("filtros de relação — um-para-um/opcional (With/Without)", () => {
    it("'findByAddressWith' sem sub-filtro -> { address: { _with: {} } }", async () => {
        await repo.findByAddressWith();
        expect(where()).toEqual({ address: { _with: {} } });
    });

    it("'findByAddressWithout' sem sub-filtro -> { address: { _without: {} } }", async () => {
        await repo.findByAddressWithout();
        expect(where()).toEqual({ address: { _without: {} } });
    });

    it("'findByAddressWithoutCity' -> sub-filtro (igualdade) dentro de '_without'", async () => {
        await repo.findByAddressWithoutCity("Rio de Janeiro");
        expect(where()).toEqual({ address: { _without: { city: "Rio de Janeiro" } } });
    });

    it("'findByAddressWithCityStartsWithIgnoreCase' -> 'ignoreCase' fica DENTRO do filtro do campo relacionado ('city')", async () => {
        await repo.findByAddressWithCityStartsWithIgnoreCase("Rio");

        expect(where()).toEqual({
            address: {
                _with: { city: { startsWith: "Rio", ignoreCase: true } },
            },
        });
    });

    it("'findByAddressWithCityEquals' -> igualdade dentro de '_with' vem como valor direto (sem objeto operador)", async () => {
        await repo.findByAddressWithCityEquals("Aracaju");
        expect(where()).toEqual({ address: { _with: { city: "Aracaju" } } });
    });

    it("'findByProductsSomeNameEqualsIgnoreCase' -> igualdade + 'IgnoreCase' dentro de '_some' vira { equals, ignoreCase }", async () => {
        await repo.findByProductsSomeNameEqualsIgnoreCase("Notebook");
        expect(where()).toEqual({ products: { _some: { name: { equals: "Notebook", ignoreCase: true } } } });
    });
});

describe("filtros de relação — operadores variados dentro de cada conector", () => {
    it("'findByProductsSomeNameIn' -> { products: { _some: { name: { in: [...] } } } }", async () => {
        await repo.findByProductsSomeNameIn(["Camiseta", "Calça"]);
        expect(where()).toEqual({ products: { _some: { name: { in: ["Camiseta", "Calça"] } } } });
    });

    it("'findByProductsSomeNameBetween' -> 'between' dentro do '_some'", async () => {
        const range = [10, 50];
        await repo.findByProductsSomeNameBetween(range);
        expect(where()).toEqual({ products: { _some: { name: { between: range } } } });
    });

    it("'findByProductsSomeDeletedAtIsNull' -> valor puro 'null' dentro do '_some' (sem args)", async () => {
        await repo.findByProductsSomeDeletedAtIsNull();
        expect(where()).toEqual({ products: { _some: { deletedAt: null } } });
    });

    it("'findByProductsEveryNameNotStartsWith' -> 'not.startsWith' dentro do '_every'", async () => {
        await repo.findByProductsEveryNameNotStartsWith("X");
        expect(where()).toEqual({ products: { _every: { name: { not: { startsWith: "X" } } } } });
    });

    it("'findByProductsEveryDeletedAtIsNull' -> valor puro 'null' dentro do '_every' (sem args)", async () => {
        await repo.findByProductsEveryDeletedAtIsNull();
        expect(where()).toEqual({ products: { _every: { deletedAt: null } } });
    });

    it("'findByProductsNoneNameContains' -> sub-filtro de texto dentro do '_none'", async () => {
        await repo.findByProductsNoneNameContains("vietnamita");
        expect(where()).toEqual({ products: { _none: { name: { contains: "vietnamita" } } } });
    });

    it("'findByProductsNonePriceBetween' -> 'between' dentro do '_none'", async () => {
        const range = [10, 50];
        await repo.findByProductsNonePriceBetween(range);
        expect(where()).toEqual({ products: { _none: { price: { between: range } } } });
    });

    it("'findByAddressWithCityIsNull' -> { address: { _with: { city: null } } } (sem args)", async () => {
        await repo.findByAddressWithCityIsNull();
        expect(where()).toEqual({ address: { _with: { city: null } } });
    });

    it("'findByAddressWithCityIsNotNull' -> { address: { _with: { city: { not: null } } } } (sem args)", async () => {
        await repo.findByAddressWithCityIsNotNull();
        expect(where()).toEqual({ address: { _with: { city: { not: null } } } });
    });

    it("'findByAddressWithCityNotContains' -> 'not.contains' dentro do '_with'", async () => {
        await repo.findByAddressWithCityNotContains("ia");
        expect(where()).toEqual({ address: { _with: { city: { not: { contains: "ia" } } } } });
    });

    it("'findByAddressWithoutCityStartsWith' -> 'startsWith' dentro do '_without'", async () => {
        await repo.findByAddressWithoutCityStartsWith("Rio");
        expect(where()).toEqual({ address: { _without: { city: { startsWith: "Rio" } } } });
    });

    it("'findByAddressWithoutCityNotEndsWith' -> 'not.endsWith' dentro do '_without'", async () => {
        await repo.findByAddressWithoutCityNotEndsWith("o");
        expect(where()).toEqual({ address: { _without: { city: { not: { endsWith: "o" } } } } });
    });
});

describe("filtros de relação — MESMA relação repetida no nome (deep merge)", () => {
    it("'findByAddressWithCityAndAddressWithCountryStartsWith' mescla os dois 'With' da MESMA relação num único objeto '_with'", async () => {
        await repo.findByAddressWithCityAndAddressWithCountryStartsWith("Aracaju", "Bra");

        expect(where()).toEqual({
            address: { _with: { city: "Aracaju", country: { startsWith: "Bra" } } },
        });
    });

    it("'findByProductsSomeNameContainsAndProductsSomePriceGreaterThan' mescla dois campos no MESMO '_some'", async () => {
        await repo.findByProductsSomeNameContainsAndProductsSomePriceGreaterThan("Fone", 100);

        expect(where()).toEqual({
            products: { _some: { name: { contains: "Fone" }, price: { gt: 100 } } },
        });
    });

    it("'findByProductsSomeNameContainsAndPriceGreaterThan' separa o 'And': campo da relação no '_some' e campo simples na raiz", async () => {
        await repo.findByProductsSomeNameContainsAndPriceGreaterThan("Fone", 100);

        expect(where()).toEqual({
            products: { _some: { name: { contains: "Fone" } } },
            price: { gt: 100 },
        });
    });

    it("'findByAddressWithCityOrAddressWithCountryEquals' repete a MESMA relação em ramos 'Or' separados", async () => {
        await repo.findByAddressWithCityOrAddressWithCountryEquals("Aracaju", "Brasil");

        expect(where()).toEqual({
            OR: [{ address: { _with: { city: "Aracaju" } } }, { address: { _with: { country: "Brasil" } } }],
        });
    });

    it("'findByProductsSomeNameOrAddressWithCity' cruza relação e campo simples dentro de ramos 'Or'", async () => {
        await repo.findByProductsSomeNameOrAddressWithCity("Fone", "Aracaju");

        expect(where()).toEqual({
            OR: [{ products: { _some: { name: "Fone" } } }, { address: { _with: { city: "Aracaju" } } }],
        });
    });
});

// =============================================================================
// Prefixos -> método do VSRepoAdapter chamado
// =============================================================================

describe("prefixos de leitura", () => {
    it("'findByEmail' chama 'adapter.findMany'", async () => {
        await repo.findByEmail("e@x.com");
        expect(fakeAdapter.findMany).toHaveBeenCalledTimes(1);
        expect(fakeAdapter.findOne).not.toHaveBeenCalled();
    });

    it("'findOneByEmail' chama 'adapter.findOne'", async () => {
        await repo.findOneByEmail("e@x.com");
        expect(fakeAdapter.findOne).toHaveBeenCalledTimes(1);
        expect(fakeAdapter.findMany).not.toHaveBeenCalled();
    });

    it("'findOneOrThrowByEmail' chama 'adapter.findOneOrThrow' com o 'where' resolvido do nome", async () => {
        await repo.findOneOrThrowByEmail("e@x.com");
        expect(fakeAdapter.findOneOrThrow.mock.calls[0]?.[0]).toEqual({ email: "e@x.com" });
    });

    it("'findOneOrThrowWhere' chama 'adapter.findOneOrThrow' com o 'where' passado explicitamente", async () => {
        await repo.findOneOrThrowWhere({ email: "e@x.com" });
        expect(fakeAdapter.findOneOrThrow.mock.calls[0]?.[0]).toEqual({ email: "e@x.com" });
    });

    it("'findOneOrThrow' (sem sufixo) chama 'adapter.findOneOrThrow' sem nenhum filtro", async () => {
        await repo.findOneOrThrow();
        expect(fakeAdapter.findOneOrThrow.mock.calls[0]?.[0]).toEqual({});
    });

    it("'findWhere' chama 'adapter.findMany' com o 'where' passado explicitamente (sem parsear o nome)", async () => {
        await repo.findWhere({ active: true });
        expect(fakeAdapter.findMany.mock.calls[0]?.[0]).toEqual({ active: true });
    });

    it("'findOneWhere' chama 'adapter.findOne' com o 'where' passado explicitamente", async () => {
        await repo.findOneWhere({ active: true });
        expect(fakeAdapter.findOne.mock.calls[0]?.[0]).toEqual({ active: true });
    });

    it("'findOne' (sem sufixo) chama 'adapter.findOne' sem nenhum filtro — mesma ideia do 'findOneOrThrow' sem sufixo, mas pode retornar 'null'", async () => {
        fakeAdapter.findOne.mockResolvedValueOnce(null);

        await repo.findOne();

        expect(fakeAdapter.findOne.mock.calls[0]?.[0]).toEqual({});
        expect(fakeAdapter.findMany).not.toHaveBeenCalled();
        expect(fakeAdapter.findOneOrThrow).not.toHaveBeenCalled();
    });
});

describe("prefixos de agregação/existência", () => {
    it("'countByActive' chama 'adapter.count' com o 'where' resolvido do nome", async () => {
        fakeAdapter.count.mockResolvedValueOnce(3);
        await repo.countByActive(true);
        expect(fakeAdapter.count.mock.calls[0]?.[0]).toEqual({ active: true });
    });

    it("'countWhere' chama 'adapter.count' com o 'where' passado explicitamente", async () => {
        fakeAdapter.count.mockResolvedValueOnce(3);
        await repo.countWhere({ active: true });
        expect(fakeAdapter.count.mock.calls[0]?.[0]).toEqual({ active: true });
    });

    it("'count' (sem sufixo) chama 'adapter.count' sem nenhum filtro", async () => {
        fakeAdapter.count.mockResolvedValueOnce(10);
        await repo.count();
        expect(fakeAdapter.count.mock.calls[0]?.[0]).toEqual({});
    });

    it("'existsByEmail' chama 'adapter.exists' com o 'where' resolvido do nome", async () => {
        fakeAdapter.exists.mockResolvedValueOnce(true);
        await repo.existsByEmail("e@x.com");
        expect(fakeAdapter.exists.mock.calls[0]?.[0]).toEqual({ email: "e@x.com" });
    });

    it("'existsWhere' chama 'adapter.exists' com o 'where' passado explicitamente", async () => {
        fakeAdapter.exists.mockResolvedValueOnce(false);
        await repo.existsWhere({ email: "e@x.com" });
        expect(fakeAdapter.exists.mock.calls[0]?.[0]).toEqual({ email: "e@x.com" });
    });
});

describe("prefixos de escrita — create", () => {
    it("'create' chama 'adapter.create' com o objeto recebido", async () => {
        const payload = { name: "novo" };
        fakeAdapter.create.mockResolvedValueOnce(payload);

        await repo.create(payload);

        expect(fakeAdapter.create.mock.calls[0]?.[0]).toBe(payload);
    });

    it("'createMany' chama 'adapter.createMany' com a lista recebida", async () => {
        const payload = [{ name: "a" }, { name: "b" }];
        fakeAdapter.createMany.mockResolvedValueOnce({ count: 2 });

        await repo.createMany(payload);

        expect(fakeAdapter.createMany.mock.calls[0]?.[0]).toBe(payload);
    });

    it("'createManyIgnoreConflicts' passa 'ignoreConflicts: true' nas options do adapter", async () => {
        const payload = [{ name: "a" }];
        fakeAdapter.createMany.mockResolvedValueOnce({ count: 1 });

        await repo.createManyIgnoreConflicts(payload);

        expect(fakeAdapter.createMany.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ ignoreConflicts: true }));
    });

    it("'createManyReturning' chama 'adapter.createManyReturning' (não 'adapter.createMany') com a lista recebida", async () => {
        const payload = [{ name: "a" }, { name: "b" }];
        const created = [
            { id: "1", name: "a" },
            { id: "2", name: "b" },
        ];
        fakeAdapter.createManyReturning.mockResolvedValueOnce(created);

        const result = await repo.createManyReturning(payload);

        expect(fakeAdapter.createManyReturning.mock.calls[0]?.[0]).toBe(payload);
        expect(fakeAdapter.createMany).not.toHaveBeenCalled();
        expect(result).toBe(created);
    });

    it("'createManyReturningIgnoreConflicts' passa 'ignoreConflicts: true' nas options de 'adapter.createManyReturning'", async () => {
        const payload = [{ name: "a" }];
        fakeAdapter.createManyReturning.mockResolvedValueOnce([{ id: "1", name: "a" }]);

        await repo.createManyReturningIgnoreConflicts(payload);

        expect(fakeAdapter.createManyReturning.mock.calls[0]?.[0]).toBe(payload);
        expect(fakeAdapter.createManyReturning.mock.calls[0]?.[1]).toEqual(
            expect.objectContaining({ ignoreConflicts: true }),
        );
    });
});

describe("prefixos de escrita — update/updateMany/updateManyReturning", () => {
    it("'updateByEmail' chama 'adapter.update' com (where resolvido, data)", async () => {
        const data = { name: "novo" };
        fakeAdapter.update.mockResolvedValueOnce({});

        await repo.updateByEmail("e@x.com", data);

        expect(fakeAdapter.update.mock.calls[0]?.[0]).toEqual({ email: "e@x.com" });
        expect(fakeAdapter.update.mock.calls[0]?.[1]).toBe(data);
    });

    it("'updateWhere' chama 'adapter.update' com (where explícito, data)", async () => {
        const data = { name: "novo" };
        fakeAdapter.update.mockResolvedValueOnce({});

        await repo.updateWhere({ id: "1" }, data);

        expect(fakeAdapter.update.mock.calls[0]?.[0]).toEqual({ id: "1" });
        expect(fakeAdapter.update.mock.calls[0]?.[1]).toBe(data);
    });

    it("'updateManyByActive' chama 'adapter.updateMany' com (where resolvido, data)", async () => {
        fakeAdapter.updateMany.mockResolvedValueOnce({ count: 2 });

        await repo.updateManyByActive(true, { active: false });

        expect(fakeAdapter.updateMany.mock.calls[0]?.[0]).toEqual({ active: true });
        expect(fakeAdapter.updateMany.mock.calls[0]?.[1]).toEqual({ active: false });
    });

    it("'updateManyWhere' chama 'adapter.updateMany' com (where explícito, data)", async () => {
        fakeAdapter.updateMany.mockResolvedValueOnce({ count: 2 });

        await repo.updateManyWhere({ active: true }, { active: false });

        expect(fakeAdapter.updateMany.mock.calls[0]?.[0]).toEqual({ active: true });
        expect(fakeAdapter.updateMany.mock.calls[0]?.[1]).toEqual({ active: false });
    });

    it("'updateManyReturningByActive' chama 'adapter.updateManyReturning' (não 'updateMany')", async () => {
        fakeAdapter.updateManyReturning.mockResolvedValueOnce([]);

        await repo.updateManyReturningByActive(true, { active: false });

        expect(fakeAdapter.updateManyReturning).toHaveBeenCalledTimes(1);
        expect(fakeAdapter.updateMany).not.toHaveBeenCalled();
        expect(fakeAdapter.updateManyReturning.mock.calls[0]?.[0]).toEqual({ active: true });
    });

    it("'updateManyReturningWhere' chama 'adapter.updateManyReturning' com where explícito", async () => {
        fakeAdapter.updateManyReturning.mockResolvedValueOnce([]);

        await repo.updateManyReturningWhere({ active: true }, { active: false });

        expect(fakeAdapter.updateManyReturning.mock.calls[0]?.[0]).toEqual({ active: true });
    });
});

describe("prefixos de escrita — upsert", () => {
    it("'upsertByEmail' chama 'adapter.upsert' com (where resolvido, create, update)", async () => {
        const createData = { email: "e@x.com" };
        const updateData = { name: "novo" };
        fakeAdapter.upsert.mockResolvedValueOnce({});

        await repo.upsertByEmail("e@x.com", createData, updateData);

        expect(fakeAdapter.upsert.mock.calls[0]?.[0]).toEqual({ email: "e@x.com" });
        expect(fakeAdapter.upsert.mock.calls[0]?.[1]).toBe(createData);
        expect(fakeAdapter.upsert.mock.calls[0]?.[2]).toBe(updateData);
    });

    it("'upsertWhere' chama 'adapter.upsert' com (where explícito, create, update)", async () => {
        const whereArg = { email: "e@x.com" };
        const createData = { email: "e@x.com" };
        const updateData = { name: "novo" };
        fakeAdapter.upsert.mockResolvedValueOnce({});

        await repo.upsertWhere(whereArg, createData, updateData);

        expect(fakeAdapter.upsert.mock.calls[0]?.[0]).toEqual(whereArg);
        expect(fakeAdapter.upsert.mock.calls[0]?.[1]).toBe(createData);
        expect(fakeAdapter.upsert.mock.calls[0]?.[2]).toBe(updateData);
    });
});

describe("prefixos de escrita — delete/deleteMany/deleteManyReturning", () => {
    it("'deleteByEmail' chama 'adapter.delete' com o 'where' resolvido do nome", async () => {
        fakeAdapter.delete.mockResolvedValueOnce({});
        await repo.deleteByEmail("e@x.com");
        expect(fakeAdapter.delete.mock.calls[0]?.[0]).toEqual({ email: "e@x.com" });
    });

    it("'deleteWhere' chama 'adapter.delete' com o 'where' passado explicitamente", async () => {
        fakeAdapter.delete.mockResolvedValueOnce({});
        await repo.deleteWhere({ id: "1" });
        expect(fakeAdapter.delete.mock.calls[0]?.[0]).toEqual({ id: "1" });
    });

    it("'deleteManyByActive' chama 'adapter.deleteMany'", async () => {
        fakeAdapter.deleteMany.mockResolvedValueOnce({ count: 1 });
        await repo.deleteManyByActive(false);
        expect(fakeAdapter.deleteMany.mock.calls[0]?.[0]).toEqual({ active: false });
    });

    it("'deleteManyWhere' chama 'adapter.deleteMany' com where explícito", async () => {
        fakeAdapter.deleteMany.mockResolvedValueOnce({ count: 1 });
        await repo.deleteManyWhere({ active: false });
        expect(fakeAdapter.deleteMany.mock.calls[0]?.[0]).toEqual({ active: false });
    });

    it("'deleteManyReturningByActive' chama 'adapter.deleteManyReturning' (não 'deleteMany') com o 'where' resolvido do nome", async () => {
        fakeAdapter.deleteManyReturning.mockResolvedValueOnce([]);
        await repo.deleteManyReturningByActive(false);
        expect(fakeAdapter.deleteManyReturning).toHaveBeenCalledTimes(1);
        expect(fakeAdapter.deleteMany).not.toHaveBeenCalled();
        expect(fakeAdapter.deleteManyReturning.mock.calls[0]?.[0]).toEqual({ active: false });
    });

    it("'deleteManyReturningWhere' chama 'adapter.deleteManyReturning' com where explícito", async () => {
        fakeAdapter.deleteManyReturning.mockResolvedValueOnce([]);
        await repo.deleteManyReturningWhere({ active: false });
        expect(fakeAdapter.deleteManyReturning.mock.calls[0]?.[0]).toEqual({ active: false });
    });
});

describe("prefixos de escrita/existência com múltiplos campos no 'where'", () => {
    it("'updateByEmailAndActive' chama 'adapter.update' com where multi-campo + data", async () => {
        const data = { name: "novo" };
        fakeAdapter.update.mockResolvedValueOnce({});

        await repo.updateByEmailAndActive("e@x.com", true, data);

        expect(fakeAdapter.update.mock.calls[0]?.[0]).toEqual({ email: "e@x.com", active: true });
        expect(fakeAdapter.update.mock.calls[0]?.[1]).toBe(data);
    });

    it("'deleteByEmailAndActive' chama 'adapter.delete' com where multi-campo", async () => {
        fakeAdapter.delete.mockResolvedValueOnce({});
        await repo.deleteByEmailAndActive("e@x.com", true);
        expect(fakeAdapter.delete.mock.calls[0]?.[0]).toEqual({ email: "e@x.com", active: true });
    });

    it("'existsByEmailAndActive' chama 'adapter.exists' com where multi-campo", async () => {
        fakeAdapter.exists.mockResolvedValueOnce(true);
        await repo.existsByEmailAndActive("e@x.com", true);
        expect(fakeAdapter.exists.mock.calls[0]?.[0]).toEqual({ email: "e@x.com", active: true });
    });

    it("'countByActiveAndEmailContains' chama 'adapter.count' com operador embutido em um dos campos", async () => {
        fakeAdapter.count.mockResolvedValueOnce(2);
        await repo.countByActiveAndEmailContains(true, "joao");
        expect(fakeAdapter.count.mock.calls[0]?.[0]).toEqual({ active: true, email: { contains: "joao" } });
    });

    it("'findOneOrThrowByEmailAndActive' chama 'adapter.findOneOrThrow' com where multi-campo", async () => {
        await repo.findOneOrThrowByEmailAndActive("e@x.com", true);
        expect(fakeAdapter.findOneOrThrow.mock.calls[0]?.[0]).toEqual({ email: "e@x.com", active: true });
    });

    it("'upsertByEmailAndName' chama 'adapter.upsert' com where multi-campo + create/update", async () => {
        const createData = { email: "e@x.com", name: "João" };
        const updateData = { name: "Novo" };
        fakeAdapter.upsert.mockResolvedValueOnce({});

        await repo.upsertByEmailAndName("e@x.com", "João", createData, updateData);

        expect(fakeAdapter.upsert.mock.calls[0]?.[0]).toEqual({ email: "e@x.com", name: "João" });
        expect(fakeAdapter.upsert.mock.calls[0]?.[1]).toBe(createData);
        expect(fakeAdapter.upsert.mock.calls[0]?.[2]).toBe(updateData);
    });
});

// =============================================================================
// Ordenação, paginação e distinct
// =============================================================================

describe("sufixos 'Paginated' / 'Ordered' e a ordem dos argumentos extras", () => {
    it("'findByActivePaginated' espera '(filtro, pagination)' e propaga em 'options.pagination'", async () => {
        await repo.findByActivePaginated(true, { limit: 10, offset: 0 });

        expect(where()).toEqual({ active: true });
        expect(fakeAdapter.findMany.mock.calls[0]?.[1]).toEqual(
            expect.objectContaining({ pagination: { limit: 10, offset: 0 } }),
        );
    });

    it("'findByActiveOrdered' espera '(filtro, order)' e propaga em 'options.order'", async () => {
        await repo.findByActiveOrdered(true, { createdAt: "desc" });

        expect(fakeAdapter.findMany.mock.calls[0]?.[1]).toEqual(
            expect.objectContaining({ order: { createdAt: "desc" } }),
        );
    });

    it("'findByActiveOrderedAndPaginated' espera '(filtro, order, pagination)' nessa ordem", async () => {
        await repo.findByActiveOrderedAndPaginated(true, { createdAt: "desc" }, { limit: 10, offset: 0 });

        expect(fakeAdapter.findMany.mock.calls[0]?.[1]).toEqual(
            expect.objectContaining({
                order: { createdAt: "desc" },
                pagination: { limit: 10, offset: 0 },
            }),
        );
    });

    it("'findByActivePaginatedAndOrdered' espera '(filtro, pagination, order)' — ordem invertida no nome, mesmo resultado final", async () => {
        await repo.findByActivePaginatedAndOrdered(true, { limit: 10, offset: 0 }, { createdAt: "desc" });

        expect(fakeAdapter.findMany.mock.calls[0]?.[1]).toEqual(
            expect.objectContaining({
                order: { createdAt: "desc" },
                pagination: { limit: 10, offset: 0 },
            }),
        );
    });
});

describe("sufixo 'OrderBy<Campo>[Asc|Desc]' — ordenação FIXA embutida no nome (sem argumento extra)", () => {
    it("'findByActiveOrderByCreatedAtDesc' só recebe o argumento do filtro; a ordenação vem fixa do nome", async () => {
        await repo.findByActiveOrderByCreatedAtDesc(true);

        expect(where()).toEqual({ active: true });
        expect(fakeAdapter.findMany.mock.calls[0]?.[1]).toEqual(
            expect.objectContaining({ order: [{ createdAt: "DESC" }] }),
        );
    });

    it("'findByActiveOrderByCreatedAtAscAndNameDesc' encadeia múltiplos campos de ordenação via 'And'", async () => {
        await repo.findByActiveOrderByCreatedAtAscAndNameDesc(true);

        expect(fakeAdapter.findMany.mock.calls[0]?.[1]).toEqual(
            expect.objectContaining({
                order: [{ createdAt: "ASC" }, { name: "DESC" }],
            }),
        );
    });
});

describe("sufixo 'Distinct<Campo>'", () => {
    it("'findByActiveDistinctName' propaga 'options.distinct' com o(s) campo(s) do nome", async () => {
        await repo.findByActiveDistinctName(true);

        expect(fakeAdapter.findMany.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ distinct: ["name"] }));
    });

    it("'findByActiveDistinctNameOrderByCreatedAtDesc' combina 'distinct' com ordenação fixa no mesmo nome", async () => {
        await repo.findByActiveDistinctNameOrderByCreatedAtDesc(true);

        expect(fakeAdapter.findMany.mock.calls[0]?.[1]).toEqual(
            expect.objectContaining({
                distinct: ["name"],
                order: [{ createdAt: "DESC" }],
            }),
        );
    });
});

describe("combinações extras de 'OrderBy<Campo>' fixo e 'Distinct'", () => {
    it("'findByActiveOrderByCreatedAt' sem 'Asc'/'Desc' -> ordenação fixa padrão 'ASC'", async () => {
        await repo.findByActiveOrderByCreatedAt(true);

        expect(where()).toEqual({ active: true });
        expect(fakeAdapter.findMany.mock.calls[0]?.[1]).toEqual(
            expect.objectContaining({ order: [{ createdAt: "ASC" }] }),
        );
    });

    it("'findByActiveOrderByCreatedAtDescAndNameAscAndEmailDesc' encadeia 3 campos de ordenação fixa", async () => {
        await repo.findByActiveOrderByCreatedAtDescAndNameAscAndEmailDesc(true);

        expect(fakeAdapter.findMany.mock.calls[0]?.[1]).toEqual(
            expect.objectContaining({
                order: [{ createdAt: "DESC" }, { name: "ASC" }, { email: "DESC" }],
            }),
        );
    });

    it("'findByActiveDistinctNameAndEmail' propaga 'distinct' com múltiplos campos", async () => {
        await repo.findByActiveDistinctNameAndEmail(true);

        expect(fakeAdapter.findMany.mock.calls[0]?.[1]).toEqual(
            expect.objectContaining({ distinct: ["name", "email"] }),
        );
    });

    it("'findByActiveDistinctNameAndEmailOrderByCreatedAtDesc' combina 'distinct' multi-campo com 'order' fixo", async () => {
        await repo.findByActiveDistinctNameAndEmailOrderByCreatedAtDesc(true);

        expect(fakeAdapter.findMany.mock.calls[0]?.[1]).toEqual(
            expect.objectContaining({
                distinct: ["name", "email"],
                order: [{ createdAt: "DESC" }],
            }),
        );
    });
});

describe("modifiers de ordenação/paginação/distinct nos prefixos 'Where' e 'count'", () => {
    it("'findWhereOrdered' propaga (where, order)", async () => {
        await repo.findWhereOrdered({ active: true }, { createdAt: "desc" });

        expect(fakeAdapter.findMany.mock.calls[0]?.[0]).toEqual({ active: true });
        expect(fakeAdapter.findMany.mock.calls[0]?.[1]).toEqual(
            expect.objectContaining({ order: { createdAt: "desc" } }),
        );
    });

    it("'findWherePaginated' propaga (where, pagination)", async () => {
        await repo.findWherePaginated({ active: true }, { limit: 10, offset: 0 });

        expect(fakeAdapter.findMany.mock.calls[0]?.[0]).toEqual({ active: true });
        expect(fakeAdapter.findMany.mock.calls[0]?.[1]).toEqual(
            expect.objectContaining({ pagination: { limit: 10, offset: 0 } }),
        );
    });

    it("'findWhereOrderedAndPaginated' propaga (where, order, pagination) em trio", async () => {
        await repo.findWhereOrderedAndPaginated({ active: true }, { createdAt: "desc" }, { limit: 10, offset: 0 });

        expect(fakeAdapter.findMany.mock.calls[0]?.[0]).toEqual({ active: true });
        expect(fakeAdapter.findMany.mock.calls[0]?.[1]).toEqual(
            expect.objectContaining({
                order: { createdAt: "desc" },
                pagination: { limit: 10, offset: 0 },
            }),
        );
    });

    it("'findWhereDistinctName' propaga (where) + 'distinct' derivado do sufixo do nome", async () => {
        await repo.findWhereDistinctName({ active: true });

        expect(fakeAdapter.findMany.mock.calls[0]?.[0]).toEqual({ active: true });
        expect(fakeAdapter.findMany.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ distinct: ["name"] }));
    });

    it("'findOneWhereOrdered' propaga (where, order) para 'adapter.findOne'", async () => {
        fakeAdapter.findOne.mockResolvedValueOnce(null);

        await repo.findOneWhereOrdered({ active: true }, { createdAt: "desc" });

        expect(fakeAdapter.findOne.mock.calls[0]?.[0]).toEqual({ active: true });
        expect(fakeAdapter.findOne.mock.calls[0]?.[1]).toEqual(
            expect.objectContaining({ order: { createdAt: "desc" } }),
        );
    });

    it("'countByActiveOrdered' propaga (where resolvido do nome, order)", async () => {
        fakeAdapter.count.mockResolvedValueOnce(4);

        await repo.countByActiveOrdered(true, { createdAt: "desc" });

        expect(fakeAdapter.count.mock.calls[0]?.[0]).toEqual({ active: true });
        expect(fakeAdapter.count.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ order: { createdAt: "desc" } }));
    });
});

// =============================================================================
// Options do decorator: 'proxyTo' e 'injectOrdering'
// =============================================================================

describe("option 'proxyTo' do decorator", () => {
    it("um nome de método fora do padrão (em português) resolve como se fosse o padrão apontado em 'proxyTo'", async () => {
        await repo.buscarPorEmail("e@x.com");

        expect(fakeAdapter.findMany).toHaveBeenCalledTimes(1);
        expect(where()).toEqual({ email: "e@x.com" });
    });
});

describe("option 'injectOrdering' do decorator", () => {
    it("injeta 'order' fixo sem precisar do sufixo 'OrderBy...' no nome nem de argumento extra", async () => {
        await repo.findByLikesVSRepo(true);

        expect(where()).toEqual({ likesVSRepo: true });
        expect(fakeAdapter.findMany.mock.calls[0]?.[1]).toEqual(
            expect.objectContaining({ order: { createdAt: "desc" } }),
        );
    });
});

// =============================================================================
// Contagem de argumentos — o parser calcula quantos parâmetros cada método
// dinâmico exige a partir do nome, e valida isso em runtime antes de montar
// o 'where'.
// =============================================================================

describe("validação de quantidade de argumentos", () => {
    it("rejeita quando faltam argumentos, citando o nome do campo que ficou sem valor", async () => {
        await expect((repo as any).findByName()).rejects.toThrow(/name/i);
    });

    it("rejeita quando faltam argumentos em um método com múltiplos campos (And)", async () => {
        await expect((repo as any).findOneByIdAndEmail("user-1")).rejects.toThrow(/email/i);
    });

    it("não rejeita métodos cujo sufixo dispensa argumento (IsNull/IsTrue/etc)", async () => {
        await expect(repo.findByEmailIsNull()).resolves.not.toThrow();
    });

    it("rejeita quando falta o argumento de um sub-filtro de relação (cita o campo da relação)", async () => {
        await expect((repo as any).findByProductsSomeNameContains()).rejects.toThrow(/products/i);
    });

    it("rejeita 'updateWhere' quando falta o 'data'", async () => {
        await expect((repo as any).updateWhere({ active: true })).rejects.toThrow(/data/i);
    });

    it("rejeita 'upsertByEmail' quando faltam 'create'/'update'", async () => {
        await expect((repo as any).upsertByEmail("e@x.com")).rejects.toThrow(/create/i);
    });

    it("'Optional' é só documental — continua rejeitando a chamada sem o argumento", async () => {
        await expect((repo as any).findByNameOptional()).rejects.toThrow(/name/i);
    });

    it("argumento extra é tratado como 'MethodOptions' e validado — valor inválido em 'see' rejeita com 'VSRepoError'", async () => {
        await expect((repo as any).findByName("João", { see: "nonsense" })).rejects.toThrow(VSRepoError);
    });
});

// =============================================================================
// Argumento extra além das options — o resolver normaliza a lista de
// argumentos para exatamente `argsCount + 1` posições antes de montá-la, e é
// sobre esse comprimento normalizado que os índices NEGATIVOS do parser
// (`dataIndex = -2`, `createIndex = -3`, `updateIndex = -2`,
// `orderPosition`/`paginationPosition` de `-2`/`-3`) são resolvidos por
// `Array.prototype.at()`. Sem a normalização, um argumento a mais desloca
// todos esses índices e o payload/`order`/`pagination`passam a ser lidos do
// objeto de options — que é truthy, então nem chega a sumir: ele vira o
// payload. Por isso os testes abaixo comparam os payloads por IDENTIDADE
// (`.toBe`) e contam os argumentos recebidos pelo adapter.
// =============================================================================

describe("argumento extra além das options não desloca os índices negativos do parser", () => {
    it("'updateByEmail' mantém o 'data' na posição '-2' e descarta o argumento extra", async () => {
        const data = { name: "novo" };
        fakeAdapter.update.mockResolvedValueOnce({});

        await repo.updateByEmail("e@x.com", data, { select: { name: true } }, "extra");

        expect(fakeAdapter.update).toHaveBeenCalledTimes(1);
        expect(fakeAdapter.update.mock.calls[0]).toHaveLength(3);
        expect(fakeAdapter.update.mock.calls[0]?.[0]).toEqual({ email: "e@x.com" });
        expect(fakeAdapter.update.mock.calls[0]?.[1]).toBe(data);
    });

    it("'updateWhere' mantém o 'data' na posição '-2' e descarta o argumento extra", async () => {
        const whereArg = { id: "1" };
        const data = { name: "novo" };
        fakeAdapter.update.mockResolvedValueOnce({});

        await repo.updateWhere(whereArg, data, { select: { name: true } }, "extra");

        expect(fakeAdapter.update.mock.calls[0]).toHaveLength(3);
        expect(fakeAdapter.update.mock.calls[0]?.[0]).toEqual(whereArg);
        expect(fakeAdapter.update.mock.calls[0]?.[1]).toBe(data);
    });

    it("'upsertByEmail' mantém 'create' em '-3' e 'update' em '-2' e descarta o argumento extra", async () => {
        const createData = { email: "e@x.com" };
        const updateData = { name: "novo" };
        fakeAdapter.upsert.mockResolvedValueOnce({});

        await repo.upsertByEmail("e@x.com", createData, updateData, { select: { name: true } }, "extra");

        expect(fakeAdapter.upsert.mock.calls[0]).toHaveLength(4);
        expect(fakeAdapter.upsert.mock.calls[0]?.[0]).toEqual({ email: "e@x.com" });
        expect(fakeAdapter.upsert.mock.calls[0]?.[1]).toBe(createData);
        expect(fakeAdapter.upsert.mock.calls[0]?.[2]).toBe(updateData);
    });

    it("'upsertWhere' mantém 'create' em '-3' e 'update' em '-2' e descarta o argumento extra", async () => {
        const whereArg = { email: "e@x.com" };
        const createData = { email: "e@x.com" };
        const updateData = { name: "novo" };
        fakeAdapter.upsert.mockResolvedValueOnce({});

        await repo.upsertWhere(whereArg, createData, updateData, { select: { name: true } }, "extra");

        expect(fakeAdapter.upsert.mock.calls[0]).toHaveLength(4);
        expect(fakeAdapter.upsert.mock.calls[0]?.[0]).toEqual(whereArg);
        expect(fakeAdapter.upsert.mock.calls[0]?.[1]).toBe(createData);
        expect(fakeAdapter.upsert.mock.calls[0]?.[2]).toBe(updateData);
    });

    it("'upsertByEmailAndName' (where de 2 campos) mantém 'create' em '-3' e 'update' em '-2'", async () => {
        const createData = { email: "e@x.com", name: "João" };
        const updateData = { name: "Novo" };
        fakeAdapter.upsert.mockResolvedValueOnce({});

        await repo.upsertByEmailAndName("e@x.com", "João", createData, updateData, { select: { name: true } }, "extra");

        expect(fakeAdapter.upsert.mock.calls[0]).toHaveLength(4);
        expect(fakeAdapter.upsert.mock.calls[0]?.[1]).toBe(createData);
        expect(fakeAdapter.upsert.mock.calls[0]?.[2]).toBe(updateData);
    });

    it("'findByActivePaginated' mantém a 'pagination' em '-2' e descarta o argumento extra", async () => {
        await repo.findByActivePaginated(true, { limit: 10, offset: 0 }, { select: { name: true } }, "extra");

        expect(where()).toEqual({ active: true });
        expect(fakeAdapter.findMany.mock.calls[0]).toHaveLength(2);
        expect(fakeAdapter.findMany.mock.calls[0]?.[1]).toEqual(
            expect.objectContaining({ pagination: { limit: 10, offset: 0 } }),
        );
    });

    it("'findByActiveOrdered' mantém o 'order' em '-2' e descarta o argumento extra", async () => {
        await repo.findByActiveOrdered(true, { createdAt: "desc" }, { select: { name: true } }, "extra");

        expect(where()).toEqual({ active: true });
        expect(fakeAdapter.findMany.mock.calls[0]?.[1]).toEqual(
            expect.objectContaining({ order: { createdAt: "desc" } }),
        );
    });

    it("'findByActiveOrderedAndPaginated' mantém 'order' em '-3' e 'pagination' em '-2'", async () => {
        await repo.findByActiveOrderedAndPaginated(
            true,
            { createdAt: "desc" },
            { limit: 10, offset: 0 },
            { select: { name: true } },
            "extra",
        );

        expect(fakeAdapter.findMany.mock.calls[0]?.[1]).toEqual(
            expect.objectContaining({
                order: { createdAt: "desc" },
                pagination: { limit: 10, offset: 0 },
            }),
        );
    });

    it("'findByActivePaginatedAndOrdered' mantém 'pagination' em '-3' e 'order' em '-2' (a ordem invertida no nome)", async () => {
        await repo.findByActivePaginatedAndOrdered(
            true,
            { limit: 10, offset: 0 },
            { createdAt: "desc" },
            { select: { name: true } },
            "extra",
        );

        expect(fakeAdapter.findMany.mock.calls[0]?.[1]).toEqual(
            expect.objectContaining({
                order: { createdAt: "desc" },
                pagination: { limit: 10, offset: 0 },
            }),
        );
    });

    it("'findWherePaginated' (whereIndex = 0) mantém a 'pagination' em '-2'", async () => {
        await repo.findWherePaginated({ active: true }, { limit: 10, offset: 0 }, { select: { name: true } }, "extra");

        expect(where()).toEqual({ active: true });
        expect(fakeAdapter.findMany.mock.calls[0]?.[1]).toEqual(
            expect.objectContaining({ pagination: { limit: 10, offset: 0 } }),
        );
    });

    it("'updateManyByActive' mantém o 'data' em '-2' e descarta o argumento extra", async () => {
        const data = { active: false };
        fakeAdapter.updateMany.mockResolvedValueOnce({ count: 2 });

        await repo.updateManyByActive(true, data, { select: { name: true } }, "extra");

        expect(fakeAdapter.updateMany.mock.calls[0]).toHaveLength(3);
        expect(fakeAdapter.updateMany.mock.calls[0]?.[0]).toEqual({ active: true });
        expect(fakeAdapter.updateMany.mock.calls[0]?.[1]).toBe(data);
    });
});
