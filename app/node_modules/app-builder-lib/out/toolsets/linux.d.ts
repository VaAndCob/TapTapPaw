import { Arch } from "builder-util";
export declare function getLinuxToolsPath(): Promise<string>;
export declare function getFpmPath(): Promise<string>;
export declare function getAppImageTools(targetArch: Arch): Promise<{
    mksquashfs: string;
    desktopFileValidate: string;
    runtime: string;
    runtimeLibraries: string;
}>;
