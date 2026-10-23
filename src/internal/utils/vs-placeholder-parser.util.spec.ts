import { VSRepoError } from "../../errors/VSRepoError.js";
import { VSRepoErrorType } from "../enums/vsrepo-error-type.enum.js";
import { getSqlitePlaceholder } from "./placeholder-fns.util.js";
import { VSPlaceholdersParser } from "./vs-placeholder-parser.util.js";
import { VSSql } from "./vs-sql.util.js";

describe("VSPlaceholdersParser", () => {
    describe("parse", () => {
        it("should return a VSSql", () => {
            const result = VSPlaceholdersParser.parse("select * from person where id = ?1", [2]);

            expect(result).toBeInstanceOf(VSSql);
        });

        it("should correctly find the placeholders", () => {
            const result = VSPlaceholdersParser.parse("select * from person where id = ?1", [2]);

            expect(result.compile(getSqlitePlaceholder)).toEqual({
                query: "select * from person where id = ?",
                args: [2],
            });
        });

        it("should not throw if the query has no placeholders", () => {
            const result = VSPlaceholdersParser.parse("select * from person");

            expect(result.compile(getSqlitePlaceholder)).toEqual({
                query: "select * from person",
                args: [],
            });
        });

        it("should not indentify a placeholder if it's on a string literal", () => {
            const result = VSPlaceholdersParser.parse(
                "select * from person where id = ?1 and descricao = 'hello ?2 person'",
                [1],
            );

            expect(result.compile(getSqlitePlaceholder)).toEqual({
                query: "select * from person where id = ? and descricao = 'hello ?2 person'",
                args: [1],
            });
        });

        it("should respect the '' escape", () => {
            const result = VSPlaceholdersParser.parse(
                "select * from person where id = ?1 and descricao = 'hello ?2 person''s'",
                [1],
            );

            expect(result.compile(getSqlitePlaceholder)).toEqual({
                query: "select * from person where id = ? and descricao = 'hello ?2 person''s'",
                args: [1],
            });
        });

        it("should throw if no args were provided", () => {
            let thrown: any;

            try {
                VSPlaceholdersParser.parse("select * from person where id = ?1", []);
            } catch (err) {
                thrown = err;
            }

            expect(thrown).toBeInstanceOf(VSRepoError);
            expect(thrown.type).toBe(VSRepoErrorType.VS_PLACEHOLDERS);
        });

        it("should throw if the position is lower than 1", () => {
            let thrown: any;

            try {
                VSPlaceholdersParser.parse("select * from person where id = ?0", [2]);
            } catch (err) {
                thrown = err;
            }

            expect(thrown).toBeInstanceOf(VSRepoError);
            expect(thrown.type).toBe(VSRepoErrorType.VS_PLACEHOLDERS);
        });

        it("should throw if an invalid position was provided", () => {
            let thrown: any;

            try {
                VSPlaceholdersParser.parse("select * from person where id = ?2", [2]);
            } catch (err) {
                thrown = err;
            }

            expect(thrown).toBeInstanceOf(VSRepoError);
            expect(thrown.type).toBe(VSRepoErrorType.VS_PLACEHOLDERS);
        });

        it("should allow repeat positions", () => {
            const result = VSPlaceholdersParser.parse("select * from person where id = ?1 and id in (?1)", [2]);

            expect(result.compile(getSqlitePlaceholder)).toEqual({
                query: "select * from person where id = ? and id in (?)",
                args: [2, 2],
            });
        });

        it("should correctly find the placeholders too", () => {
            const result = VSPlaceholdersParser.parse("select * from person where id = ?2 and active = ?1", [true, 2]);

            expect(result.compile(getSqlitePlaceholder)).toEqual({
                query: "select * from person where id = ? and active = ?",
                args: [2, true],
            });
        });
    });
});
