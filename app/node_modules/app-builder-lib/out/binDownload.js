"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashUrlSafe = hashUrlSafe;
exports.getCacheDirectory = getCacheDirectory;
exports.downloadArtifact = downloadArtifact;
exports.download = download;
exports.getBinFromCustomLoc = getBinFromCustomLoc;
exports.getBinFromUrl = getBinFromUrl;
exports.getBin = getBin;
const get = require("@electron/get");
const get_1 = require("@electron/get");
const builder_util_1 = require("builder-util");
const filename_1 = require("builder-util/out/filename");
const multiProgress_1 = require("electron-publish/out/multiProgress");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const lockfile = require("proper-lockfile");
const tar = require("tar");
/**
 * Deterministic <length>-character URL-safe hash (a–z0–9)
 */
function hashUrlSafe(input, length = 6) {
    let hash = 5381;
    for (let i = 0; i < input.length; i++) {
        hash = ((hash << 5) + hash) ^ input.charCodeAt(i); // hash * 33 ^ c
    }
    // Force unsigned 32-bit
    hash >>>= 0;
    // Base-36 (0–9a–z)
    const out = hash.toString(36);
    // Ensure exactly `length` chars
    if (out.length >= length) {
        return out.slice(0, length);
    }
    return out.padStart(length, "0");
}
/**
 * Get cache directory for electron-builder
 */
function getCacheDirectory(isAvoidSystemOnWindows = false) {
    var _a, _b, _c, _d, _e;
    const env = (_a = process.env.ELECTRON_BUILDER_CACHE) === null || _a === void 0 ? void 0 : _a.trim();
    if (env) {
        return env;
    }
    const appName = "electron-builder";
    const platform = os.platform();
    const homeDir = os.homedir();
    if (platform === "darwin") {
        return path.join(homeDir, "Library", "Caches", appName);
    }
    if (platform === "win32") {
        const localAppData = (_b = process.env.LOCALAPPDATA) === null || _b === void 0 ? void 0 : _b.trim();
        const username = (_d = (_c = process.env.USERNAME) === null || _c === void 0 ? void 0 : _c.trim()) === null || _d === void 0 ? void 0 : _d.toLowerCase();
        const isSystemUser = isAvoidSystemOnWindows && (((_e = localAppData === null || localAppData === void 0 ? void 0 : localAppData.toLowerCase()) === null || _e === void 0 ? void 0 : _e.includes("\\windows\\system32\\")) || username === "system");
        if (!localAppData || isSystemUser) {
            return path.join(os.tmpdir(), `${appName}-cache`);
        }
        return path.join(localAppData, appName, "Cache");
    }
    // linux
    const xdgCache = process.env.XDG_CACHE_HOME;
    if (xdgCache) {
        return path.join(xdgCache, appName);
    }
    return path.join(homeDir, ".cache", appName);
}
/**
 * Downloads an artifact from GitHub releases (convenience wrapper)
 */
async function downloadArtifact(options) {
    const { releaseName, filenameWithExt, checksums, githubOrgRepo = "electron-userland/electron-builder-binaries" } = options;
    const file = await _downloadArtifact(`https://github.com/${githubOrgRepo}/releases/download/`, releaseName, filenameWithExt, checksums);
    return file;
}
/**
 * Downloads, validates, and extracts a .tar.gz from a release URL
 */
async function _downloadArtifact(baseUrl, releaseName, filenameWithExt, checksums) {
    var _a;
    const suffix = hashUrlSafe(`${baseUrl}-${releaseName}-${filenameWithExt}`, 5);
    const folderName = `${filenameWithExt.replace(/\.(tar\.gz|tgz)$/, "")}-${suffix}`;
    const extractDir = path.join(getCacheDirectory(), releaseName, folderName);
    const extractionCompleteMarker = `${extractDir}.complete`;
    // Ensure download directory exists before trying to lock
    await fs.mkdir(extractDir, { recursive: true });
    // Acquire the lock
    let release;
    try {
        release = await lockfile.lock(extractDir, {
            retries: {
                retries: 5,
                minTimeout: 1000,
                maxTimeout: 5000,
            },
            stale: 60000,
        });
        const varName = "ELECTRON_DOWNLOAD_CACHE_MODE";
        const cacheOverride = (_a = process.env[varName]) === null || _a === void 0 ? void 0 : _a.trim();
        let cacheMode = get_1.ElectronDownloadCacheMode.ReadWrite;
        if (cacheOverride && Number(cacheOverride) in get_1.ElectronDownloadCacheMode) {
            cacheMode = Number(cacheOverride);
            builder_util_1.log.debug({ mode: cacheMode }, `cache mode overridden via env var ${varName}`);
        }
        if (await (0, builder_util_1.exists)(extractionCompleteMarker)) {
            builder_util_1.log.debug({ file: filenameWithExt, path: extractDir }, "using cached artifact - skipping download/extract");
            return extractDir;
        }
        // These are just stubs. Actual url construction/file naming are in `mirrorOptions` below.
        const details = {
            // Needs to be higher than 1.3.2 to avoid @electron/get validation shortcut
            // https://github.com/electron/get/blob/05c466d4fc60fa0c83064df28dce245eb83d63c9/src/index.ts#L60
            version: "9.9.9",
            artifactName: filenameWithExt, // also is the output filename
        };
        const progress = process.stdout.isTTY ? new multiProgress_1.MultiProgress() : null;
        const progressBar = progress === null || progress === void 0 ? void 0 : progress.createBar(`${" ".repeat(builder_util_1.PADDING + 2)}[:bar] :percent | ${filenameWithExt}`, { total: 100 });
        const downloadOptions = {
            getProgressCallback: info => {
                progressBar === null || progressBar === void 0 ? void 0 : progressBar.update(info.percent != null ? Math.floor(info.percent * 100) : 0);
                return Promise.resolve();
            },
        };
        const options = {
            cacheRoot: path.resolve(getCacheDirectory(), "downloads"),
            cacheMode,
            downloadOptions,
            checksums,
            mirrorOptions: {
                // `${opts.mirror}${opts.customDir}/${opts.customFilename}`
                mirror: baseUrl,
                customDir: releaseName,
                customFilename: filenameWithExt,
            },
        };
        builder_util_1.log.info({ release: releaseName, file: filenameWithExt }, "downloading");
        progressBar === null || progressBar === void 0 ? void 0 : progressBar.render();
        const downloadedFile = await get.downloadArtifact({
            ...details,
            ...options,
            isGeneric: true,
        });
        await tar.extract({
            file: downloadedFile,
            cwd: extractDir,
            strip: 1, // Strip the top-level directory from the archive
        });
        // Write the extraction complete marker file to indicate successful extraction and prevent future re-extraction
        await fs.writeFile(extractionCompleteMarker, "");
        builder_util_1.log.debug({ file: filenameWithExt, path: extractDir }, "downloaded");
        progressBar === null || progressBar === void 0 ? void 0 : progressBar.update(100);
        progressBar === null || progressBar === void 0 ? void 0 : progressBar.terminate();
        return extractDir;
    }
    finally {
        // Release the lock
        if (release) {
            await release();
        }
    }
}
const versionToPromise = new Map();
function download(url, output, checksum) {
    const args = ["download", "--url", url, "--output", output];
    if (checksum != null) {
        args.push("--sha512", checksum);
    }
    return (0, builder_util_1.executeAppBuilder)(args);
}
function getBinFromCustomLoc(name, version, binariesLocUrl, checksum) {
    const dirName = `${name}-${version}`;
    return getBin(dirName, binariesLocUrl, checksum);
}
function getBinFromUrl(releaseName, filenameWithExt, checksum, githubOrgRepo = "electron-userland/electron-builder-binaries") {
    let url;
    if (process.env.ELECTRON_BUILDER_BINARIES_DOWNLOAD_OVERRIDE_URL) {
        url = process.env.ELECTRON_BUILDER_BINARIES_DOWNLOAD_OVERRIDE_URL + "/" + filenameWithExt;
    }
    else {
        const baseUrl = process.env.NPM_CONFIG_ELECTRON_BUILDER_BINARIES_MIRROR ||
            process.env.npm_config_electron_builder_binaries_mirror ||
            process.env.npm_package_config_electron_builder_binaries_mirror ||
            process.env.ELECTRON_BUILDER_BINARIES_MIRROR ||
            `https://github.com/${githubOrgRepo}/releases/download/`;
        const middleUrl = process.env.NPM_CONFIG_ELECTRON_BUILDER_BINARIES_CUSTOM_DIR ||
            process.env.npm_config_electron_builder_binaries_custom_dir ||
            process.env.npm_package_config_electron_builder_binaries_custom_dir ||
            process.env.ELECTRON_BUILDER_BINARIES_CUSTOM_DIR ||
            releaseName;
        url = `${baseUrl}${middleUrl}/${filenameWithExt}`;
    }
    const cacheKey = `${releaseName}-${path.basename(filenameWithExt, path.extname(filenameWithExt))}`;
    return getBin(cacheKey, url, checksum);
}
function getBin(cacheKey, url, checksum) {
    var _a;
    // Old cache is ignored if cache environment variable changes
    const cacheName = (0, filename_1.sanitizeFileName)(`${(_a = process.env.ELECTRON_BUILDER_CACHE) !== null && _a !== void 0 ? _a : ""}${cacheKey}`);
    let promise = versionToPromise.get(cacheName); // if rejected, we will try to download again
    if (promise != null) {
        return promise;
    }
    promise = doGetBin(cacheKey, url, checksum);
    versionToPromise.set(cacheName, promise);
    return promise;
}
function doGetBin(name, url, checksum) {
    const args = ["download-artifact", "--name", name];
    if (url != null) {
        args.push("--url", url);
    }
    if (checksum != null) {
        args.push("--sha512", checksum);
    }
    return (0, builder_util_1.executeAppBuilder)(args);
}
//# sourceMappingURL=binDownload.js.map