"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const worker_threads_1 = require("worker_threads");
class WorkerThreadsTransport {
    defaultModuleOrFile() {
        return 'index.js';
    }
    newWorker(name_1, type_1) {
        return __awaiter(this, arguments, void 0, function* (name, type, moduleOrFile = 'index.js', options = null, data = null, opts = {}, _objectifyDataFunc, onMsgFunc, _buildFuncSendWithPromiseFunc) {
            const worker = new worker_threads_1.Worker(moduleOrFile, Object.assign({}, opts, {
                workerData: { type, name, options }
            }));
            worker.on('message', (msg) => {
                onMsgFunc(name, msg);
            });
            return {
                name,
                type,
                options,
                process: worker,
                data,
                send: (data) => {
                    this.sendData(worker, data, _objectifyDataFunc);
                },
                sendWithPromise: _buildFuncSendWithPromiseFunc((data) => {
                    this.sendData(worker, data, _objectifyDataFunc);
                })
            };
        });
    }
    getMyRole() {
        return worker_threads_1.isMainThread ? '' : (worker_threads_1.workerData && worker_threads_1.workerData.type ? worker_threads_1.workerData.type : '');
    }
    sendData(proc, data, _objectifyDataFunc) {
        proc.postMessage(_objectifyDataFunc(data));
    }
    sendDataToManager(proc, data, _objectifyDataFunc) {
        if (worker_threads_1.parentPort)
            worker_threads_1.parentPort.postMessage(_objectifyDataFunc(data));
    }
    registerOnMgrMsg(dataClb) {
        if (worker_threads_1.parentPort) {
            worker_threads_1.parentPort.on('message', (data) => {
                dataClb(data);
            });
        }
    }
}
exports.default = WorkerThreadsTransport;
