"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTsPoetOpts = exports.optionsFromParameter = exports.defaultOptions = exports.OneofOption = exports.EnvOption = exports.LongOption = void 0;
var LongOption;
(function (LongOption) {
    LongOption["NUMBER"] = "number";
    LongOption["LONG"] = "long";
    LongOption["STRING"] = "string";
})(LongOption = exports.LongOption || (exports.LongOption = {}));
var EnvOption;
(function (EnvOption) {
    EnvOption["NODE"] = "node";
    EnvOption["BROWSER"] = "browser";
    EnvOption["BOTH"] = "both";
})(EnvOption = exports.EnvOption || (exports.EnvOption = {}));
var OneofOption;
(function (OneofOption) {
    OneofOption["PROPERTIES"] = "properties";
    OneofOption["UNIONS"] = "unions";
})(OneofOption = exports.OneofOption || (exports.OneofOption = {}));
function defaultOptions() {
    return {
        context: false,
        snakeToCamel: true,
        forceLong: LongOption.NUMBER,
        useOptionals: false,
        useDate: true,
        oneof: OneofOption.PROPERTIES,
        esModuleInterop: false,
        lowerCaseServiceMethods: false,
        outputEncodeMethods: true,
        outputJsonMethods: true,
        outputPartialMethods: true,
        stringEnums: false,
        constEnums: false,
        outputClientImpl: true,
        returnObservable: false,
        addGrpcMetadata: false,
        addNestjsRestParameter: false,
        nestJs: false,
        env: EnvOption.BOTH,
        unrecognizedEnum: true,
        exportCommonSymbols: true,
        outputSchema: false,
    };
}
exports.defaultOptions = defaultOptions;
const nestJsOptions = {
    lowerCaseServiceMethods: true,
    outputEncodeMethods: false,
    outputJsonMethods: false,
    outputPartialMethods: false,
    outputClientImpl: false,
    useDate: false,
};
function optionsFromParameter(parameter) {
    const options = defaultOptions();
    if (parameter) {
        const parsed = parseParameter(parameter);
        if (parsed.nestJs) {
            Object.assign(options, nestJsOptions);
        }
        Object.assign(options, parsed);
    }
    // Treat forceLong=true as LONG
    if (options.forceLong === true) {
        options.forceLong = LongOption.LONG;
    }
    return options;
}
exports.optionsFromParameter = optionsFromParameter;
// A very naive parse function, eventually could/should use iots/runtypes
function parseParameter(parameter) {
    const options = {};
    const pairs = parameter.split(',').map((s) => s.split('='));
    pairs.forEach(([key, value]) => {
        options[key] = value === 'true' ? true : value === 'false' ? false : value;
    });
    return options;
}
function getTsPoetOpts(options) {
    if (options.esModuleInterop) {
        return { forceDefaultImport: ['protobufjs/minimal'] };
    }
    else {
        return {};
    }
}
exports.getTsPoetOpts = getTsPoetOpts;
