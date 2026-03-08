"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APP_RUN_ENTRYPOINT = void 0;
const builder_util_1 = require("builder-util");
const fs_extra_1 = require("fs-extra");
const lazy_val_1 = require("lazy-val");
const path = require("path");
const core_1 = require("../../core");
const PublishManager_1 = require("../../publish/PublishManager");
const appBuilder_1 = require("../../util/appBuilder");
const license_1 = require("../../util/license");
const targetUtil_1 = require("../targetUtil");
const appImageUtil_1 = require("./appImageUtil");
// https://unix.stackexchange.com/questions/375191/append-to-sub-directory-inside-squashfs-file
exports.APP_RUN_ENTRYPOINT = "AppRun";
class AppImageTarget extends core_1.Target {
    constructor(_ignored, packager, helper, outDir) {
        super("appImage");
        this.packager = packager;
        this.helper = helper;
        this.outDir = outDir;
        this.options = { ...this.packager.platformSpecificBuildOptions, ...this.packager.config[this.name] };
        this.desktopEntry = new lazy_val_1.Lazy(() => {
            var _a;
            const args = ((_a = this.options.executableArgs) === null || _a === void 0 ? void 0 : _a.join(" ")) || "--no-sandbox";
            return helper.computeDesktopEntry(this.options, `${exports.APP_RUN_ENTRYPOINT} ${args} %U`, {
                "X-AppImage-Version": `${packager.appInfo.buildVersion}`,
            });
        });
    }
    async build(appOutDir, arch) {
        var _a;
        const packager = this.packager;
        const options = this.options;
        // https://github.com/electron-userland/electron-builder/issues/775
        // https://github.com/electron-userland/electron-builder/issues/1726
        const artifactName = packager.expandArtifactNamePattern(options, "AppImage", arch);
        const artifactPath = path.join(this.outDir, artifactName);
        await packager.info.emitArtifactBuildStarted({
            targetPresentableName: "AppImage",
            file: artifactPath,
            arch,
        });
        // Parallelize independent async operations
        const [publishConfig, stageDir, desktopEntry, icons, license] = await Promise.all([
            (0, PublishManager_1.getAppUpdatePublishConfiguration)(packager, options, arch, false),
            (0, targetUtil_1.createStageDir)(this, packager, arch),
            this.desktopEntry.value,
            this.helper.icons,
            (0, license_1.getNotLocalizedLicenseFile)(options.license, this.packager, ["txt", "html"]),
        ]);
        if (publishConfig != null) {
            await (0, fs_extra_1.outputFile)(path.join(packager.getResourcesDir(appOutDir), "app-update.yml"), (0, builder_util_1.serializeToYaml)(publishConfig));
        }
        if (this.packager.packagerOptions.effectiveOptionComputed != null && (await this.packager.packagerOptions.effectiveOptionComputed({ desktop: desktopEntry }))) {
            await stageDir.cleanup();
            return;
        }
        let updateInfo;
        try {
            const appimageTool = (_a = this.packager.config.toolsets) === null || _a === void 0 ? void 0 : _a.appimage;
            if (appimageTool == null || appimageTool === "0.0.0") {
                updateInfo = await this.buildFuse2AppImage({ stageDir, arch, artifactPath, appOutDir, options, packager, desktopEntry, icons, license });
            }
            else {
                updateInfo = await (0, appImageUtil_1.buildAppImage)({
                    appDir: appOutDir,
                    stageDir: stageDir.dir,
                    arch,
                    output: artifactPath,
                    options: {
                        productName: this.packager.appInfo.productName,
                        productFilename: this.packager.appInfo.productFilename,
                        executableName: this.packager.executableName,
                        license,
                        desktopEntry,
                        icons,
                        fileAssociations: this.packager.fileAssociations,
                        compression: this.packager.compression === "maximum" ? "xz" : undefined,
                    },
                });
            }
        }
        catch (error) {
            builder_util_1.log.error({ error: error.message }, "failed to build AppImage");
            await stageDir.cleanup().catch(() => { });
            throw error;
        }
        await stageDir.cleanup();
        await packager.info.emitArtifactBuildCompleted({
            file: artifactPath,
            safeArtifactName: packager.computeSafeArtifactName(artifactName, "AppImage", arch, false),
            target: this,
            arch,
            packager,
            isWriteUpdateInfo: true,
            updateInfo,
        });
    }
    async buildFuse2AppImage(props) {
        const { stageDir, arch, artifactPath, appOutDir, options, packager, desktopEntry, icons, license } = props;
        const args = [
            "appimage",
            "--stage",
            stageDir.dir,
            "--arch",
            builder_util_1.Arch[arch],
            "--output",
            artifactPath,
            "--app",
            appOutDir,
            "--configuration",
            JSON.stringify({
                productName: this.packager.appInfo.productName,
                productFilename: this.packager.appInfo.productFilename,
                desktopEntry,
                executableName: this.packager.executableName,
                icons,
                fileAssociations: this.packager.fileAssociations,
                ...options,
            }),
        ];
        (0, appBuilder_1.objectToArgs)(args, {
            license,
        });
        if (packager.compression === "maximum") {
            args.push("--compression", "xz");
        }
        const updateInfo = await (0, appBuilder_1.executeAppBuilderAsJson)(args);
        return updateInfo;
    }
}
exports.default = AppImageTarget;
//# sourceMappingURL=AppImageTarget.js.map