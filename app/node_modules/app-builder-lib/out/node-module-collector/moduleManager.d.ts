import { LogLevel } from "builder-util";
import { PackageJson } from "./types";
import * as fs from "fs-extra";
export declare enum LogMessageByKey {
    PKG_DUPLICATE_REF = "duplicate dependency references",
    PKG_NOT_FOUND = "cannot find path for dependency",
    PKG_NOT_ON_DISK = "dependency not found on disk",
    PKG_SELF_REF = "self-referential dependencies",
    PKG_OPTIONAL_NOT_INSTALLED = "missing optional dependencies",
    PKG_COLLECTOR_OUTPUT = "collector stderr output"
}
export declare const logMessageLevelByKey: Record<LogMessageByKey, LogLevel>;
export type Package = {
    packageDir: string;
    packageJson: PackageJson;
};
type JsonCache = Record<string, Promise<PackageJson | null>>;
type RealPathCache = Record<string, Promise<string>>;
type ExistsCache = Record<string, Promise<boolean>>;
type LstatCache = Record<string, Promise<fs.Stats | null>>;
type PackageCache = Record<string, Promise<Package | null>>;
type LogSummaryCache = Record<LogMessageByKey, string[]>;
export declare class ModuleManager {
    /** Cache for package.json contents (readJson) */
    readonly json: JsonCache;
    /** Cache for resolved real paths (if symlink, realpath; otherwise resolve) */
    readonly realPath: RealPathCache;
    /** Cache for file/directory existence checks */
    readonly exists: ExistsCache;
    /** Cache for lstat results */
    readonly lstat: LstatCache;
    /** Cache for package lookups (key: "packageName||fromDir||semverRange"). Use helper function `versionedCacheKey` */
    readonly packageData: PackageCache;
    /** For logging purposes, just track all dependencies for each key */
    readonly logSummary: LogSummaryCache;
    private readonly jsonMap;
    private readonly realPathMap;
    private readonly existsMap;
    private readonly lstatMap;
    private readonly packageDataMap;
    private readonly logSummaryMap;
    constructor();
    private createLogSummarySyncProxy;
    private createAsyncProxy;
    versionedCacheKey(pkg: {
        name: string;
        path: string;
        semver?: string;
    }): string;
    protected locatePackageVersionFromCacheKey(key: string): Promise<Package | null>;
    locatePackageVersion({ parentDir, pkgName, requiredRange }: {
        parentDir: string;
        pkgName: string;
        requiredRange?: string;
    }): Promise<Package | null>;
    private semverSatisfies;
    /**
     * Upward search (hoisted)
     */
    private upwardSearch;
    /**
     * Breadth-first downward search from parentDir/node_modules
     * Looks for node_modules/\*\/node_modules/pkgName (and deeper)
     */
    private downwardSearch;
}
export {};
