import { uncapitalize } from "./uncapitalize.util.js";

describe("uncapitalize", () => {
    it("shoul return the same string", () => {
        const text = "lower";

        const result = uncapitalize(text);

        expect(result).toBe(text);
    });

    it("should return an empty string", () => {
        const text = "";

        const result = uncapitalize(text);

        expect(result).toBe("");
    });

    it("should return an uncaptalized string", () => {
        const text = "Capitalized";

        const result = uncapitalize(text);

        expect(result).toBe("capitalized");
    });

    it("should uncaptalized accented characters", () => {
        const text = "Área";

        const result = uncapitalize(text);

        expect(result).toBe("área");
    });

    it.each([{ char: "_" }, { char: "*" }, { char: "!" }, { char: "&" }, { char: "1" }, { char: "2" }, { char: "0" }])(
        "should not change the $char caracter",
        ({ char }) => {
            const result = uncapitalize(char);

            expect(result).toBe(char);
        },
    );
});
