/**
 * Deterministic <length>-character URL-safe hash (a–z0–9)
 */
export declare function hashUrlSafe(input: string, length?: number): string;
/**
 * Get cache directory for electron-builder
 */
export declare function getCacheDirectory(isAvoidSystemOnWindows?: boolean): string;
/**
 * Downloads an artifact from GitHub releases (convenience wrapper)
 */
export declare function downloadArtifact(options: {
    releaseName: string;
    filenameWithExt: string;
    checksums: Record<string, string>;
    githubOrgRepo?: string;
}): Promise<string>;
export declare function download(url: string, output: string, checksum?: string | null): Promise<void>;
export declare function getBinFromCustomLoc(name: string, version: string, binariesLocUrl: string, checksum: string): Promise<string>;
export declare function getBinFromUrl(releaseName: string, filenameWithExt: string, checksum: string, githubOrgRepo?: string): Promise<string>;
export declare function getBin(cacheKey: string, url?: string | null, checksum?: string | null): Promise<string>;
