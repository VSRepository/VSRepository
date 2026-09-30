export interface Class<T = any> extends Function {
    new (...args: any[]): T;
}
