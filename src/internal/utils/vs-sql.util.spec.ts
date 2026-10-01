import { randomBytes, randomInt } from "node:crypto";
import { getSqlitePlaceholder } from "./placeholder-fns.util.js";
import { VSSql } from "./vs-sql.util.js";
import { GetPlaceholderFn } from "../../types/utils/get-placeholder-fn.type.js";
import { VSRepoErrorType } from "../enums/vsrepo-error-type.enum.js";
import { VSRepoError } from "../../errors/VSRepoError.js";

describe("VSSql", () => {
    describe("sql", () => {
        it("should return an instance of VSSql", () => {
            const result = VSSql.sql`select * from person`;

            expect(result).toBeInstanceOf(VSSql);
        });

        it("should compile a fragment to a sql string with no args", () => {
            const fragment = VSSql.sql`select * from person`;

            const result = fragment.compile();

            expect(result.text).toBe("select * from person");
            expect(result.args).toEqual([]);
        });

        it("should compile a fragment to a sql string with the provided arg", () => {
            const id = crypto.randomUUID();

            const fragment = VSSql.sql`select * from person where id = ${id}`;

            const result = fragment.compile();

            expect(result.text).toBe("select * from person where id = ?1");
            expect(result.args).toEqual([id]);
        });

        it("should compile a fragment to a sql string with the provided multiple args", () => {
            const id = crypto.randomUUID();
            const name = "Joao";

            const fragment = VSSql.sql`select * from person where id = ${id} and name = ${name}`;

            const result = fragment.compile();

            expect(result.text).toBe("select * from person where id = ?1 and name = ?2");
            expect(result.args).toEqual([id, name]);
        });

        it("should work with no-based placeholders", () => {
            const id = crypto.randomUUID();
            const name = "Joao";

            const fragment = VSSql.sql`select * from person where id = ${id} and name = ${name}`;

            const result = fragment.compile(getSqlitePlaceholder);

            expect(result.text).toBe("select * from person where id = ? and name = ?");
            expect(result.args).toEqual([id, name]);
        });

        it("should work with any custom GetPlaceholderFn", () => {
            const someIdentifier = randomBytes(1).toString("hex");
            const someBase = randomInt(0, 5);
            const anyCustomFn: GetPlaceholderFn = index => `${someIdentifier}-${index + someBase}`;

            const id = crypto.randomUUID();
            const name = "Joao";

            const fragment = VSSql.sql`select * from person where id = ${id} and name = ${name}`;

            const result = fragment.compile(anyCustomFn);

            expect(result.text).toBe(
                `select * from person where id = ${someIdentifier + "-" + someBase} and name = ${someIdentifier + "-" + (someBase + 1)}`,
            );
            expect(result.args).toEqual([id, name]);
        });

        it("should work with deep nested VSSqls", () => {
            const id = crypto.randomUUID();
            const name = "Joao";
            const lastname = "Junior";
            const otherName = "Pedro";
            const date = new Date();
            const condition1 = VSSql.sql`(id = ${id} and ${VSSql.sql`name = ${name}`})`;
            const condition2 = VSSql.sql`(${VSSql.sql`lastname = ${lastname} and ${VSSql.sql`age >= ${18}`}`} and ${VSSql.sql`name <> ${otherName}`})`;

            const fragment = VSSql.sql`select * from person where deleted_at = ${date} and (${condition1} or ${condition2}) and status = ${true}`;

            const result = fragment.compile();

            expect(result.text).toBe(
                "select * from person where deleted_at = ?1 and ((id = ?2 and name = ?3) or (lastname = ?4 and age >= ?5 and name <> ?6)) and status = ?7",
            );
            expect(result.args).toEqual([date, id, name, lastname, 18, otherName, true]);
        });

        it("should return an empty sql", () => {
            const result = VSSql.sql``.compile();

            expect(result.text).toBe("");
            expect(result.args).toEqual([]);
        });

        it("should preserve falsy values as args", () => {
            const fragment = VSSql.sql`where a = ${0} and b = ${false} and c = ${""} and d = ${null}`;

            const result = fragment.compile();

            expect(result.text).toBe("where a = ?1 and b = ?2 and c = ?3 and d = ?4");
            expect(result.args).toEqual([0, false, "", null]);
        });
    });

    describe("raw", () => {
        it("should compile an sql with no placeholders", () => {
            const id = crypto.randomUUID();

            const result = VSSql.raw(id).compile();

            expect(result.text).toBe(id);
            expect(result.args).toEqual([]);
        });

        it("should be injected into a sql", () => {
            const table = "person";

            const fragment = VSSql.sql`select * from ${VSSql.raw(table)}`;

            const result = fragment.compile();

            expect(result.text).toBe(`select * from ${table}`);
            expect(result.args).toEqual([]);
        });

        it("should throw VSRepoError with type VSRepoErrorType.VSSQL", () => {
            try {
                const _test = VSSql.raw(1 as any);
                throw new Error("never");
            } catch (error: any) {
                expect(error).toBeInstanceOf(VSRepoError);
                expect(error.type).toBe(VSRepoErrorType.VSSQL);
            }
        });
    });

    describe("empty", () => {
        it("should compile to an empty sql", () => {
            const result = VSSql.empty.compile();

            expect(result.text).toBe("");
            expect(result.args).toEqual([]);
        });

        it("should not modify a sql", () => {
            const fragment = VSSql.sql`select * from person where id = ${1}${VSSql.empty}`;

            const result = fragment.compile();

            expect(result.text).toBe(`select * from person where id = ?1`);
            expect(result.args).toEqual([1]);
        });
    });

    describe("join", () => {
        it("should join the provided values", () => {
            const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];

            const fragment = VSSql.join(ids);

            const result = fragment.compile();

            expect(result.text).toBe("?1, ?2, ?3");
            expect(result.args).toEqual(ids);
        });

        it("should join the provided values and correctly used in an existing VSSql", () => {
            const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];

            const fragment = VSSql.sql`select * from person where status = ${true} and id in (${VSSql.join(ids)})`;

            const result = fragment.compile();

            expect(result.text).toBe("select * from person where status = ?1 and id in (?2, ?3, ?4)");
            expect(result.args).toEqual([true, ...ids]);
        });

        it("should join the provided values with the provided separator, prefix and sufix", () => {
            const id = crypto.randomUUID();

            const fragment = VSSql.sql`select * from person where status = ${true} or ${VSSql.join([VSSql.sql`deleted_at is null`, VSSql.sql`id = ${id}`], " and ", "(", ")")}`;

            const result = fragment.compile();

            expect(result.text).toBe("select * from person where status = ?1 or (deleted_at is null and id = ?2)");
            expect(result.args).toEqual([true, id]);
        });

        it("should refuse an empty array throwing VSRepoError with type VSRepoErrorType.VSSQL", () => {
            try {
                const _test = VSSql.join([]);
                throw new Error("never");
            } catch (error: any) {
                expect(error).toBeInstanceOf(VSRepoError);
                expect(error.type).toBe(VSRepoErrorType.VSSQL);
            }
        });

        it("should refuse an invalid array throwing VSRepoError with type VSRepoErrorType.VSSQL", () => {
            try {
                const _test = VSSql.join(1 as any);
                throw new Error("never");
            } catch (error: any) {
                expect(error).toBeInstanceOf(VSRepoError);
                expect(error.type).toBe(VSRepoErrorType.VSSQL);
            }
        });
    });
});
