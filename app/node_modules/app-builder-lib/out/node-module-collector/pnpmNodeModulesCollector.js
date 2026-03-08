"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PnpmNodeModulesCollector = void 0;
const builder_util_1 = require("builder-util");
const nodeModulesCollector_1 = require("./nodeModulesCollector");
const packageManager_1 = require("./packageManager");
class PnpmNodeModulesCollector extends nodeModulesCollector_1.NodeModulesCollector {
    constructor() {
        super(...arguments);
        this.installOptions = {
            manager: packageManager_1.PM.PNPM,
            lockfile: "pnpm-lock.yaml",
        };
    }
    getArgs() {
        return ["list", "--prod", "--json", "--depth", "Infinity", "--silent", "--loglevel=error"];
    }
    async extractProductionDependencyGraph(tree, dependencyId) {
        if (this.productionGraph[dependencyId]) {
            return;
        }
        this.productionGraph[dependencyId] = { dependencies: [] };
        const packageName = tree.name || tree.from;
        const { packageJson } = (await this.cache.locatePackageVersion({ pkgName: packageName, parentDir: this.rootDir, requiredRange: tree.version })) || {};
        const all = packageJson ? { ...packageJson.dependencies, ...packageJson.optionalDependencies } : { ...tree.dependencies, ...tree.optionalDependencies };
        const optional = packageJson ? { ...packageJson.optionalDependencies } : {};
        const deps = { ...(tree.dependencies || {}), ...(tree.optionalDependencies || {}) };
        this.productionGraph[dependencyId] = { dependencies: [] };
        const depPromises = Object.entries(deps).map(async ([packageName, dependency]) => {
            // First check if it's in production dependencies
            if (!all[packageName]) {
                return undefined;
            }
            // Then check if optional dependency path exists (using actual resolved path)
            if (optional[packageName]) {
                const pkg = await this.cache.locatePackageVersion({ pkgName: packageName, parentDir: this.rootDir, requiredRange: dependency.version });
                if (!pkg) {
                    builder_util_1.log.debug({ name: packageName, version: dependency.version, path: dependency.path }, `optional dependency doesn't exist, skipping - likely not installed`);
                    return undefined;
                }
            }
            const { id: childDependencyId, pkgOverride } = this.normalizePackageVersion(packageName, dependency);
            await this.extractProductionDependencyGraph(pkgOverride, childDependencyId);
            return childDependencyId;
        });
        const collectedDependencies = [];
        for (const dep of depPromises) {
            const result = await dep;
            if (result !== undefined) {
                collectedDependencies.push(result);
            }
        }
        this.productionGraph[dependencyId] = { dependencies: collectedDependencies };
    }
    async collectAllDependencies(tree) {
        var _a, _b;
        // Collect regular dependencies
        for (const [key, value] of Object.entries(tree.dependencies || {})) {
            const pkg = await this.cache.locatePackageVersion({ pkgName: key, parentDir: this.rootDir, requiredRange: value.version });
            this.allDependencies.set(`${key}@${value.version}`, { ...value, path: (_a = pkg === null || pkg === void 0 ? void 0 : pkg.packageDir) !== null && _a !== void 0 ? _a : value.path });
            await this.collectAllDependencies(value);
        }
        // Collect optional dependencies if they exist
        for (const [key, value] of Object.entries(tree.optionalDependencies || {})) {
            const pkg = await this.cache.locatePackageVersion({ pkgName: key, parentDir: this.rootDir, requiredRange: value.version });
            this.allDependencies.set(`${key}@${value.version}`, { ...value, path: (_b = pkg === null || pkg === void 0 ? void 0 : pkg.packageDir) !== null && _b !== void 0 ? _b : value.path });
            await this.collectAllDependencies(value);
        }
    }
    parseDependenciesTree(jsonBlob) {
        // pnpm returns an array of dependency trees
        const dependencyTree = this.extractJsonFromPollutedOutput(jsonBlob);
        return dependencyTree[0];
    }
}
exports.PnpmNodeModulesCollector = PnpmNodeModulesCollector;
//# sourceMappingURL=pnpmNodeModulesCollector.js.map