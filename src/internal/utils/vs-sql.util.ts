import { VSRepoError } from "../../errors/VSRepoError.js";
import { VSRepoErrorType } from "../enums/vsrepo-error-type.enum.js";

/**
 * An ORM-agnostic, composable SQL fragment that compiles down to whatever placeholder
 * syntax your adapter declares via `VSRepoAdapter.getPlaceholder()`, instead of assuming one.
 *
 * A `VSSql` never touches the database by itself — build one with `VSSql.sql`
 * (or compose it from `VSSql.raw`/`VSSql.join`/`VSSql.empty`) and pass it
 * straight to `VSRepository.query()`, which compiles and executes it.
 *
 * Values interpolated with `${...}` are always sent as parameters. Nesting
 * another `VSSql` inline splices its text and parameters into the outer
 * fragment, so fragments compose freely:
 *
 * @example
 * ```typescript
 * import { VSSql } from "vsrepo";
 *
 * const filter = onlyActive ? VSSql.sql`AND active = ${true}` : VSSql.empty;
 *
 * const fragment = VSSql.sql`
 *     SELECT * FROM ${VSSql.raw('"user"')}
 *     WHERE id IN (${VSSql.join(ids)})
 *     ${filter}
 * `;
 *
 * const users = await userRepository.query<User[]>(fragment);
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
     * Compiles this fragment into a single SQL string and its positional
     * argument array, rendering each parameter's placeholder with
     * `getPlaceholder(index)` — `index` is the 0-based position of the
     * parameter in the returned `args` array. Used internally by
     * `VSRepository.query()`; only call this directly if you need the raw
     * `{ text, args }` pair for something else (e.g. logging).
     */
    compile(getPlaceholder: (index: number) => string): { text: string; args: unknown[] } {
        let text = this.chunks[0] ?? "";

        for (let i = 0; i < this.values.length; i++) {
            text += getPlaceholder(i) + (this.chunks[i + 1] ?? "");
        }

        return { text, args: [...this.values] };
    }

    /**
     * Builds a `VSSql` fragment from a tagged template literal. Every
     * interpolated `${value}` becomes a parameter, except another `VSSql`
     * (e.g. from `raw()`, `join()`, or a nested `sql` fragment), which is
     * spliced in as text + its own parameters instead.
     *
     * @example
     * ```typescript
     * const fragment = VSSql.sql`SELECT * FROM "user" WHERE email = ${email}`;
     * const users = await userRepository.query<User[]>(fragment);
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
     * Inserts `text` into the query as-is, unparameterized — for identifiers
     * (table/column names) or SQL keywords that can't be bound as a
     * parameter. `text` is never escaped or validated: only pass trusted,
     * non-user-controlled input.
     *
     * @example
     * ```typescript
     * const table = VSSql.raw('"user"');
     * const fragment = VSSql.sql`SELECT * FROM ${table} WHERE active = ${true}`;
     * ```
     */
    static raw(text: string): VSSql {
        if (typeof text !== "string") {
            throw new VSRepoError("'VSSql.raw' expects 'text' to be a string", VSRepoErrorType.BASE);
        }

        return new VSSql([text], []);
    }

    /**
     * An empty fragment — contributes no text and no parameters. Useful as
     * the "nothing" branch when conditionally composing a fragment.
     * @example
     * ```typescript
     * condition ? VSSql.sql`AND active = true` : VSSql.empty
     * ```
     */
    static readonly empty: VSSql = new VSSql([""], []);

    /**
     * Joins `values` into a single fragment, separated by `separator` and
     * wrapped by `prefix`/`suffix`. Each element is either a parameter value
     * (auto-wrapped, like a normal `${...}` interpolation) or a nested `VSSql`
     * fragment (spliced in). Most commonly used to build an `IN (...)` list.
     *
     * @example
     * ```typescript
     * const fragment = VSSql.sql`WHERE id IN (${VSSql.join(ids)})`;
     * ```
     */
    static join(values: readonly unknown[], separator = ", ", prefix = "", suffix = ""): VSSql {
        if (!Array.isArray(values) || values.length === 0) {
            throw new VSRepoError("'VSSql.join' expects 'values' to be a non-empty array", VSRepoErrorType.BASE);
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
