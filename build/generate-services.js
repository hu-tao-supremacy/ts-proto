"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDataLoaderOptionsType = exports.generateDataLoadersType = exports.generateRpcType = exports.generateServiceClientImpl = exports.generateService = void 0;
const ts_poet_1 = require("ts-poet");
const types_1 = require("./types");
const utils_1 = require("./utils");
const sourceInfo_1 = require("./sourceInfo");
const case_1 = require("./case");
const main_1 = require("./main");
const hash = ts_poet_1.imp('hash*object-hash');
const dataloader = ts_poet_1.imp('DataLoader*dataloader');
const Reader = ts_poet_1.imp('Reader@protobufjs/minimal');
/**
 * Generates an interface for `serviceDesc`.
 *
 * Some RPC frameworks (i.e. Twirp) can use the same interface, i.e.
 * `getFoo(req): Promise<res>` for the client-side and server-side,
 * which is the intent for this interface.
 *
 * Other RPC frameworks (i.e. NestJS) that need different client-side
 * vs. server-side code/interfaces are handled separately.
 */
function generateService(ctx, fileDesc, sourceInfo, serviceDesc) {
    var _a;
    const { options, utils } = ctx;
    const chunks = [];
    utils_1.maybeAddComment(sourceInfo, chunks, (_a = serviceDesc.options) === null || _a === void 0 ? void 0 : _a.deprecated);
    const maybeTypeVar = options.context ? `<${main_1.contextTypeVar}>` : '';
    chunks.push(ts_poet_1.code `export interface ${serviceDesc.name}${maybeTypeVar} {`);
    serviceDesc.method.forEach((methodDesc, index) => {
        var _a;
        const name = options.lowerCaseServiceMethods ? case_1.camelCase(methodDesc.name) : methodDesc.name;
        const info = sourceInfo.lookup(sourceInfo_1.Fields.service.method, index);
        utils_1.maybeAddComment(info, chunks, (_a = methodDesc.options) === null || _a === void 0 ? void 0 : _a.deprecated);
        const params = [];
        if (options.context) {
            params.push(ts_poet_1.code `ctx: Context`);
        }
        let inputType = types_1.requestType(ctx, methodDesc);
        // the grpc-web clients auto-`fromPartial` the input before handing off to grpc-web's
        // serde runtime, so it's okay to accept partial results from the client
        if (options.outputClientImpl === 'grpc-web') {
            inputType = ts_poet_1.code `${utils.DeepPartial}<${inputType}>`;
        }
        params.push(ts_poet_1.code `request: ${inputType}`);
        // Use metadata as last argument for interface only configuration
        if (options.outputClientImpl === 'grpc-web') {
            params.push(ts_poet_1.code `metadata?: grpc.Metadata`);
        }
        else if (options.addGrpcMetadata) {
            const q = options.addNestjsRestParameter ? '' : '?';
            params.push(ts_poet_1.code `metadata${q}: Metadata@grpc`);
        }
        if (options.addNestjsRestParameter) {
            params.push(ts_poet_1.code `...rest: any`);
        }
        // Return observable for interface only configuration, passing returnObservable=true and methodDesc.serverStreaming=true
        let returnType;
        if (options.returnObservable || methodDesc.serverStreaming) {
            returnType = types_1.responseObservable(ctx, methodDesc);
        }
        else {
            returnType = types_1.responsePromise(ctx, methodDesc);
        }
        chunks.push(ts_poet_1.code `${name}(${ts_poet_1.joinCode(params, { on: ',' })}): ${returnType};`);
        // If this is a batch method, auto-generate the singular version of it
        if (options.context) {
            const batchMethod = types_1.detectBatchMethod(ctx, fileDesc, serviceDesc, methodDesc);
            if (batchMethod) {
                const name = batchMethod.methodDesc.name.replace('Batch', 'Get');
                chunks.push(ts_poet_1.code `${name}(
          ctx: Context,
          ${utils_1.singular(batchMethod.inputFieldName)}: ${batchMethod.inputType},
        ): Promise<${batchMethod.outputType}>;`);
            }
        }
    });
    chunks.push(ts_poet_1.code `}`);
    return ts_poet_1.joinCode(chunks, { on: '\n' });
}
exports.generateService = generateService;
function generateRegularRpcMethod(ctx, fileDesc, serviceDesc, methodDesc) {
    const { options } = ctx;
    const Reader = ts_poet_1.imp('Reader@protobufjs/minimal');
    const inputType = types_1.requestType(ctx, methodDesc);
    const outputType = types_1.responseType(ctx, methodDesc);
    const params = [...(options.context ? [ts_poet_1.code `ctx: Context`] : []), ts_poet_1.code `request: ${inputType}`];
    const maybeCtx = options.context ? 'ctx,' : '';
    return ts_poet_1.code `
    ${methodDesc.name}(
      ${ts_poet_1.joinCode(params, { on: ',' })}
    ): ${types_1.responsePromise(ctx, methodDesc)} {
      const data = ${inputType}.encode(request).finish();
      const promise = this.rpc.request(
        ${maybeCtx}
        "${fileDesc.package}.${serviceDesc.name}",
        "${methodDesc.name}",
        data
      );
      return promise.then(data => ${outputType}.decode(new ${Reader}(data)));
    }
  `;
}
function generateServiceClientImpl(ctx, fileDesc, serviceDesc) {
    const { options } = ctx;
    const chunks = [];
    // Define the FooServiceImpl class
    const { name } = serviceDesc;
    const i = options.context ? `${name}<Context>` : name;
    const t = options.context ? `<${main_1.contextTypeVar}>` : '';
    chunks.push(ts_poet_1.code `export class ${name}ClientImpl${t} implements ${i} {`);
    // Create the constructor(rpc: Rpc)
    const rpcType = options.context ? 'Rpc<Context>' : 'Rpc';
    chunks.push(ts_poet_1.code `private readonly rpc: ${rpcType};`);
    chunks.push(ts_poet_1.code `constructor(rpc: ${rpcType}) { this.rpc = rpc; }`);
    // Create a method for each FooService method
    for (const methodDesc of serviceDesc.method) {
        // See if this this fuzzy matches to a batchable method
        if (options.context) {
            const batchMethod = types_1.detectBatchMethod(ctx, fileDesc, serviceDesc, methodDesc);
            if (batchMethod) {
                chunks.push(generateBatchingRpcMethod(ctx, batchMethod));
            }
        }
        if (options.context && methodDesc.name.match(/^Get[A-Z]/)) {
            chunks.push(generateCachingRpcMethod(ctx, fileDesc, serviceDesc, methodDesc));
        }
        else {
            chunks.push(generateRegularRpcMethod(ctx, fileDesc, serviceDesc, methodDesc));
        }
    }
    chunks.push(ts_poet_1.code `}`);
    return ts_poet_1.code `${chunks}`;
}
exports.generateServiceClientImpl = generateServiceClientImpl;
/** We've found a BatchXxx method, create a synthetic GetXxx method that calls it. */
function generateBatchingRpcMethod(ctx, batchMethod) {
    const { methodDesc, singleMethodName, inputFieldName, inputType, outputFieldName, outputType, mapType, uniqueIdentifier, } = batchMethod;
    // Create the `(keys) => ...` lambda we'll pass to the DataLoader constructor
    const lambda = [];
    lambda.push(ts_poet_1.code `
    (${inputFieldName}) => {
      const request = { ${inputFieldName} };
  `);
    if (mapType) {
        // If the return type is a map, lookup each key in the result
        lambda.push(ts_poet_1.code `
      return this.${methodDesc.name}(ctx, request).then(res => {
        return ${inputFieldName}.map(key => res.${outputFieldName}[key])
      });
    `);
    }
    else {
        // Otherwise assume they come back in order
        lambda.push(ts_poet_1.code `
      return this.${methodDesc.name}(ctx, request).then(res => res.${outputFieldName})
    `);
    }
    lambda.push(ts_poet_1.code `}`);
    return ts_poet_1.code `
    ${singleMethodName}(
      ctx: Context,
      ${utils_1.singular(inputFieldName)}: ${inputType}
    ): Promise<${outputType}> {
      const dl = ctx.getDataLoader("${uniqueIdentifier}", () => {
        return new ${dataloader}<${inputType}, ${outputType}>(
          ${ts_poet_1.joinCode(lambda)},
          { cacheKeyFn: ${hash}, ...ctx.rpcDataLoaderOptions }
        );
      });
      return dl.load(${utils_1.singular(inputFieldName)});
    }
  `;
}
/** We're not going to batch, but use DataLoader for per-request caching. */
function generateCachingRpcMethod(ctx, fileDesc, serviceDesc, methodDesc) {
    const inputType = types_1.requestType(ctx, methodDesc);
    const outputType = types_1.responseType(ctx, methodDesc);
    const uniqueIdentifier = `${fileDesc.package}.${serviceDesc.name}.${methodDesc.name}`;
    const lambda = ts_poet_1.code `
    (requests) => {
      const responses = requests.map(async request => {
        const data = ${inputType}.encode(request).finish()
        const response = await this.rpc.request(ctx, "${fileDesc.package}.${serviceDesc.name}", "${methodDesc.name}", data);
        return ${outputType}.decode(new ${Reader}(response));
      });
      return Promise.all(responses);
    }
  `;
    return ts_poet_1.code `
    ${methodDesc.name}(
      ctx: Context,
      request: ${inputType},
    ): Promise<${outputType}> {
      const dl = ctx.getDataLoader("${uniqueIdentifier}", () => {
        return new ${dataloader}<${inputType}, ${outputType}>(
          ${lambda},
          { cacheKeyFn: ${hash}, ...ctx.rpcDataLoaderOptions },
        );
      });
      return dl.load(request);
    }
  `;
}
/**
 * Creates an `Rpc.request(service, method, data)` abstraction.
 *
 * This lets clients pass in their own request-promise-ish client.
 *
 * We don't export this because if a project uses multiple `*.proto` files,
 * we don't want our the barrel imports in `index.ts` to have multiple `Rpc`
 * types.
 */
function generateRpcType(ctx) {
    const { options } = ctx;
    const maybeContext = options.context ? '<Context>' : '';
    const maybeContextParam = options.context ? 'ctx: Context,' : '';
    return ts_poet_1.code `
    interface Rpc${maybeContext} {
      request(
        ${maybeContextParam}
        service: string,
        method: string,
        data: Uint8Array
      ): Promise<Uint8Array>;
    }
  `;
}
exports.generateRpcType = generateRpcType;
function generateDataLoadersType() {
    // TODO Maybe should be a generic `Context.get<T>(id, () => T): T` method
    return ts_poet_1.code `
    export interface DataLoaders {
      rpcDataLoaderOptions?: DataLoaderOptions;
      getDataLoader<T>(identifier: string, constructorFn: () => T): T;
    }
  `;
}
exports.generateDataLoadersType = generateDataLoadersType;
function generateDataLoaderOptionsType() {
    return ts_poet_1.code `
    export interface DataLoaderOptions {
      cache?: boolean;
    }
  `;
}
exports.generateDataLoaderOptionsType = generateDataLoaderOptionsType;
