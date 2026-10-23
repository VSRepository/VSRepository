import { VSLogLevel } from "../../internal/enums/vs-log-level.enum.js";

/**
 * @publicApi
 */
export type VSRepoGlobalConfig = {
    softDeleteField?: string;
    logLevel?: VSLogLevel;
    lazyDynamicMethods?: boolean;
    vsPlaceholders?: boolean;
};
