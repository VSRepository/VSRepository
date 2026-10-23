export type VSRepoUglyWhere = {
    pushProperty: string;
    autoInjectVal?: boolean | {} | null;
    properties?: {
        ignoreCase?: boolean;
    };
    betweenMode?: boolean;
    name: string;
    nestedField?: string;
};
