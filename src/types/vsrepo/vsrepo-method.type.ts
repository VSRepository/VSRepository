import { DynamicMethodOptions } from "../decorators/dynamic-method-options.type.js";

export type VSRepoMethod<T = any> = DynamicMethodOptions<T> & {
    propertyKey: string | symbol;
};
