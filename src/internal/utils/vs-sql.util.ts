import { VSRepoError } from "../../errors/VSRepoError.js";
import { CompiledQuery } from "../../types/utils/compiled-query.type.js";
import { GetPlaceholderFn } from "../../types/utils/get-placeholder-fn.type.js";
import { VSRepoErrorType } from "../enums/vsrepo-error-type.enum.js";
import { getVsPlaceholder } from "./placeholder-fns.util.js";

/**
 * Composable, ORM-agnostic SQL fragment. Values interpolated with `${...}` are always sent as parameters,
 * and nested `VSSql` fragments are spliced in (text and parameters), so fragments compose freely.
 * Build one with `VSSql.sql` (or `raw`, `join`, `empty`) and pass it to `VSRepository.query()`
 * or the raw query builder.
 *
 * @example
 * ```typescript
 * const filter = onlyActive ? VSSql.sql`AND active = ${true}` : VSSql.empty;
 *
 * const users = await userRepository.query<User[]>(
 *     VSSql.sql`SELECT * FROM ${VSSql.raw('"user"')} WHERE id IN (${VSSql.join(ids)}) ${filter}`,
 * );
 * ```
 *
 * @publicApi
 */
export class VSSql {
    private constructor(
        private readonly chunks: readonly string[],
        private readonly values: readonly unknown[],
    ) {}

    /**
     * @internal
     */
    static create(chunks: readonly string[], values: readonly unknown[]): VSSql {
        return new VSSql(chunks, values);
    }

    /**
     * Appends `value` to the in-progress `chunks`/`values` pair: a nested
     * `VSSql` is spliced in (its own text merged into the current trailing
     * chunk, its own parameters appended in order), anything else becomes a
     * single new parameter. `chunks` always has `values.length + 1` entries.
     */
    private static appendValue(chunks: string[], values: unknown[], value: unknown): void {
        if (value instanceof VSSql) {
            chunks[chunks.length - 1] += value.chunks[0] ?? "";

            for (let i = 0; i < value.values.length; i++) {
                values.push(value.values[i]);
                chunks.push(value.chunks[i + 1] ?? "");
            }
        } else {
            values.push(value);
            chunks.push("");
        }
    }

    /**
     * Compiles the fragment into a SQL string and its positional `args`.
     *
     * @param getPlaceholder Renders the placeholder for the parameter at `index` (0-based position in `args`).
     * Defaults to `getVsPlaceholder` (`?1`, `?2`, ...).
     */
    compile(getPlaceholder: GetPlaceholderFn = getVsPlaceholder): CompiledQuery {
        let text = this.chunks[0] ?? "";

        for (let i = 0; i < this.values.length; i++) {
            text += getPlaceholder(i) + (this.chunks[i + 1] ?? "");
        }

        return { query: text, args: [...this.values] };
    }

    /**
     * Builds a fragment from a tagged template. Each `${value}` becomes a parameter, except nested
     * `VSSql` fragments, which are spliced in.
     *
     * @example
     * ```typescript
     * const fragment = VSSql.sql`SELECT * FROM "user" WHERE email = ${email}`;
     * ```
     */
    static sql(strings: TemplateStringsArray, ...values: unknown[]): VSSql {
        const chunks: string[] = [strings[0] ?? ""];
        const outValues: unknown[] = [];

        for (let i = 0; i < values.length; i++) {
            const value = values[i];
            VSSql.appendValue(chunks, outValues, value);
            chunks[chunks.length - 1] += strings[i + 1] ?? "";
        }

        return new VSSql(chunks, outValues);
    }

    /**
     * Inserts `text` into the query as-is, unparameterized: for identifiers (table/column names) or keywords
     * that can't be bound. `text` is never escaped, so only pass trusted input.
     *
     * @example
     * ```typescript
     * VSSql.sql`SELECT * FROM ${VSSql.raw('"user"')} WHERE active = ${true}`;
     * ```
     */
    static raw(text: string): VSSql {
        if (typeof text !== "string") {
            throw new VSRepoError("'VSSql.raw' expects 'text' to be a string", VSRepoErrorType.VSSQL);
        }

        return new VSSql([text], []);
    }

    /**
     * An empty fragment (no text, no parameters), handy as the "nothing" branch of a conditional.
     *
     * @example
     * ```typescript
     * onlyActive ? VSSql.sql`AND active = true` : VSSql.empty;
     * ```
     */
    static readonly empty: VSSql = new VSSql([""], []);

    /**
     * Joins `values` into one fragment, separated by `separator` and wrapped by `prefix`/`suffix`.
     * Each value becomes a parameter, or is spliced in if it's a `VSSql`. Commonly used for `IN (...)` lists.
     *
     * @example
     * ```typescript
     * VSSql.sql`WHERE id IN (${VSSql.join(ids)})`;
     * ```
     */
    static join(values: readonly unknown[], separator = ", ", prefix = "", suffix = ""): VSSql {
        if (!Array.isArray(values) || values.length === 0) {
            throw new VSRepoError("'VSSql.join' expects 'values' to be a non-empty array", VSRepoErrorType.VSSQL);
        }

        const chunks: string[] = [prefix];
        const outValues: unknown[] = [];

        for (let i = 0; i < values.length; i++) {
            const value = values[i];
            VSSql.appendValue(chunks, outValues, value);
            chunks[chunks.length - 1] += i === values.length - 1 ? suffix : separator;
        }

        return new VSSql(chunks, outValues);
    }
}
