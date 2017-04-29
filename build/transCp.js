"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const cp = require('child_process');
class ChildProcessForkTransport {
    defaultModuleOrFile() {
        return 'index';
    }
    /**
     * Adds new Worker using child_process.fork() and links it with this Manager. This will return WorkerInfo instance with the possibilities to send messages and with unique name field.
     * @param type String with name of type of Worker (for example 'worker' or 'readNode'). MUST BE ONE WORD, ONLY LETTERS.
     * @param moduleOrFile Module or file to run (to be used as first parameter in child_process.fork()).
     * @param options Options to pass to the Worker - may be anything.
     * @param data Data about this Worker to store in this Manager. May by anything.
     * @param opts Any fork options (options : ForkOptions) you may use with child_process.fork().
     */
    newWorker(name, type, moduleOrFile = 'index', options = null, data = null, opts = null, _objectifyDataFunc, onMsgFunc, _buildFuncSendWithPromiseFunc) {
        return __awaiter(this, void 0, Promise, function* () {
            const process = cp.fork(moduleOrFile, [
                type,
                JSON.stringify(name),
                JSON.stringify(options)
            ], opts);
            process.on('message', (data) => {
                onMsgFunc(name, data);
            });
            return {
                name: name,
                type: type,
                options: options,
                process: process,
                data: data,
                send: (data) => {
                    this.sendData(process, data, _objectifyDataFunc);
                },
                sendWithPromise: _buildFuncSendWithPromiseFunc((data) => {
                    this.sendData(process, data, _objectifyDataFunc);
                }),
            };
        });
    }
    getMyRole() {
        return process.argv[2] ? process.argv[2] : '';
    }
    sendData(proc, data, _objectifyDataFunc) {
        proc.send(_objectifyDataFunc(data));
    }
    sendDataToManager(proc, data, _objectifyDataFunc) {
        process.send(_objectifyDataFunc(data));
    }
    registerOnMgrMsg(dataClb) {
        process.on('message', (data) => {
            dataClb(data);
        });
    }
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ChildProcessForkTransport;
