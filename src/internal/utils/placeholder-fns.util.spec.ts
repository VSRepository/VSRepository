import {
    getCockroachPlaceholder,
    getMySqlPlaceholder,
    getPostgresPlaceholder,
    getSqlitePlaceholder,
    getSqlServerPlaceholder,
    getVsPlaceholder,
} from "./placeholder-fns.util.js";

describe("placeholder fns utils", () => {
    it.each([
        { index: 0, expected: "?1" },
        { index: 1, expected: "?2" },
        { index: 2, expected: "?3" },
        { index: 20, expected: "?21" },
        { index: 99, expected: "?100" },
    ])("should return $expected when the index is $index (getVsPlaceholder)", ({ expected, index }) => {
        const result = getVsPlaceholder(index);
        expect(result).toBe(expected);
    });

    it("getPostgresPlaceholder should be equal to getCockroachPlaceholder", () => {
        expect(getCockroachPlaceholder).toBe(getPostgresPlaceholder);
    });

    it.each([
        { index: 0, expected: "$1" },
        { index: 1, expected: "$2" },
        { index: 2, expected: "$3" },
        { index: 20, expected: "$21" },
        { index: 99, expected: "$100" },
    ])("should return $expected when the index is $index (getPostgresPlaceholder)", ({ expected, index }) => {
        const result = getPostgresPlaceholder(index);
        expect(result).toBe(expected);
    });

    it("getMySqlPlaceholder should be equal to getSqlitePlaceholder", () => {
        expect(getSqlitePlaceholder).toBe(getMySqlPlaceholder);
    });

    it.each([
        { index: 0, expected: "?" },
        { index: 1, expected: "?" },
        { index: 2, expected: "?" },
        { index: 20, expected: "?" },
        { index: 99, expected: "?" },
    ])("should return $expected when the index is $index (getSqlitePlaceholder)", ({ expected, index }) => {
        const result = getSqlitePlaceholder(index);
        expect(result).toBe(expected);
    });

    it.each([
        { index: 0, expected: "@P1" },
        { index: 1, expected: "@P2" },
        { index: 2, expected: "@P3" },
        { index: 20, expected: "@P21" },
        { index: 99, expected: "@P100" },
    ])("should return $expected when the index is $index (getSqlServerPlaceholder)", ({ expected, index }) => {
        const result = getSqlServerPlaceholder(index);
        expect(result).toBe(expected);
    });
});
