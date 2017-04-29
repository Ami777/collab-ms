import {ChildProcess} from "child_process";
import cp = require('child_process');
import Collab = require("./collab");

export default class ChildProcessForkTransport implements Collab.Transport {
    defaultModuleOrFile() : string {
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
    async newWorker(name : string, type:string, moduleOrFile:string = 'index', options:any = null, data:any = null, opts:any = null, _objectifyDataFunc:any, onMsgFunc:any, _buildFuncSendWithPromiseFunc:any):Promise<Collab.WorkerInfo> {
        const process = cp.fork(moduleOrFile, [
            type,
            JSON.stringify(name),
            JSON.stringify(options)
        ], opts);

        process.on('message', (data) => {
            onMsgFunc(name, data);
        });

        return {
            name,
            type,
            options,
            process,
            data,
            send: (data:any) => {
                this.sendData(process, data, _objectifyDataFunc);
            },
            sendWithPromise: _buildFuncSendWithPromiseFunc((data:any) => {
                this.sendData(process, data, _objectifyDataFunc);
            }),
        };
    }

    getMyRole() {
        return process.argv[2] ? process.argv[2] : '';
    }

    sendData(proc, data:any, _objectifyDataFunc:any) {
        proc.send(_objectifyDataFunc(data));
    }

    sendDataToManager(proc, data, _objectifyDataFunc:any) {
        process.send(_objectifyDataFunc(data));
    }

    registerOnMgrMsg( dataClb ){
        process.on('message', (data) => {
            dataClb(data);
        });
    }
}