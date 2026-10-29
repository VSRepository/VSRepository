export type DynamicMethodInfo = {
    onlyBaseWheres: boolean;
    ignoreWhere: boolean;
    ignoreOrderByAndPagination: boolean;
    ignoreSelect: boolean;
    existsMode: boolean;
    keyToMapReplaced: string;
    argsCount: number;
    method: string;
    whereParams: string[];
    otherParams: string[];
    dataIndex?: number;
    updateIndex?: number;
    createIndex?: number;
    whereIndex?: number;
    originalDynamicMethodName: string;
    findAndCountMode?: boolean;
};
