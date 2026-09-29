// Testes de herança entre repositories que usam `@DynamicMethod`/`@QueryMethod`.
//
// Os decorators guardam a lista de métodos declarados via `Reflect.defineMetadata`
// no protótipo da classe. `Reflect.getMetadata` sobe a cadeia de protótipos, então,
// se o decorator alterasse o array que ele lê, a subclasse acabaria empurrando os
// seus métodos para o MESMO array do pai (e de todas as classes irmãs). Aqui
// travamos o contrato esperado:
//   - a subclasse herda os métodos do pai;
//   - o pai (e as irmãs) NÃO recebem os métodos declarados na subclasse.

import "reflect-metadata";
import { describe, it, expect, beforeEach } from "@jest/globals";
import { VSRepository } from "../../src/VSRepository";
import { VSRepoAdapter } from "../../src/VSRepoAdapter";
import { DynamicMethod } from "../../src/decorators/dynamic-method.decorator";
import { QueryMethod } from "../../src/decorators/query-method.decorator";
import { DYNAMIC_METHODS_KEY } from "../../src/internal/constants/dynamic-methods-key.constant";
import { QUERY_METHODS_KEY } from "../../src/internal/constants/query-methods-key.constant";
import { VSLogLevel } from "../../src/internal/enums/vs-log-level.enum";
import { QueryMethodArg } from "../../src/types/utils/query-method-arg.type";
import { createFakeAdapter } from "../helpers/fake-adapter";
import { User, buildUser } from "../helpers/entities";

class BaseUserRepository extends VSRepository<User, string> {
    constructor(adapter: VSRepoAdapter<User>) {
        super({ adapter, pkName: "id", logLevel: VSLogLevel.ERROR });
    }

    @DynamicMethod()
    declare findByEmail: (email: string) => Promise<User[]>;

    @DynamicMethod<User>({ injectOrdering: { createdAt: "asc" } })
    declare findByActiveIsTrue: () => Promise<User[]>;

    @QueryMethod('SELECT * FROM "user" WHERE email = $1')
    declare findByEmailRaw: (arg: QueryMethodArg<[email: string]>) => Promise<User[]>;
}

// Duas irmãs, cada uma com métodos próprios — e, entre elas, nenhuma pode enxergar a outra.
class AdminUserRepository extends BaseUserRepository {
    @DynamicMethod()
    declare findByUserType: (userType: string) => Promise<User[]>;

    @QueryMethod('SELECT * FROM "user" WHERE "userType" = $1')
    declare findByUserTypeRaw: (arg: QueryMethodArg<[userType: string]>) => Promise<User[]>;

    // Redeclara um método do pai com outras options: a do filho deve prevalecer nele.
    @DynamicMethod<User>({ injectOrdering: { createdAt: "desc" } })
    declare findByActiveIsTrue: () => Promise<User[]>;
}

class GuestUserRepository extends BaseUserRepository {
    @DynamicMethod()
    declare findByName: (name: string) => Promise<User[]>;

    @QueryMethod('SELECT * FROM "user" WHERE name = $1')
    declare findByNameRaw: (arg: QueryMethodArg<[name: string]>) => Promise<User[]>;
}

// Sem nenhum decorator próprio: tudo o que ela tem vem do pai.
class PlainUserRepository extends BaseUserRepository {}

// Neto: herda do pai, do avô, e ainda declara os seus.
class SuperAdminUserRepository extends AdminUserRepository {
    @DynamicMethod()
    declare findByBalance: (balance: number) => Promise<User[]>;
}

let fakeAdapter: jest.Mocked<VSRepoAdapter<User>>;

beforeEach(() => {
    fakeAdapter = createFakeAdapter<User>();
});

const keysOf = (metadataKey: symbol, ctor: new (...args: any[]) => object) =>
    (Reflect.getMetadata(metadataKey, ctor.prototype) as { propertyKey: string }[]).map(m => m.propertyKey).sort();

describe("@DynamicMethod — herança", () => {
    it("a classe pai não recebe os métodos dinâmicos declarados na subclasse", () => {
        const repo = new BaseUserRepository(fakeAdapter) as any;

        expect(repo.findByEmail).toBeInstanceOf(Function);
        expect(repo.findByUserType).toBeUndefined();
        expect(repo.findByName).toBeUndefined();
        expect(repo.findByBalance).toBeUndefined();
    });

    it("a metadata do pai continua com apenas os métodos declarados nele", () => {
        expect(keysOf(DYNAMIC_METHODS_KEY, BaseUserRepository)).toEqual(["findByActiveIsTrue", "findByEmail"]);
    });

    it("classes irmãs não enxergam os métodos dinâmicos uma da outra", () => {
        const admin = new AdminUserRepository(fakeAdapter) as any;
        const guest = new GuestUserRepository(fakeAdapter) as any;

        expect(admin.findByUserType).toBeInstanceOf(Function);
        expect(admin.findByName).toBeUndefined();

        expect(guest.findByName).toBeInstanceOf(Function);
        expect(guest.findByUserType).toBeUndefined();
    });

    it("a subclasse herda os métodos do pai e continua resolvendo os próprios", async () => {
        const repo = new AdminUserRepository(fakeAdapter);
        fakeAdapter.findMany.mockResolvedValue([buildUser()]);

        await repo.findByEmail("joao@email.com");
        await repo.findByUserType("ADMIN");

        expect(fakeAdapter.findMany.mock.calls[0]?.[0]).toEqual({ email: "joao@email.com" });
        expect(fakeAdapter.findMany.mock.calls[1]?.[0]).toEqual({ userType: "ADMIN" });
    });

    it("uma subclasse sem decorators próprios herda todos os métodos do pai", async () => {
        const repo = new PlainUserRepository(fakeAdapter);
        fakeAdapter.findMany.mockResolvedValueOnce([buildUser()]);

        await repo.findByEmail("joao@email.com");

        expect(fakeAdapter.findMany.mock.calls[0]?.[0]).toEqual({ email: "joao@email.com" });
        expect(keysOf(DYNAMIC_METHODS_KEY, PlainUserRepository)).toEqual(["findByActiveIsTrue", "findByEmail"]);
    });

    it("herda em múltiplos níveis (avô -> pai -> neto), sem alterar nenhum ancestral", async () => {
        const repo = new SuperAdminUserRepository(fakeAdapter);
        fakeAdapter.findMany.mockResolvedValue([]);

        await repo.findByEmail("joao@email.com");
        await repo.findByUserType("ADMIN");
        await repo.findByBalance(10);

        expect(fakeAdapter.findMany.mock.calls.map(call => call[0])).toEqual([
            { email: "joao@email.com" },
            { userType: "ADMIN" },
            { balance: 10 },
        ]);

        // O pai direto não ganhou o método do neto, e o avô não ganhou nenhum dos dois.
        expect((new AdminUserRepository(fakeAdapter) as any).findByBalance).toBeUndefined();
        expect((new BaseUserRepository(fakeAdapter) as any).findByBalance).toBeUndefined();
        expect((new BaseUserRepository(fakeAdapter) as any).findByUserType).toBeUndefined();
    });

    it("redeclarar um método do pai faz as options do filho prevalecerem só no filho", async () => {
        fakeAdapter.findMany.mockResolvedValue([]);

        await new AdminUserRepository(fakeAdapter).findByActiveIsTrue();
        await new BaseUserRepository(fakeAdapter).findByActiveIsTrue();

        expect(fakeAdapter.findMany.mock.calls[0]?.[1]?.order).toEqual({ createdAt: "desc" });
        expect(fakeAdapter.findMany.mock.calls[1]?.[1]?.order).toEqual({ createdAt: "asc" });
    });
});

describe("@QueryMethod — herança", () => {
    it("a classe pai não recebe os query methods declarados na subclasse", () => {
        const repo = new BaseUserRepository(fakeAdapter) as any;

        expect(repo.findByEmailRaw).toBeInstanceOf(Function);
        expect(repo.findByUserTypeRaw).toBeUndefined();
        expect(repo.findByNameRaw).toBeUndefined();
    });

    it("a metadata do pai continua com apenas os query methods declarados nele", () => {
        expect(keysOf(QUERY_METHODS_KEY, BaseUserRepository)).toEqual(["findByEmailRaw"]);
    });

    it("classes irmãs não enxergam os query methods uma da outra", () => {
        const admin = new AdminUserRepository(fakeAdapter) as any;
        const guest = new GuestUserRepository(fakeAdapter) as any;

        expect(admin.findByUserTypeRaw).toBeInstanceOf(Function);
        expect(admin.findByNameRaw).toBeUndefined();

        expect(guest.findByNameRaw).toBeInstanceOf(Function);
        expect(guest.findByUserTypeRaw).toBeUndefined();
    });

    it("a subclasse herda os query methods do pai e continua resolvendo os próprios", async () => {
        const repo = new AdminUserRepository(fakeAdapter);
        fakeAdapter.query.mockResolvedValue([]);

        await repo.findByEmailRaw({ args: ["joao@email.com"] });
        await repo.findByUserTypeRaw({ args: ["ADMIN"] });

        expect(fakeAdapter.query).toHaveBeenNthCalledWith(
            1,
            'SELECT * FROM "user" WHERE email = $1',
            expect.objectContaining({ args: ["joao@email.com"] }),
        );
        expect(fakeAdapter.query).toHaveBeenNthCalledWith(
            2,
            'SELECT * FROM "user" WHERE "userType" = $1',
            expect.objectContaining({ args: ["ADMIN"] }),
        );
    });

    it("uma subclasse sem decorators próprios herda todos os query methods do pai", async () => {
        const repo = new PlainUserRepository(fakeAdapter);
        fakeAdapter.query.mockResolvedValueOnce([]);

        await repo.findByEmailRaw({ args: ["joao@email.com"] });

        expect(fakeAdapter.query).toHaveBeenCalledWith(
            'SELECT * FROM "user" WHERE email = $1',
            expect.objectContaining({ args: ["joao@email.com"] }),
        );
    });
});
