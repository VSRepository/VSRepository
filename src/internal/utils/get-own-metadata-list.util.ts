export function getOwnMetadataList<V = any>(key: symbol, target: object): V[] {
    const own = Reflect.getOwnMetadata(key, target);
    if (own) return own;

    const inherited = Reflect.getMetadata(key, target);
    return inherited ? [...inherited] : [];
}
