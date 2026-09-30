import { DbArg } from "./db-arg.util.js";

describe("DbArg", () => {
    const db = { database: 100 };
    let dbArg: DbArg;

    beforeEach(() => {
        dbArg = new DbArg(db);
    });

    it("should be defined", () => {
        expect(db).toBeDefined();
    });

    it("should return the provided database", () => {
        expect(dbArg.getDb()).toBe(db);
    });
});
