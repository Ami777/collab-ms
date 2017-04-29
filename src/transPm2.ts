import {ChildProcess} from "child_process";
import cp = require('child_process');
import Collab = require("./collab");

export default class Pm2Transport implements Collab.Transport {
    protected msgFuncs = {};

    constructor(protected pm2 : any){
        this.pm2.launchBus((err, bus) => {
            bus.on('collab-ms:pm2trans:msg', (packet) => {
                const msgFunc = this.msgFuncs[packet.process.name];
                if (msgFunc){
                    msgFunc(packet.process.name, packet.data);
                }
            });
        });
    };
    
    defaultModuleOrFile() : string {
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
    async newWorker(name : string, type:string, moduleOrFile:string , options:any, data:any, opts:any, _objectifyDataFunc:any, onMsgFunc:any, _buildFuncSendWithPromiseFunc:any):Promise<Collab.WorkerInfo> {
        return new Promise((resolve, reject) => {
            this.pm2.start(Object.assign({}, {
                name,
                script : moduleOrFile,
                args : [
                    type,
                    JSON.stringify(name),
                    JSON.stringify(options)
                ],
            }, opts), (err,proc) => {
                if (err) {
                    throw new Error('Error: PM2 cannot start process! ' + err.message);
                } else {
                    this.msgFuncs[name] = onMsgFunc;
                    resolve( {
                        name,
                        type,
                        options,
                        process : proc,
                        data,
                        send: (data:any) => {
                            this.sendData(proc, data, _objectifyDataFunc);
                        },
                        sendWithPromise: _buildFuncSendWithPromiseFunc((data:any) => {
                            this.sendData(proc, data, _objectifyDataFunc);
                        }),
                    } );
                }
            });

            // console.log('process', process);

            // cp.fork(moduleOrFile, [
            //     type,
            //     JSON.stringify(name),
            //     JSON.stringify(options)
            // ], opts)

        });
    }

    getMyRole() {
        return process.argv[2] ? process.argv[2] : '';
    }

    sendData(proc, data:any, _objectifyDataFunc:any) {
        this.pm2.sendDataToProcessId(proc[0].pm2_env.pm_id, {
            type : 'collab-ms:pm2trans:msg',
            topic : 'collab-ms:pm2trans:msg',
            data : _objectifyDataFunc(data),
            id   : proc[0].pm2_env.pm_id,
        }, (err, res) => {});
    }

    sendDataToManager(proc, data, _objectifyDataFunc:any) {
        process.send({
            type : 'collab-ms:pm2trans:msg',
            data : _objectifyDataFunc(data)
        });
    }
    
    registerOnMgrMsg( dataClb ){
        process.on('message', (data) => {
            if (data && data.type && data.type === 'collab-ms:pm2trans:msg') {
                dataClb(data.data);
            }
        });
    }
}