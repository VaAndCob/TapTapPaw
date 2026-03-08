"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleManager = exports.logMessageLevelByKey = exports.LogMessageByKey = void 0;
const builder_util_1 = require("builder-util");
const fs = require("fs-extra");
const path = require("path");
const semver = require("semver");
var LogMessageByKey;
(function (LogMessageByKey) {
    LogMessageByKey["PKG_DUPLICATE_REF"] = "duplicate dependency references";
    LogMessageByKey["PKG_NOT_FOUND"] = "cannot find path for dependency";
    LogMessageByKey["PKG_NOT_ON_DISK"] = "dependency not found on disk";
    LogMessageByKey["PKG_SELF_REF"] = "self-referential dependencies";
    LogMessageByKey["PKG_OPTIONAL_NOT_INSTALLED"] = "missing optional dependencies";
    LogMessageByKey["PKG_COLLECTOR_OUTPUT"] = "collector stderr output";
})(LogMessageByKey || (exports.LogMessageByKey = LogMessageByKey = {}));
exports.logMessageLevelByKey = {
    [LogMessageByKey.PKG_DUPLICATE_REF]: "info",
    [LogMessageByKey.PKG_NOT_FOUND]: "warn",
    [LogMessageByKey.PKG_NOT_ON_DISK]: "warn",
    [LogMessageByKey.PKG_SELF_REF]: "debug",
    [LogMessageByKey.PKG_OPTIONAL_NOT_INSTALLED]: "info",
    [LogMessageByKey.PKG_COLLECTOR_OUTPUT]: "warn",
};
class ModuleManager {
    constructor() {
        this.jsonMap = new Map();
        this.realPathMap = new Map();
        this.existsMap = new Map();
        this.lstatMap = new Map();
        this.packageDataMap = new Map();
        this.logSummaryMap = new Map();
        this.logSummary = this.createLogSummarySyncProxy();
        this.exists = this.createAsyncProxy(this.existsMap, (p) => (0, builder_util_1.exists)(p));
        this.json = this.createAsyncProxy(this.jsonMap, (p) => fs.readJson(p).catch(() => null));
        this.lstat = this.createAsyncProxy(this.lstatMap, (p) => fs.lstat(p).catch(() => null));
        this.packageData = this.createAsyncProxy(this.packageDataMap, (p) => this.locatePackageVersionFromCacheKey(p).catch(() => null));
        this.realPath = this.createAsyncProxy(this.realPathMap, async (p) => {
            const filePath = path.resolve(p);
            const stat = await this.lstat[filePath];
            return (stat === null || stat === void 0 ? void 0 : stat.isSymbolicLink()) ? fs.realpath(filePath) : filePath;
        });
    }
    createLogSummarySyncProxy() {
        return new Proxy({}, {
            get: (_, key) => {
                if (!this.logSummaryMap.has(key)) {
                    this.logSummaryMap.set(key, []);
                }
                return this.logSummaryMap.get(key);
            },
            set: (_, key, value) => {
                this.logSummaryMap.set(key, value);
                return true;
            },
            has: (_, key) => {
                return this.logSummaryMap.has(key);
            },
            // Add these to make Object.entries() work
            ownKeys: _ => {
                return Array.from(this.logSummaryMap.keys());
            },
            getOwnPropertyDescriptor: (_, key) => {
                if (this.logSummaryMap.has(key)) {
                    return {
                        enumerable: true,
                        configurable: true,
                    };
                }
                return undefined;
            },
        });
    }
    // this allows dot-notation access while still supporting async retrieval
    // e.g., cache.packageJson[somePath] returns Promise<PackageJson>
    createAsyncProxy(map, compute) {
        return new Proxy({}, {
            async get(_, key) {
                if (map.has(key)) {
                    return Promise.resolve(map.get(key));
                }
                return await Promise.resolve(compute(key)).then(value => {
                    map.set(key, value);
                    return value;
                });
            },
            set(_, key, value) {
                map.set(key, value);
                return true;
            },
            has(_, key) {
                return map.has(key);
            },
        });
    }
    versionedCacheKey(pkg) {
        return [pkg.name, pkg.path, pkg.semver || ""].join("||");
    }
    async locatePackageVersionFromCacheKey(key) {
        const [name, fromDir, semverRange] = key.split("||");
        const result = await this.locatePackageVersion({ parentDir: fromDir, pkgName: name, requiredRange: semverRange });
        if (result == null) {
            return null;
        }
        return { ...result, packageDir: await this.realPath[result.packageDir] };
    }
    async locatePackageVersion({ parentDir, pkgName, requiredRange }) {
        // 1) check direct parent node_modules/pkgName first
        const direct = path.join(path.resolve(parentDir), "node_modules", pkgName, "package.json");
        if (await this.exists[direct]) {
            const json = await this.json[direct];
            if (json && this.semverSatisfies(json.version, requiredRange)) {
                return { packageDir: path.dirname(direct), packageJson: json };
            }
        }
        // 2) upward hoisted search, then 3) downward non-hoisted search
        return (await this.upwardSearch(parentDir, pkgName, requiredRange)) || (await this.downwardSearch(parentDir, pkgName, requiredRange)) || null;
    }
    semverSatisfies(found, range) {
        if ((0, builder_util_1.isEmptyOrSpaces)(range) || range === "*") {
            return true;
        }
        if (range === found) {
            return true;
        }
        if (semver.validRange(range) == null) {
            // ignore, we can't verify non-semver ranges
            // e.g. git urls, file:, patch:, etc. Example:
            // "@ai-sdk/google": "patch:@ai-sdk/google@npm%3A2.0.43#~/.yarn/patches/@ai-sdk-google-npm-2.0.43-689ed559b3.patch"
            builder_util_1.log.debug({ found, range }, "unable to validate semver version range, assuming match");
            return true;
        }
        try {
            return semver.satisfies(found, range);
        }
        catch {
            // fallback: simple equality or basic prefix handling (^, ~)
            if (range.startsWith("^") || range.startsWith("~")) {
                const r = range.slice(1);
                return r === found;
            }
            // if range is like "8.x" or "8.*" match major
            const m = range.match(/^(\d+)[.(*|x)]*/);
            const fm = found.match(/^(\d+)\./);
            if (m && fm) {
                return m[1] === fm[1];
            }
            return false;
        }
    }
    /**
     * Upward search (hoisted)
     */
    async upwardSearch(parentDir, pkgName, requiredRange) {
        let current = path.resolve(parentDir);
        const root = path.parse(current).root;
        while (true) {
            const candidate = path.join(current, "node_modules", pkgName, "package.json");
            if (await this.exists[candidate]) {
                const json = await this.json[candidate];
                if (json && this.semverSatisfies(json.version, requiredRange)) {
                    return { packageDir: path.dirname(candidate), packageJson: json };
                }
                // otherwise keep searching upward (we may find a different hoisted version)
            }
            if (current === root) {
                break;
            }
            const parent = path.dirname(current);
            if (parent === current) {
                break;
            }
            current = parent;
        }
        return null;
    }
    /**
     * Breadth-first downward search from parentDir/node_modules
     * Looks for node_modules/\*\/node_modules/pkgName (and deeper)
     */
    async downwardSearch(parentDir, pkgName, requiredRange, maxExplored = 2000, maxDepth = 6) {
        var _a, _b, _c, _d;
        const start = path.join(path.resolve(parentDir), "node_modules");
        if (!(await this.exists[start]) || !((_a = (await this.lstat[start])) === null || _a === void 0 ? void 0 : _a.isDirectory())) {
            return null;
        }
        const visited = new Set();
        const queue = [{ dir: start, depth: 0 }];
        let explored = 0;
        while (queue.length > 0) {
            const { dir, depth } = queue.shift();
            if (explored++ > maxExplored) {
                break;
            }
            if (depth > maxDepth) {
                continue;
            }
            let entries;
            try {
                entries = await fs.readdir(dir);
            }
            catch {
                continue;
            }
            for (const entry of entries) {
                if (entry.startsWith(".")) {
                    continue;
                }
                const entryPath = path.join(dir, entry);
                // handle scoped packages @scope/name
                if (entry.startsWith("@")) {
                    // queue the scope directory itself to explore its children
                    if ((await this.exists[entryPath]) && ((_b = (await this.lstat[entryPath])) === null || _b === void 0 ? void 0 : _b.isDirectory())) {
                        const scopeEntries = await fs.readdir(entryPath);
                        for (const sc of scopeEntries) {
                            const scPath = path.join(entryPath, sc);
                            // check scPath/node_modules/pkgName
                            const candidatePkgJson = path.join(scPath, "node_modules", pkgName, "package.json");
                            if (await this.exists[candidatePkgJson]) {
                                const json = await this.json[candidatePkgJson];
                                if (json && this.semverSatisfies(json.version, requiredRange)) {
                                    return { packageDir: path.dirname(candidatePkgJson), packageJson: json };
                                }
                            }
                            // enqueue scPath/node_modules to explore further
                            const scNodeModules = path.join(scPath, "node_modules");
                            if ((await this.exists[scNodeModules]) && ((_c = (await this.lstat[scNodeModules])) === null || _c === void 0 ? void 0 : _c.isDirectory())) {
                                if (!visited.has(scNodeModules)) {
                                    visited.add(scNodeModules);
                                    queue.push({ dir: scNodeModules, depth: depth + 1 });
                                }
                            }
                        }
                    }
                    continue;
                }
                // check for direct candidate: entry/node_modules/pkgName
                try {
                    const stat = await this.lstat[entryPath];
                    if (!(stat === null || stat === void 0 ? void 0 : stat.isDirectory())) {
                        continue;
                    }
                }
                catch {
                    continue;
                }
                const candidatePkgJson = path.join(entryPath, "node_modules", pkgName, "package.json");
                if (await this.exists[candidatePkgJson]) {
                    const json = await this.json[candidatePkgJson];
                    if (json && this.semverSatisfies(json.version, requiredRange)) {
                        return { packageDir: path.dirname(candidatePkgJson), packageJson: json };
                    }
                }
                // also check entry/node_modules directly for pkgName (some layouts)
                const candidateDirect = path.join(entryPath, pkgName, "package.json");
                if (await this.exists[candidateDirect]) {
                    const json = await this.json[candidateDirect];
                    if (json && this.semverSatisfies(json.version, requiredRange)) {
                        return { packageDir: path.dirname(candidateDirect), packageJson: json };
                    }
                }
                // enqueue entry/node_modules for deeper traversal
                const nextNodeModules = path.join(entryPath, "node_modules");
                if ((await this.exists[nextNodeModules]) && ((_d = (await this.lstat[nextNodeModules])) === null || _d === void 0 ? void 0 : _d.isDirectory())) {
                    if (!visited.has(nextNodeModules)) {
                        visited.add(nextNodeModules);
                        queue.push({ dir: nextNodeModules, depth: depth + 1 });
                    }
                }
            }
        }
        return null;
    }
}
exports.ModuleManager = ModuleManager;
//# sourceMappingURL=moduleManager.js.map