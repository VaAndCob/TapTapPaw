import { Arch } from "builder-util";
import { FileAssociation } from "../../options/FileAssociation";
import { IconInfo } from "../../platformPackager";
import { BlockMapDataHolder } from "builder-util-runtime";
interface Options {
    productName: string;
    productFilename: string;
    executableName: string;
    desktopEntry: string;
    icons: IconInfo[];
    license?: string | null;
    fileAssociations: FileAssociation[];
    compression?: "xz" | "lzo" | "zstd";
}
export interface AppImageBuilderOptions {
    appDir: string;
    stageDir: string;
    arch: Arch;
    output: string;
    options: Options;
}
export declare function buildAppImage(opts: AppImageBuilderOptions): Promise<BlockMapDataHolder>;
export {};
