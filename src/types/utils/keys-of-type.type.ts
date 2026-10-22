/**
 * Extracts the keys of `T` whose value type is assignable to `K`.
 *
 * @example
 * ```typescript
 * type User = { id: string; age: number; name: string };
 * type StringKeys = KeysOfType<User, string>; // "id" | "name"
 * ```
 *
 * @publicApi
 */
export type KeysOfType<T, K> = {
    [P in keyof T]: T[P] extends K ? P : never;
}[keyof T];
