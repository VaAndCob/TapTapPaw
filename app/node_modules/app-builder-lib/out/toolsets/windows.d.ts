import { Arch } from "builder-util";
import { Nullish } from "builder-util-runtime";
import { ToolsetConfig } from "../configuration";
import { ToolInfo } from "../util/bundledTool";
export declare const wincodesignChecksums: {
    readonly "0.0.0": {};
    readonly "1.0.0": {
        readonly "rcedit-windows-2_0_0.zip": "NrBrX6M6qMG5vhUlMsD1P+byOfBq45KAD12Ono0lEfX8ynu3t0DmwJEMsRIjV/l0/SlptzM/eQXtY6+mOsvyjw==";
        readonly "win-codesign-darwin-arm64.zip": "D2w1EXL+4yTZ4vLvc2R+fox1nCl3D+o4m8CPo8BcIXNXHy5evnIgRGycb1nXNwRvyzS7trmOdVabW4W+A8CY7w==";
        readonly "win-codesign-darwin-x86_64.zip": "eF8TsYdSnPp2apYx/LoJMwwOvUAWo0ew0yqPxKfW6VflND2lmloJKxyfJzcBqhb1bvUNZAJtGuXU6KKOrUtPPQ==";
        readonly "win-codesign-linux-amd64.zip": "bHk5IbCv90BELGQxN7YUiiwVjQ10tEmIgLWn30/+9ejCGW6Hx1ammuX+katIxSm0osCrSGkHKY+E9Lo2qZCx5A==";
        readonly "win-codesign-linux-arm64.zip": "KLxwF6pvbyg37PI+IES17oOmrynaK3HR5fsFS7lUDzm7cNR8CUDirarwFP+G60Rl4cRC8hKbwNPumnPGStBXWQ==";
        readonly "win-codesign-linux-i386.zip": "sgI+axxrzKGbrKey9cIHg+FfniQqD6+u80xN6OQfcPcGmA3+z1R1Q0W/Wxy+qJkylhIgcRgeHgjzWkdDDNucyA==";
        readonly "win-codesign-windows-x64.zip": "XixPi+4XhoOdN5j90jx9rDgVAI0KHuM50D3dcWsn9NCxlZ5iTbDscvU7ARQG9h4+tWnprYZ2qbSoJiCvqlWZ4g==";
        readonly "windows-kits-bundle-10_0_26100_0.zip": "vvvH4J0JG2FoUcpRzXxrQHyONCALUZjQigff5CawjDP1DuwwwdVcZdfE33IQoRl4TqMOSu56hOy7nN72hskqyg==";
    };
    readonly "1.1.0": {
        readonly "rcedit-windows-2_0_0.zip": "sGDrjBJTVuhvcwbGAHv3/RVd9SA0HKBIDrtLk7NaAW1gSsmY0QZGn9fuhs/cjYHxZf39+PY2dOzqgLilhyeftA==";
        readonly "win-codesign-darwin-arm64.zip": "d0M76FslJ8+WxTJmHZjaGxYA/9yLS++zETrrZ57qf+ia/MUy9sRRohpPhZ62VgpUusUdNqqL6y3Zu1Oux/CBbQ==";
        readonly "win-codesign-darwin-x86_64.zip": "JgPwyRgt9MREDyjrUlccaeEVwfcXyBokSoiEvtJOipcPIAdOh6ECwj7ScjyzClWmh1WSnTEWKw6cFKwMXwxPTw==";
        readonly "win-codesign-linux-amd64.zip": "xqlwK9INio4Twp2sMH98uUKG+BuOLG8GJTeypD+Ay26TpV+/TIanOMvWMi2UB6dFW/B/XMVC2JDr+rlWikVJ0A==";
        readonly "win-codesign-linux-arm64.zip": "DQES7Koe6bOBbjuJWSRTFu41YfNeja5PLgL24ArklM1iSXZSb6AawgS0cSlwgIxmKfa08/xQ6emxfumg8sSA5A==";
        readonly "win-codesign-linux-i386.zip": "B+zhnU+5hJwmyXFs2ZK3lvIziqmz8dHStgZmSVgSXbKPx1SjZCm7JXk1FgLxk9O/mob5Hk/rJfrsO0WMjwgSAQ==";
        readonly "win-codesign-windows-x64.zip": "lLEOXdJP3dzjRI+/E3Rf8e3RqEh1qs0DRMRgmxHDbuSmXABAwEzhW+tj8g/VMIlxPTD12cyvWIyMbRZq4RxvsA==";
        readonly "windows-kits-bundle-10_0_26100_0.zip": "09Fh+zSwEiJMA6R2cW6tvpAlUDAq3h7kFzXt4scos62fygTMAK/G+JoRV4FMwBLcNiwUcn+A5ju2sJLHEfVdKA==";
    };
};
type CodeSignVersionKey = keyof typeof wincodesignChecksums;
export declare function getSignToolPath(winCodeSign: ToolsetConfig["winCodeSign"] | Nullish, isWin: boolean): Promise<ToolInfo>;
export declare function getWindowsKitsBundle({ winCodeSign, arch }: {
    winCodeSign: CodeSignVersionKey | Nullish;
    arch: Arch;
}): Promise<{
    kit: string;
    appxAssets: string;
}>;
export declare function isOldWin6(): boolean;
export declare function getRceditBundle(winCodeSign: ToolsetConfig["winCodeSign"] | Nullish): Promise<{
    x86: string;
    x64: string;
}>;
export {};
