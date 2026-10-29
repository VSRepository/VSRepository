import { VSRepoError } from "../../errors/VSRepoError.js";
import { VSRepoErrorType } from "../enums/vsrepo-error-type.enum.js";
import { VSSql } from "./vs-sql.util.js";

export class VSPlaceholdersParser {
    /**
     * Parses a raw SQL string written with VSRepository's positional placeholders (`?1`, `?2`, ...; 1-based)
     * into a `VSSql` fragment. An index may repeat (each occurrence becomes its own parameter), and a `?N`
     * inside a single-quoted string literal is left untouched.
     *
     * @throws VSRepoError If a placeholder references an index outside `args`.
     *
     * @internal
     */
    static parse(query: string, args: readonly unknown[] = []): VSSql {
        const placeholderPattern = /\?(\d+)/g;

        // Blank out every single-quoted string literal (`''` escapes a quote,
        // per standard SQL) so a `?N` written as literal text inside one is
        // never mistaken for a placeholder. Whitespace is preserved and every
        // non-whitespace char is replaced 1:1 by a space, so `match.index`
        // still lines up with the original `query` when slicing the chunks.
        const masked = query.replace(/'(?:''|[^'])*'/g, m => m.replace(/\S/g, " "));

        const chunks: string[] = [];
        const values: unknown[] = [];

        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = placeholderPattern.exec(masked)) !== null) {
            const position = Number(match[1]);

            if (!Number.isInteger(position) || position < 1 || position > args.length) {
                const reason =
                    args.length === 0
                        ? "no arguments were provided in 'args'."
                        : `expected a number between 1 and ${args.length} (the length of 'args').`;

                throw new VSRepoError(
                    `Invalid 'vsPlaceholders' reference '?${match[1]}' in query — ${reason}`,
                    VSRepoErrorType.VS_PLACEHOLDERS,
                );
            }

            chunks.push(query.slice(lastIndex, match.index));
            values.push(args[position - 1]);
            lastIndex = match.index + match[0].length;
        }

        chunks.push(query.slice(lastIndex));

        return VSSql.create(chunks, values);
    }
}
