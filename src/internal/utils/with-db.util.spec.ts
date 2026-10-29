import { DbArg } from "./db-arg.util.js";
import { withDb } from "./with-db.util.js";

describe("withDb", () => {
    it("should return an instance of DbArg with the provided 'db'", () => {
        const db = { database: 1000 };

        const result = withDb(db);

        expect(result).toBeInstanceOf(DbArg);
        expect(result.getDb()).toBe(db);
    });
});
