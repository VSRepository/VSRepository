/**
 * Constructor type for a class that creates instances of `T`.
 *
 * @publicApi
 */
export interface Class<T = any> extends Function {
    new (...args: any[]): T;
}
