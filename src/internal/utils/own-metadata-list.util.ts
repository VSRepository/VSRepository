export function getOwnMetadataList<V>(key: symbol, target: object): V[] {
    const own: V[] | undefined = Reflect.getOwnMetadata(key, target);
    if (own) return own;

    const inherited: V[] | undefined = Reflect.getMetadata(key, target);
    return inherited ? [...inherited] : [];
}
