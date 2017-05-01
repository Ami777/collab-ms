"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
class Pm2Transport {
    constructor(pm2) {
        this.pm2 = pm2;
        this.msgFuncs = {};
        this.pm2.launchBus((err, bus) => {
            bus.on('collab-ms:pm2trans:msg', (packet) => {
                const msgFunc = this.msgFuncs[packet.process.name];
                if (msgFunc) {
                    msgFunc(packet.process.name, packet.data);
                }
            });
        });
    }
    ;
    defaultModuleOrFile() {
        return 'index.js';
    }
    /**
     * Adds new Worker using child_process.fork() and links it with this Manager. This will return WorkerInfo instance with the possibilities to send messages and with unique name field.
     * @param type String with name of type of Worker (for example 'worker' or 'readNode'). MUST BE ONE WORD, ONLY LETTERS.
     * @param moduleOrFile Module or file to run (to be used as first parameter in child_process.fork()).
     * @param options Options to pass to the Worker - may be anything.
     * @param data Data about this Worker to store in this Manager. May by anything.
     * @param opts Any options you may use with pm2.start().
     */
    newWorker(name, type, moduleOrFile, options, data, opts, _objectifyDataFunc, onMsgFunc, _buildFuncSendWithPromiseFunc) {
        return __awaiter(this, void 0, Promise, function* () {
            return new Promise((resolve, reject) => {
                this.pm2.start(Object.assign({}, {
                    name: name,
                    script: moduleOrFile,
                    args: [
                        type,
                        JSON.stringify(name),
                        JSON.stringify(options)
                    ],
                }, opts), (err, proc) => {
                    if (err) {
                        throw new Error('Error: PM2 cannot start process! ' + err.message);
                    }
                    else {
                        this.msgFuncs[name] = onMsgFunc;
                        resolve({
                            name: name,
                            type: type,
                            options: options,
                            process: proc,
                            data: data,
                            send: (data) => {
                                this.sendData(proc, data, _objectifyDataFunc);
                            },
                            sendWithPromise: _buildFuncSendWithPromiseFunc((data) => {
                                this.sendData(proc, data, _objectifyDataFunc);
                            }),
                        });
                    }
                });
            });
        });
    }
    getMyRole() {
        return process.argv[2] ? process.argv[2] : '';
    }
    sendData(proc, data, _objectifyDataFunc) {
        let pmId;
        if (proc[0] && proc[0].pm2_env && proc[0].pm2_env.pm_id) {
            pmId = proc[0].pm2_env.pm_id;
        }
        else if (proc.pm2_env && proc.pm2_env.pm_id) {
            pmId = proc.pm2_env.pm_id;
        }
        else if (proc[0] && proc[0].env && proc[0].env.pm_id) {
            pmId = proc[0].env.pm_id;
        }
        else if (proc.env && proc.env.pm_id) {
            pmId = proc.env.pm_id;
        }
        else {
            throw new Error('Cannot find pm_id!');
        }
        this.pm2.sendDataToProcessId(pmId, {
            type: 'collab-ms:pm2trans:msg',
            topic: 'collab-ms:pm2trans:msg',
            data: _objectifyDataFunc(data),
            id: pmId,
        }, (err, res) => { });
    }
    sendDataToManager(proc, data, _objectifyDataFunc) {
        process.send({
            type: 'collab-ms:pm2trans:msg',
            data: _objectifyDataFunc(data)
        });
    }
    registerOnMgrMsg(dataClb) {
        process.on('message', (data) => {
            if (data && data.type && data.type === 'collab-ms:pm2trans:msg') {
                dataClb(data.data);
            }
        });
    }
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Pm2Transport;
