/**
 * Structural shape of an arbitrary-precision decimal, as returned by ORMs for `decimal`/`numeric`
 * columns (e.g. Prisma's `Prisma.Decimal`). Any object with `toNumber()` and `decimalPlaces()` matches,
 * which keeps the core ORM-agnostic.
 *
 * ORMs that return decimals as `string` (e.g. Drizzle, TypeORM) don't match: such fields aren't
 * eligible for `increment`, `sum` and the other numeric operations unless mapped to a numeric type.
 *
 * @publicApi
 */
export type DecimalLike = {
    toNumber(): number;
    decimalPlaces(): number;
};
