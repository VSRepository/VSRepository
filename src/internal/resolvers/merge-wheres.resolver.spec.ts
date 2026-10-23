import { MergeWheresResolver } from "./merge-wheres.resolver.js";

interface User {
    id: string;
    name: string;
    age: number;
    removedAt: Date | null;
}

describe("MergeWheresResolver", () => {
    let resolver: MergeWheresResolver<User>;

    beforeEach(() => {
        resolver = new MergeWheresResolver("removedAt");
    });

    it("should be defined", () => {
        expect(resolver).toBeDefined();
    });

    describe("resolve", () => {
        it("should find only active by default", () => {
            const result = resolver.resolve();

            expect(result).toEqual({ removedAt: null });
        });

        it("should find only removed", () => {
            const result = resolver.resolve("removed");

            expect(result).toEqual({ removedAt: { not: null } });
        });

        it("should find all", () => {
            const result = resolver.resolve("all");

            expect(result).toEqual({});
        });

        it("should find active", () => {
            const result = resolver.resolve("active");

            expect(result).toEqual({ removedAt: null });
        });

        it("should correctly merge the provided where", () => {
            const where = { age: { gt: 18 } };

            const result = resolver.resolve("active", where);

            expect(result).toEqual({ ...where, removedAt: null });
        });

        it("should correctly merge the provided where too", () => {
            const where = { age: { gt: 18 } };

            const result = resolver.resolve("removed", where);

            expect(result).toEqual({ ...where, removedAt: { not: null } });
        });

        it("should correctly keep the where untouched", () => {
            const where = { age: { gt: 18 } };

            const result = resolver.resolve("all", where);

            expect(result).toEqual(where);
        });

        it("should ignore the see", () => {
            const resolverWithoutSoftDelete = new MergeWheresResolver<User>();

            const where = { age: { gt: 18 } };

            const result = resolverWithoutSoftDelete.resolve("active", where);

            expect(result).toEqual(where);
        });

        it("should replace any filter on the softDeleteField", () => {
            const where = { age: { gt: 18 }, removedAt: { gt: new Date() } };

            const result = resolver.resolve("active", where);

            expect(result).toEqual({ ...where, removedAt: null });
        });

        it("should not replace any filter on the softDeleteField", () => {
            const where = { age: { gt: 18 }, removedAt: { gt: new Date() } };

            const result = resolver.resolve("all", where);

            expect(result).toEqual(where);
        });
    });
});
