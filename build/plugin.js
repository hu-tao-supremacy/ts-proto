"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const plugin_1 = require("ts-proto-descriptors/google/protobuf/compiler/plugin");
const util_1 = require("util");
const utils_1 = require("./utils");
const main_1 = require("./main");
const types_1 = require("./types");
const options_1 = require("./options");
// this would be the plugin called by the protoc compiler
async function main() {
    const stdin = await utils_1.readToBuffer(process.stdin);
    // const json = JSON.parse(stdin.toString());
    // const request = CodeGeneratorRequest.fromObject(json);
    const request = plugin_1.CodeGeneratorRequest.decode(stdin);
    const options = options_1.optionsFromParameter(request.parameter);
    const typeMap = types_1.createTypeMap(request, options);
    const utils = main_1.makeUtils(options);
    const ctx = { typeMap, options, utils };
    const files = await Promise.all(request.protoFile.map(async (file) => {
        const [path, code] = main_1.generateFile(ctx, file);
        const spec = await code.toStringWithImports({ ...options_1.getTsPoetOpts(options), path });
        return { name: path, content: utils_1.prefixDisableLinter(spec) };
    }));
    const response = plugin_1.CodeGeneratorResponse.fromPartial({
        file: files,
        supportedFeatures: plugin_1.CodeGeneratorResponse_Feature.FEATURE_PROTO3_OPTIONAL,
    });
    const buffer = plugin_1.CodeGeneratorResponse.encode(response).finish();
    const write = util_1.promisify(process.stdout.write).bind(process.stdout);
    await write(Buffer.from(buffer));
}
main()
    .then(() => {
    process.exit(0);
})
    .catch((e) => {
    process.stderr.write('FAILED!');
    process.stderr.write(e.message);
    process.stderr.write(e.stack);
    process.exit(1);
});
