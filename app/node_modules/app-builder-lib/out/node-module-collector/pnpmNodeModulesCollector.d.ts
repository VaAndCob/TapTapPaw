import { NodeModulesCollector } from "./nodeModulesCollector";
import { PM } from "./packageManager";
import { PnpmDependency } from "./types";
export declare class PnpmNodeModulesCollector extends NodeModulesCollector<PnpmDependency, PnpmDependency> {
    readonly installOptions: {
        manager: PM;
        lockfile: string;
    };
    protected getArgs(): string[];
    protected extractProductionDependencyGraph(tree: PnpmDependency, dependencyId: string): Promise<void>;
    protected collectAllDependencies(tree: PnpmDependency): Promise<void>;
    protected parseDependenciesTree(jsonBlob: string): PnpmDependency;
}
