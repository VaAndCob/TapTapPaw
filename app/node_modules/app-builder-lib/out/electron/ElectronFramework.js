"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBrandingOpts = createBrandingOpts;
exports.createElectronFrameworkSupport = createElectronFrameworkSupport;
const builder_util_1 = require("builder-util");
const fs_extra_1 = require("fs-extra");
const path = require("path");
const tiny_async_pool_1 = require("tiny-async-pool");
const index_1 = require("../index");
const pathManager_1 = require("../util/pathManager");
const resolve_1 = require("../util/resolve");
const electronMac_1 = require("./electronMac");
const electronVersion_1 = require("./electronVersion");
const electronWin_1 = require("./electronWin");
const injectFFMPEG_1 = require("./injectFFMPEG");
function createBrandingOpts(opts) {
    var _a, _b;
    return {
        projectName: ((_a = opts.electronBranding) === null || _a === void 0 ? void 0 : _a.projectName) || "electron",
        productName: ((_b = opts.electronBranding) === null || _b === void 0 ? void 0 : _b.productName) || "Electron",
    };
}
function createDownloadOpts(opts, platform, arch, electronVersion) {
    return {
        platform,
        arch,
        version: electronVersion,
        ...opts.electronDownload,
    };
}
async function beforeCopyExtraFiles(options) {
    const { appOutDir, packager } = options;
    const electronBranding = createBrandingOpts(packager.config);
    if (packager.platform === index_1.Platform.LINUX) {
        const linuxPackager = packager;
        const executable = path.join(appOutDir, linuxPackager.executableName);
        await (0, fs_extra_1.rename)(path.join(appOutDir, electronBranding.projectName), executable);
    }
    else if (packager.platform === index_1.Platform.WINDOWS) {
        const executable = path.join(appOutDir, `${packager.appInfo.productFilename}.exe`);
        await (0, fs_extra_1.rename)(path.join(appOutDir, `${electronBranding.projectName}.exe`), executable);
        if (options.asarIntegrity) {
            await (0, electronWin_1.addWinAsarIntegrity)(executable, options.asarIntegrity);
        }
    }
    else {
        await (0, electronMac_1.createMacApp)(packager, appOutDir, options.asarIntegrity, options.platformName === "mas");
    }
    await removeUnusedLanguagesIfNeeded(options);
}
async function removeUnusedLanguagesIfNeeded(options) {
    const { packager: { config, platformSpecificBuildOptions }, } = options;
    const wantedLanguages = (0, builder_util_1.asArray)(platformSpecificBuildOptions.electronLanguages || config.electronLanguages);
    if (!wantedLanguages.length) {
        return;
    }
    const { dirs, langFileExt } = getLocalesConfig(options);
    // noinspection SpellCheckingInspection
    const deletedFiles = async (dir) => {
        await (0, tiny_async_pool_1.default)(builder_util_1.MAX_FILE_REQUESTS, await (0, fs_extra_1.readdir)(dir), async (file) => {
            if (path.extname(file) !== langFileExt) {
                return;
            }
            const language = path.basename(file, langFileExt);
            if (!wantedLanguages.includes(language)) {
                return (0, fs_extra_1.rm)(path.join(dir, file), { recursive: true, force: true });
            }
            return;
        });
    };
    await Promise.all(dirs.map(deletedFiles));
    function getLocalesConfig(options) {
        const { appOutDir, packager } = options;
        if (packager.platform === index_1.Platform.MAC) {
            return { dirs: [packager.getResourcesDir(appOutDir), packager.getMacOsElectronFrameworkResourcesDir(appOutDir)], langFileExt: ".lproj" };
        }
        return { dirs: [path.join(packager.getResourcesDir(appOutDir), "..", "locales")], langFileExt: ".pak" };
    }
}
class ElectronFramework {
    constructor(name, version, distMacOsAppName) {
        this.name = name;
        this.version = version;
        this.distMacOsAppName = distMacOsAppName;
        // noinspection JSUnusedGlobalSymbols
        this.macOsDefaultTargets = ["zip", "dmg"];
        // noinspection JSUnusedGlobalSymbols
        this.defaultAppIdPrefix = "com.electron.";
        // noinspection JSUnusedGlobalSymbols
        this.isCopyElevateHelper = true;
        // noinspection JSUnusedGlobalSymbols
        this.isNpmRebuildRequired = true;
    }
    getDefaultIcon(platform) {
        if (platform === index_1.Platform.LINUX) {
            return path.join((0, pathManager_1.getTemplatePath)("icons"), "electron-linux");
        }
        else {
            // default icon is embedded into app skeleton
            return null;
        }
    }
    async prepareApplicationStageDirectory(options) {
        const downloadOptions = createDownloadOpts(options.packager.config, options.platformName, options.arch, this.version);
        const shouldCleanup = await unpack(options, downloadOptions, this.distMacOsAppName);
        await cleanupAfterUnpack(options, this.distMacOsAppName, shouldCleanup);
        if (options.packager.config.downloadAlternateFFmpeg) {
            await (0, injectFFMPEG_1.default)(options, this.version);
        }
    }
    beforeCopyExtraFiles(options) {
        return beforeCopyExtraFiles(options);
    }
}
async function createElectronFrameworkSupport(configuration, packager) {
    let version = configuration.electronVersion;
    if (version == null) {
        // for prepacked app asar no dev deps in the app.asar
        if (packager.isPrepackedAppAsar) {
            version = await (0, electronVersion_1.getElectronVersionFromInstalled)(packager.projectDir);
            if (version == null) {
                throw new Error(`Cannot compute electron version for prepacked asar`);
            }
        }
        else {
            version = await (0, electronVersion_1.computeElectronVersion)(packager.projectDir);
        }
        configuration.electronVersion = version;
    }
    const branding = createBrandingOpts(configuration);
    return new ElectronFramework(branding.projectName, version, `${branding.productName}.app`);
}
/**
 * Unpacks a custom or default Electron distribution into the app output directory.
 */
async function unpack(prepareOptions, downloadOptions, distMacOsAppName) {
    const downloadUsingAdjustedConfig = (options) => {
        return (0, builder_util_1.executeAppBuilder)(["unpack-electron", "--configuration", JSON.stringify([options]), "--output", appOutDir, "--distMacOsAppName", distMacOsAppName]);
    };
    const copyUnpackedElectronDistribution = async (folderPath) => {
        builder_util_1.log.info({ electronDist: builder_util_1.log.filePath(folderPath) }, "using custom unpacked Electron distribution");
        const source = packager.getElectronSrcDir(folderPath);
        const destination = packager.getElectronDestinationDir(appOutDir);
        builder_util_1.log.info({ source, destination }, "copying unpacked Electron");
        await (0, fs_extra_1.emptyDir)(appOutDir);
        await (0, builder_util_1.copyDir)(source, destination, {
            isUseHardLink: builder_util_1.DO_NOT_USE_HARD_LINKS,
        });
        return false;
    };
    const selectElectron = async (filepath) => {
        const resolvedDist = path.isAbsolute(filepath) ? filepath : path.resolve(packager.projectDir, filepath);
        const electronDistStats = await (0, builder_util_1.statOrNull)(resolvedDist);
        if (!electronDistStats) {
            throw new Error(`The specified electronDist does not exist: ${resolvedDist}. Please provide a valid path to the Electron zip file, cache directory, or electron build directory.`);
        }
        if (resolvedDist.endsWith(".zip")) {
            builder_util_1.log.info({ zipFile: resolvedDist }, "using custom electronDist zip file");
            await downloadUsingAdjustedConfig({
                ...downloadOptions,
                cache: path.dirname(resolvedDist), // set custom directory to the zip file's directory
                customFilename: path.basename(resolvedDist), // set custom filename to the zip file's name
            });
            return false; // do not clean up after unpacking, it's a custom bundle and we should respect its configuration/contents as required
        }
        if (electronDistStats.isDirectory()) {
            // backward compatibility: if electronDist is a directory, check for the default zip file inside it
            const files = await (0, fs_extra_1.readdir)(resolvedDist);
            if (files.includes(defaultZipName)) {
                builder_util_1.log.info({ electronDist: builder_util_1.log.filePath(resolvedDist) }, "using custom electronDist directory");
                await downloadUsingAdjustedConfig({
                    ...downloadOptions,
                    cache: resolvedDist,
                    customFilename: defaultZipName,
                });
                return false;
            }
            // if we reach here, it means the provided electronDist is neither a zip file nor a directory with the default zip file
            // e.g. we treat it as a custom already-unpacked Electron distribution
            return await copyUnpackedElectronDistribution(resolvedDist);
        }
        throw new Error(`The specified electronDist is neither a zip file nor a directory: ${resolvedDist}. Please provide a valid path to the Electron zip file or cache directory.`);
    };
    const { packager, appOutDir, platformName } = prepareOptions;
    const { version, arch } = downloadOptions;
    const defaultZipName = `electron-v${version}-${platformName}-${arch}.zip`;
    const electronDist = packager.config.electronDist;
    if (typeof electronDist === "string" && !(0, builder_util_1.isEmptyOrSpaces)(electronDist)) {
        return selectElectron(electronDist);
    }
    let resolvedDist = null;
    try {
        const electronDistHook = await (0, resolve_1.resolveFunction)(packager.appInfo.type, electronDist, "electronDist");
        resolvedDist = typeof electronDistHook === "function" ? await Promise.resolve(electronDistHook(prepareOptions)) : electronDistHook;
    }
    catch (error) {
        builder_util_1.log.warn({ error }, "Failed to resolve electronDist, using default unpack logic");
    }
    if (resolvedDist == null) {
        // if no custom electronDist is provided, use the default unpack logic
        builder_util_1.log.debug(null, "no custom electronDist provided, unpacking default Electron distribution");
        await downloadUsingAdjustedConfig(downloadOptions);
        return true; // indicates that we should clean up after unpacking
    }
    return selectElectron(resolvedDist);
}
function cleanupAfterUnpack(prepareOptions, distMacOsAppName, isFullCleanup) {
    const out = prepareOptions.appOutDir;
    const isMac = prepareOptions.packager.platform === index_1.Platform.MAC;
    const resourcesPath = isMac ? path.join(out, distMacOsAppName, "Contents", "Resources") : path.join(out, "resources");
    return Promise.all([
        isFullCleanup ? (0, builder_util_1.unlinkIfExists)(path.join(resourcesPath, "default_app.asar")) : Promise.resolve(),
        isFullCleanup ? (0, builder_util_1.unlinkIfExists)(path.join(out, "version")) : Promise.resolve(),
        isMac
            ? Promise.resolve()
            : (0, fs_extra_1.rename)(path.join(out, "LICENSE"), path.join(out, "LICENSE.electron.txt")).catch(() => {
                /* ignore */
            }),
    ]);
}
//# sourceMappingURL=ElectronFramework.js.map