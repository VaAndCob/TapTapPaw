"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WinPackager = void 0;
const builder_util_1 = require("builder-util");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const ci_info_1 = require("ci-info");
const lazy_val_1 = require("lazy-val");
const path = require("path");
const windowsCodeSign_1 = require("./codeSign/windowsCodeSign");
const windowsSignAzureManager_1 = require("./codeSign/windowsSignAzureManager");
const windowsSignToolManager_1 = require("./codeSign/windowsSignToolManager");
const core_1 = require("./core");
const platformPackager_1 = require("./platformPackager");
const NsisTarget_1 = require("./targets/nsis/NsisTarget");
const nsisUtil_1 = require("./targets/nsis/nsisUtil");
const WebInstallerTarget_1 = require("./targets/nsis/WebInstallerTarget");
const targetFactory_1 = require("./targets/targetFactory");
const cacheManager_1 = require("./util/cacheManager");
const flags_1 = require("./util/flags");
const timer_1 = require("./util/timer");
const vm_1 = require("./vm/vm");
const wine_1 = require("./wine");
const windows_1 = require("./toolsets/windows");
class WinPackager extends platformPackager_1.PlatformPackager {
    get isForceCodeSigningVerification() {
        return this.platformSpecificBuildOptions.verifyUpdateCodeSignature !== false;
    }
    constructor(info) {
        super(info, core_1.Platform.WINDOWS);
        this._iconPath = new lazy_val_1.Lazy(() => this.getOrConvertIcon("ico"));
        this.vm = new lazy_val_1.Lazy(() => (process.platform === "win32" ? Promise.resolve(new vm_1.VmManager()) : (0, vm_1.getWindowsVm)(this.debugLogger)));
        this.signingManager = new lazy_val_1.Lazy(async () => {
            let manager;
            if (this.platformSpecificBuildOptions.azureSignOptions != null) {
                manager = new windowsSignAzureManager_1.WindowsSignAzureManager(this);
            }
            else {
                manager = new windowsSignToolManager_1.WindowsSignToolManager(this);
            }
            await manager.initialize();
            return manager;
        });
        this.signingQueue = Promise.resolve(true);
    }
    get defaultTarget() {
        return ["nsis"];
    }
    createTargets(targets, mapper) {
        let copyElevateHelper;
        const getCopyElevateHelper = () => {
            if (copyElevateHelper == null) {
                copyElevateHelper = new nsisUtil_1.CopyElevateHelper();
            }
            return copyElevateHelper;
        };
        let helper;
        const getHelper = () => {
            if (helper == null) {
                helper = new nsisUtil_1.AppPackageHelper(getCopyElevateHelper());
            }
            return helper;
        };
        for (const name of targets) {
            if (name === core_1.DIR_TARGET) {
                continue;
            }
            if (name === "nsis" || name === "portable") {
                mapper(name, outDir => new NsisTarget_1.NsisTarget(this, outDir, name, getHelper()));
            }
            else if (name === "nsis-web") {
                // package file format differs from nsis target
                mapper(name, outDir => new WebInstallerTarget_1.WebInstallerTarget(this, path.join(outDir, name), name, new nsisUtil_1.AppPackageHelper(getCopyElevateHelper())));
            }
            else {
                const targetClass = (() => {
                    switch (name) {
                        case "squirrel":
                            try {
                                return require("electron-builder-squirrel-windows").default;
                            }
                            catch (e) {
                                throw new builder_util_1.InvalidConfigurationError(`Module electron-builder-squirrel-windows must be installed in addition to build Squirrel.Windows: ${e.stack || e}`);
                            }
                        case "appx":
                            return require("./targets/AppxTarget").default;
                        case "msi":
                            return require("./targets/MsiTarget").default;
                        case "msiwrapped":
                            return require("./targets/MsiWrappedTarget").default;
                        default:
                            return null;
                    }
                })();
                mapper(name, outDir => (targetClass === null ? (0, targetFactory_1.createCommonTarget)(name, outDir, this) : new targetClass(this, outDir, name)));
            }
        }
    }
    getIconPath() {
        return this._iconPath.value;
    }
    doGetCscPassword() {
        var _a;
        return (0, platformPackager_1.chooseNotNull)((0, platformPackager_1.chooseNotNull)((_a = this.platformSpecificBuildOptions.signtoolOptions) === null || _a === void 0 ? void 0 : _a.certificatePassword, process.env.WIN_CSC_KEY_PASSWORD), super.doGetCscPassword());
    }
    async signIf(file) {
        const logFields = { file: builder_util_1.log.filePath(file) };
        if (!this.shouldSignFile(file, true)) {
            builder_util_1.log.info(logFields, "file signing skipped via signExts configuration");
            return false;
        }
        this.signingQueue = this.signingQueue.then(() => this._sign(file));
        return this.signingQueue;
    }
    async _sign(file) {
        const signOptions = {
            path: file,
            options: this.platformSpecificBuildOptions,
        };
        const didSignSuccessfully = await (0, windowsCodeSign_1.signWindows)(signOptions, this);
        if (!didSignSuccessfully && this.forceCodeSigning) {
            throw new builder_util_1.InvalidConfigurationError(`App is not signed and "forceCodeSigning" is set to true, please ensure that code signing configuration is correct, please see https://electron.build/code-signing`);
        }
        return didSignSuccessfully;
    }
    async signAndEditResources(file, arch, outDir, internalName, requestedExecutionLevel) {
        var _a, _b, _c;
        const appInfo = this.appInfo;
        const files = [];
        const args = [
            file,
            "--set-version-string",
            "FileDescription",
            appInfo.productName,
            "--set-version-string",
            "ProductName",
            appInfo.productName,
            "--set-version-string",
            "LegalCopyright",
            appInfo.copyright,
            "--set-file-version",
            appInfo.shortVersion || appInfo.buildVersion,
            "--set-product-version",
            appInfo.shortVersionWindows || appInfo.getVersionInWeirdWindowsForm(),
        ];
        if (internalName != null) {
            args.push("--set-version-string", "InternalName", internalName, "--set-version-string", "OriginalFilename", "");
        }
        if (requestedExecutionLevel != null && requestedExecutionLevel !== "asInvoker") {
            args.push("--set-requested-execution-level", requestedExecutionLevel);
        }
        (0, builder_util_1.use)(appInfo.companyName, it => args.push("--set-version-string", "CompanyName", it));
        (0, builder_util_1.use)(this.platformSpecificBuildOptions.legalTrademarks, it => args.push("--set-version-string", "LegalTrademarks", it));
        const iconPath = await this.getIconPath();
        (0, builder_util_1.use)(iconPath, it => {
            files.push(it);
            args.push("--set-icon", it);
        });
        const config = this.config;
        const cscInfoForCacheDigest = !(0, flags_1.isBuildCacheEnabled)() || ci_info_1.isCI || config.electronDist != null ? null : await (await this.signingManager.value).cscInfo.value;
        let buildCacheManager = null;
        // resources editing doesn't change executable for the same input and executed quickly - no need to complicate
        if (cscInfoForCacheDigest != null) {
            const cscFile = cscInfoForCacheDigest.file;
            if (cscFile != null) {
                files.push(cscFile);
            }
            const timer = (0, timer_1.time)("executable cache");
            const hash = (0, crypto_1.createHash)("sha512");
            hash.update(config.electronVersion || "no electronVersion");
            hash.update(JSON.stringify(this.platformSpecificBuildOptions));
            hash.update(JSON.stringify(args));
            hash.update(((_a = this.platformSpecificBuildOptions.signtoolOptions) === null || _a === void 0 ? void 0 : _a.certificateSha1) || "no certificateSha1");
            hash.update(((_b = this.platformSpecificBuildOptions.signtoolOptions) === null || _b === void 0 ? void 0 : _b.certificateSubjectName) || "no subjectName");
            buildCacheManager = new cacheManager_1.BuildCacheManager(outDir, file, arch);
            if (await buildCacheManager.copyIfValid(await (0, cacheManager_1.digest)(hash, files))) {
                timer.end();
                return;
            }
            timer.end();
        }
        const timer = (0, timer_1.time)("wine&sign");
        // rcedit crashed of executed using wine, resourcehacker works
        if (process.platform === "win32" || process.platform === "darwin") {
            await (0, builder_util_1.executeAppBuilder)(["rcedit", "--args", JSON.stringify(args)], undefined /* child-process */, {}, 3 /* retry three times */);
        }
        else if (this.info.framework.name === "electron") {
            const vendor = await (0, windows_1.getRceditBundle)((_c = this.config.toolsets) === null || _c === void 0 ? void 0 : _c.winCodeSign);
            await (0, wine_1.execWine)(vendor.x86, vendor.x64, args);
        }
        await this.signIf(file);
        timer.end();
        if (buildCacheManager != null) {
            await buildCacheManager.save();
        }
    }
    shouldSignFile(file, fallbackValue = false) {
        const backwardCompatibility = file.endsWith(".exe");
        const signExts = this.platformSpecificBuildOptions.signExts;
        if (!(signExts === null || signExts === void 0 ? void 0 : signExts.length)) {
            return backwardCompatibility || fallbackValue;
        }
        // process patterns ( !exe => exclude .exe, .dll => include .dll )
        // we process first to allow literal negatives in case a filename matches "help!.txt" or similar
        if (signExts.some(ext => file.endsWith(ext))) {
            return true;
        }
        // process negative patterns
        if (signExts.some(ext => ext.startsWith("!") && file.endsWith(ext.substring(1)))) {
            return false;
        }
        // if no explicit patterns matched, fall back to backward compatibility
        return backwardCompatibility || fallbackValue;
    }
    createTransformerForExtraFiles(packContext) {
        if (this.platformSpecificBuildOptions.signAndEditExecutable === false) {
            return null;
        }
        return file => {
            if (this.shouldSignFile(file)) {
                const parentDir = path.dirname(file);
                if (parentDir !== packContext.appOutDir) {
                    return new builder_util_1.CopyFileTransformer(file => this.signIf(file));
                }
            }
            return null;
        };
    }
    async signApp(packContext, isAsar) {
        const exeFileName = `${this.appInfo.productFilename}.exe`;
        if (this.platformSpecificBuildOptions.signAndEditExecutable === false) {
            return false;
        }
        const files = await (0, promises_1.readdir)(packContext.appOutDir);
        for (const file of files) {
            if (file === exeFileName) {
                await this.signAndEditResources(path.join(packContext.appOutDir, exeFileName), packContext.arch, packContext.outDir, path.basename(exeFileName, ".exe"), this.platformSpecificBuildOptions.requestedExecutionLevel);
            }
            else if (this.shouldSignFile(file)) {
                await this.signIf(path.join(packContext.appOutDir, file));
            }
        }
        if (!isAsar) {
            return true;
        }
        const filesPromise = (filepath) => {
            const outDir = path.join(packContext.appOutDir, ...filepath);
            return (0, builder_util_1.walk)(outDir, (file, stat) => stat.isDirectory() || this.shouldSignFile(file));
        };
        const filesToSign = await Promise.all([filesPromise(["resources", "app.asar.unpacked"]), filesPromise(["swiftshader"])]);
        for (const file of filesToSign.flat(1)) {
            await this.signIf(file);
        }
        return true;
    }
}
exports.WinPackager = WinPackager;
//# sourceMappingURL=winPackager.js.map