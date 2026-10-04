import { VSRepoError } from "../../errors/VSRepoError.js";
import { VSRepoAdapter } from "../../VSRepoAdapter.js";
import { VSRepoErrorType } from "../enums/vsrepo-error-type.enum.js";
import { VSLogger } from "./vs-logger.util.js";
import { VSRawQueryBuilder } from "./vs-raw-query-builder.util.js";
import { VSSql } from "./vs-sql.util.js";

describe("VSRawQueryBuilder", () => {
    const db = { db: 100 };
    let adapter: VSRepoAdapter<any>;
    let logger: VSLogger;
    let qb: VSRawQueryBuilder;

    beforeEach(() => {
        adapter = { getPlaceholder: vi.fn(), query: vi.fn() } as any;
        logger = { logDebug: vi.fn(), startPerformLog: vi.fn(), endPerformLog: vi.fn() } as any;
        qb = new VSRawQueryBuilder(db, adapter, logger);
    });

    it("should be defined", () => {
        expect(qb).toBeDefined();
    });

    describe("select", () => {
        it("should return the same instance", () => {
            const result = qb.select("*");

            expect(result).toBe(qb);
        });

        it("should return a sql with the provided select", () => {
            const result = qb.select("id", "name").from("person").toSql();

            expect(result).toBe("SELECT id, name FROM person");
        });

        it("should use '*' by default", () => {
            const result = qb.select().from("person").toSql();

            expect(result).toBe("SELECT * FROM person");
        });

        it("should use '*' if not called", () => {
            const result = qb.from("person").toSql();

            expect(result).toBe("SELECT * FROM person");
        });

        it("should accept VSSql as columns", () => {
            const result = qb
                .select(VSSql.sql`id`, VSSql.sql`name as nome`)
                .from("person")
                .toSql();

            expect(result).toBe("SELECT id, name as nome FROM person");
        });

        it("should accept VSSql and strings mixed", () => {
            const result = qb
                .select("id", VSSql.sql`name as nome`)
                .from("person")
                .toSql();

            expect(result).toBe("SELECT id, name as nome FROM person");
        });

        it("should not throw if the provided VSSql is empty", () => {
            const result = qb.select(VSSql.empty).from("person").toSql();

            expect(result).toBe("SELECT  FROM person");
        });

        it("should replace any pre-existing select", () => {
            const result = qb.select("id").select("name").from("person").toSql();

            expect(result).toBe("SELECT name FROM person");
        });

        it("should throw if the provided string is empty", () => {
            let thrown: any;

            try {
                const _result = qb.select("").from("person");
                throw new Error("never");
            } catch (error) {
                thrown = error;
            }

            expect(thrown).toBeInstanceOf(VSRepoError);
            expect(thrown.type).toBe(VSRepoErrorType.QUERY_BUILDER);
        });

        it("should throw if some provided string is empty", () => {
            let thrown: any;

            try {
                const _result = qb.select("id", "name", "", VSSql.sql`age as idade`);
                throw new Error("never");
            } catch (error) {
                thrown = error;
            }

            expect(thrown).toBeInstanceOf(VSRepoError);
            expect(thrown.type).toBe(VSRepoErrorType.QUERY_BUILDER);
        });
    });

    describe("from", () => {
        it("should return the same instance", () => {
            const result = qb.from("person");

            expect(result).toBe(qb);
        });

        it("should return a sql with the provided table", () => {
            const result = qb.select("id").from("person").toSql();

            expect(result).toBe("SELECT id FROM person");
        });

        it("should return a sql with the provided table and alias", () => {
            const result = qb.select("p.id").from("person", "p").toSql();

            expect(result).toBe("SELECT p.id FROM person p");
        });

        it("should accept a VSSql as table", () => {
            const result = qb
                .select("p.id")
                .from(VSSql.sql`person`, "p")
                .toSql();

            expect(result).toBe("SELECT p.id FROM person p");
        });

        it("should accept an other VSRawQueryBuilder as table and enclose in parentheses", () => {
            const qb2 = new VSRawQueryBuilder(db, adapter, logger).from("person");

            const result = qb.select("p.id").from(qb2, "p").toSql();

            expect(result).toBe("SELECT p.id FROM (SELECT * FROM person) p");
        });

        it("should accept a subquery fn that returns a VSSql as table and enclose in parentheses", () => {
            const result = qb
                .select("p.id")
                .from(sub => sub.from("person").toVSSql(), "p")
                .toSql();

            expect(result).toBe("SELECT p.id FROM (SELECT * FROM person) p");
        });

        it("should accept a subquery fn that returns a VSRawQueryBuilder as table and enclose in parentheses", () => {
            const result = qb
                .select("p.id")
                .from(sub => sub.select("id").from("person"), "p")
                .toSql();

            expect(result).toBe("SELECT p.id FROM (SELECT id FROM person) p");
        });

        it("should throw if the provided table string is empty", () => {
            let thrown: any;

            try {
                const _result = qb.from("");
                throw new Error("never");
            } catch (error) {
                thrown = error;
            }

            expect(thrown).toBeInstanceOf(VSRepoError);
            expect(thrown.type).toBe(VSRepoErrorType.QUERY_BUILDER);
        });

        it("should throw if the provided alias string is empty", () => {
            let thrown: any;

            try {
                const _result = qb.from("person", "");
                throw new Error("never");
            } catch (error) {
                thrown = error;
            }

            expect(thrown).toBeInstanceOf(VSRepoError);
            expect(thrown.type).toBe(VSRepoErrorType.QUERY_BUILDER);
        });

        it("should replace any pre-existing from", () => {
            const result = qb.select("id").from("person", "p").from("user").toSql();

            expect(result).toBe("SELECT id FROM user");
        });
    });

    describe("where/andWhere/orWhere", () => {
        it.each([
            { method: (condition: string | VSSql) => qb.from("user").where(condition), methodName: "where" },
            { method: (condition: string | VSSql) => qb.from("user").andWhere(condition), methodName: "andWhere" },
            { method: (condition: string | VSSql) => qb.from("user").orWhere(condition), methodName: "orWhere" },
        ])("$methodName should initialize the where condition, if it's the first called", ({ method }) => {
            const result = method("deleted_at is null").toSql();

            expect(result).toBe("SELECT * FROM user WHERE (deleted_at is null)");
        });

        it.each([
            { method: (condition: string | VSSql) => qb.from("user").where(condition), methodName: "where" },
            { method: (condition: string | VSSql) => qb.from("user").andWhere(condition), methodName: "andWhere" },
            { method: (condition: string | VSSql) => qb.from("user").orWhere(condition), methodName: "orWhere" },
        ])("$methodName should accept VSSql as condition", ({ method }) => {
            const result = method(VSSql.sql`deleted_at is null`).toSql();

            expect(result).toBe("SELECT * FROM user WHERE (deleted_at is null)");
        });

        it("should combine the conditions with 'AND'", () => {
            const result = qb
                .from("user")
                .where("deleted_at is null")
                .andWhere(VSSql.sql`active = true`)
                .toSql();

            expect(result).toBe("SELECT * FROM user WHERE (deleted_at is null) AND (active = true)");
        });

        it("should combine the conditions with 'OR'", () => {
            const result = qb
                .from("user")
                .where("deleted_at is null")
                .orWhere(VSSql.sql`active = true`)
                .toSql();

            expect(result).toBe("SELECT * FROM user WHERE (deleted_at is null) OR (active = true)");
        });

        it("should correct return a VSSql parametrized", () => {
            const result = qb
                .from("user")
                .where("deleted_at is null")
                .orWhere(VSSql.sql`active = ${true}`)
                .andWhere(VSSql.sql`email like ${"%@vs.com"}`)
                .toVSSql()
                .compile();

            expect(result.text).toBe(
                "SELECT * FROM user WHERE (deleted_at is null) OR (active = ?1) AND (email like ?2)",
            );
            expect(result.args).toEqual([true, "%@vs.com"]);
        });

        it.each([
            { method: (condition: string | VSSql) => qb.from("user").where(condition), methodName: "where" },
            { method: (condition: string | VSSql) => qb.from("user").andWhere(condition), methodName: "andWhere" },
            { method: (condition: string | VSSql) => qb.from("user").orWhere(condition), methodName: "orWhere" },
        ])("$methodName should throw if the provided condition string is empty", ({ method }) => {
            let thrown: any;

            try {
                const _result = method("");
                throw new Error("never");
            } catch (error) {
                thrown = error;
            }

            expect(thrown).toBeInstanceOf(VSRepoError);
            expect(thrown.type).toBe(VSRepoErrorType.QUERY_BUILDER);
        });
    });

    describe("groupBy/having/andHaving/orHaving", () => {
        it("should return a sql with the provided group by", () => {
            const result = qb.from("user").groupBy("name").toSql();

            expect(result).toBe("SELECT * FROM user GROUP BY name");
        });

        it("should accept string and VSSql as columns", () => {
            const result = qb
                .from("user")
                .groupBy("name", VSSql.sql`age`)
                .toSql();

            expect(result).toBe("SELECT * FROM user GROUP BY name, age");
        });

        it("should not replace a pre-existing group by", () => {
            const result = qb
                .from("user")
                .groupBy("name")
                .groupBy(VSSql.sql`age`)
                .toSql();

            expect(result).toBe("SELECT * FROM user GROUP BY name, age");
        });

        it("should not modify the sql if no columns are provided", () => {
            const result = qb.from("user").groupBy().toSql();

            expect(result).toBe("SELECT * FROM user");
        });

        it("should throw if some provided column string is empty", () => {
            let thrown: any;

            try {
                const _result = qb.groupBy("name", "");
                throw new Error("never");
            } catch (error) {
                thrown = error;
            }

            expect(thrown).toBeInstanceOf(VSRepoError);
            expect(thrown.type).toBe(VSRepoErrorType.QUERY_BUILDER);
        });

        it.each([
            {
                method: (condition: string | VSSql) =>
                    qb
                        .from("user")
                        .groupBy(VSSql.sql`age`)
                        .having(condition),
                methodName: "having",
            },
            {
                method: (condition: string | VSSql) =>
                    qb
                        .from("user")
                        .groupBy(VSSql.sql`age`)
                        .andHaving(condition),
                methodName: "andHaving",
            },
            {
                method: (condition: string | VSSql) =>
                    qb
                        .from("user")
                        .groupBy(VSSql.sql`age`)
                        .orHaving(condition),
                methodName: "orHaving",
            },
        ])("$methodName shold initialize de 'having' condition", ({ method }) => {
            const result = method("age > 18").toSql();

            expect(result).toBe("SELECT * FROM user GROUP BY age HAVING (age > 18)");
        });

        it("should combine the conditions with 'AND'", () => {
            const result = qb
                .from("user")
                .groupBy("name", VSSql.sql`age`)
                .having("name <> 'João'")
                .andHaving(VSSql.sql`age > 18`)
                .toSql();

            expect(result).toBe("SELECT * FROM user GROUP BY name, age HAVING (name <> 'João') AND (age > 18)");
        });

        it("should combine the conditions with 'OR'", () => {
            const result = qb
                .from("user")
                .groupBy("name", VSSql.sql`age`)
                .having("name <> 'João'")
                .orHaving(VSSql.sql`age > 18`)
                .toSql();

            expect(result).toBe("SELECT * FROM user GROUP BY name, age HAVING (name <> 'João') OR (age > 18)");
        });

        it.each([
            { method: (condition: string | VSSql) => qb.from("user").having(condition), methodName: "having" },
            { method: (condition: string | VSSql) => qb.from("user").andHaving(condition), methodName: "andHaving" },
            { method: (condition: string | VSSql) => qb.from("user").orHaving(condition), methodName: "orHaving" },
        ])("$methodName should throw if the provided condition string is empty", ({ method }) => {
            let thrown: any;

            try {
                const _result = method("");
                throw new Error("never");
            } catch (error) {
                thrown = error;
            }

            expect(thrown).toBeInstanceOf(VSRepoError);
            expect(thrown.type).toBe(VSRepoErrorType.QUERY_BUILDER);
        });

        it("should correct return a VSSql parametrized", () => {
            const result = qb
                .from("user")
                .groupBy("name", VSSql.sql`age`)
                .having(VSSql.sql`name <> ${"João"}`)
                .orHaving(VSSql.sql`age > ${18}`)
                .toVSSql()
                .compile();

            expect(result.text).toBe("SELECT * FROM user GROUP BY name, age HAVING (name <> ?1) OR (age > ?2)");
            expect(result.args).toEqual(["João", 18]);
        });
    });

    describe("orderBy", () => {
        it("should return a sql with de provided order", () => {
            const result = qb.from("user").orderBy("id", "ASC").toSql();

            expect(result).toBe("SELECT * FROM user ORDER BY id ASC");
        });

        it("should work with no direction provided", () => {
            const result = qb.from("user").orderBy("id").toSql();

            expect(result).toBe("SELECT * FROM user ORDER BY id");
        });

        it("should accept VSSql as column", () => {
            const result = qb
                .from("user")
                .orderBy(VSSql.sql`id`, "DESC")
                .toSql();

            expect(result).toBe("SELECT * FROM user ORDER BY id DESC");
        });

        it.each([
            { direction: "asc", uppercased: "ASC" },
            { direction: "desc", uppercased: "DESC" },
        ] as const)("should convert $direction to $uppercased", ({ direction, uppercased }) => {
            const result = qb
                .from("user")
                .orderBy(VSSql.sql`id`, direction)
                .toSql();

            expect(result).toBe(`SELECT * FROM user ORDER BY id ${uppercased}`);
        });

        it("should throw VSRepoError with type VSRepoErrorType.QUERY_BUILDER", () => {
            let thrown: any;

            try {
                const _result = qb.orderBy("");
                throw new Error("never");
            } catch (error) {
                thrown = error;
            }

            expect(thrown).toBeInstanceOf(VSRepoError);
            expect(thrown.type).toBe(VSRepoErrorType.QUERY_BUILDER);
        });

        it("should combine with an pre-existing orderBy", () => {
            const result = qb
                .from("user")
                .orderBy("name")
                .orderBy(VSSql.sql`id`, "DESC")
                .orderBy(VSSql.sql`age`)
                .toSql();

            expect(result).toBe("SELECT * FROM user ORDER BY name, id DESC, age");
        });

        it("should accept OrderTuple array as the first param", () => {
            const result = qb
                .from("user")
                .orderBy([["name", "asc"], [VSSql.sql`id`, "DESC"], [VSSql.sql`age`]])
                .toSql();

            expect(result).toBe("SELECT * FROM user ORDER BY name ASC, id DESC, age");
        });
    });

    describe("limit/offset", () => {
        it.each([
            { name: "LIMIT", method: (param: number) => qb.from("user").limit(param) },
            { name: "OFFSET", method: (param: number) => qb.from("user").offset(param) },
        ])("should set the provided param as $name", ({ method, name }) => {
            const result = method(10).toVSSql().compile();

            expect(result.text).toBe(`SELECT * FROM user ${name} ?1`);
            expect(result.args).toEqual([10]);
        });

        it.each([
            { name: "LIMIT", method: (param: number) => qb.from("user").limit(20).limit(30).limit(param) },
            { name: "OFFSET", method: (param: number) => qb.from("user").offset(20).offset(30).offset(param) },
        ])("should replace any pre-existing $name", ({ method, name }) => {
            const result = method(10).toVSSql().compile();

            expect(result.text).toBe(`SELECT * FROM user ${name} ?1`);
            expect(result.args).toEqual([10]);
        });

        it.each([
            { name: "LIMIT", method: (param: number) => qb.from("user").limit(param) },
            { name: "OFFSET", method: (param: number) => qb.from("user").offset(param) },
        ])("should throw if the provided $name is not integer", ({ method }) => {
            let thrown: any;

            try {
                const _result = method(10.5);
                throw new Error("never");
            } catch (error) {
                thrown = error;
            }

            expect(thrown).toBeInstanceOf(VSRepoError);
            expect(thrown.type).toBe(VSRepoErrorType.QUERY_BUILDER);
        });

        it.each([
            { name: "LIMIT", method: (param: number) => qb.from("user").limit(param) },
            { name: "OFFSET", method: (param: number) => qb.from("user").offset(param) },
        ])("should throw if the provided $name is negative", ({ method }) => {
            let thrown: any;

            try {
                const _result = method(-5);
                throw new Error("never");
            } catch (error) {
                thrown = error;
            }

            expect(thrown).toBeInstanceOf(VSRepoError);
            expect(thrown.type).toBe(VSRepoErrorType.QUERY_BUILDER);
        });

        it("should combine LIMIT with OFFSET if both are provided", () => {
            const result = qb.from("user").limit(20).offset(40).toVSSql().compile();

            expect(result.text).toBe(`SELECT * FROM user LIMIT ?1 OFFSET ?2`);
            expect(result.args).toEqual([20, 40]);
        });

        it("should ignore the order LIMIT and OFFSET are provided", () => {
            const result = qb.from("user").offset(40).limit(20).toVSSql().compile();

            expect(result.text).toBe(`SELECT * FROM user LIMIT ?1 OFFSET ?2`);
            expect(result.args).toEqual([20, 40]);
        });
    });
});
