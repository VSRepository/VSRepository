import { Class } from "../../types/utils/class.type.js";
import { getOwnMetadataList } from "./get-own-metadata-list.util.js";
import "reflect-metadata";

describe("getOwnMetadataList", () => {
    const MOCK_SYMBOL = Symbol("MOCK_SYMBOL");
    let father: Class;
    let son: Class;

    beforeEach(() => {
        father = class Father {};
        son = class Son extends father {};
    });

    it("should return an empty list", () => {
        vi.spyOn(Reflect, "getOwnMetadata");
        vi.spyOn(Reflect, "getMetadata");

        const result = getOwnMetadataList(MOCK_SYMBOL, father);

        expect(Reflect.getOwnMetadata).toHaveBeenCalledWith(MOCK_SYMBOL, father);
        expect(Reflect.getMetadata).toHaveBeenCalledWith(MOCK_SYMBOL, father);
        expect(result).toEqual([]);
    });

    it("should return a list with the own values (father)", () => {
        const metadata = [1, 2];

        Reflect.defineMetadata(MOCK_SYMBOL, metadata, father);

        vi.spyOn(Reflect, "getOwnMetadata");
        vi.spyOn(Reflect, "getMetadata");

        const result = getOwnMetadataList(MOCK_SYMBOL, father);

        expect(Reflect.getOwnMetadata).toHaveBeenCalledWith(MOCK_SYMBOL, father);
        expect(Reflect.getMetadata).not.toHaveBeenCalled();
        expect(result).toBe(metadata);
    });

    it("should return a list with the own values (son)", () => {
        const metadataFather = [1, 2];
        const metadataSon = [3, 4];

        Reflect.defineMetadata(MOCK_SYMBOL, metadataFather, father);
        Reflect.defineMetadata(MOCK_SYMBOL, metadataSon, son);

        vi.spyOn(Reflect, "getOwnMetadata");
        vi.spyOn(Reflect, "getMetadata");

        const result = getOwnMetadataList(MOCK_SYMBOL, son);

        expect(Reflect.getOwnMetadata).toHaveBeenCalledWith(MOCK_SYMBOL, son);
        expect(Reflect.getMetadata).not.toHaveBeenCalled();
        expect(result).toEqual(metadataSon);
    });

    it("shoul return a *copy* of the father values", () => {
        const metadataFather = [1, 2];

        Reflect.defineMetadata(MOCK_SYMBOL, metadataFather, father);

        vi.spyOn(Reflect, "getOwnMetadata");
        vi.spyOn(Reflect, "getMetadata");

        const result = getOwnMetadataList(MOCK_SYMBOL, son);

        expect(Reflect.getOwnMetadata).toHaveBeenCalledWith(MOCK_SYMBOL, son);
        expect(Reflect.getMetadata).toHaveBeenCalledWith(MOCK_SYMBOL, son);
        expect(result).not.toBe(metadataFather);
        expect(result).toEqual(metadataFather);
    });
});
