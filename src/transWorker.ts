import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import Collab = require("./collab");

export default class WorkerThreadsTransport implements Collab.Transport {
    defaultModuleOrFile() : string {
        return 'index.js';
    }

    async newWorker(name: string, type: string, moduleOrFile: string = 'index.js', options: any = null, data: any = null, opts: any = {}, _objectifyDataFunc: any, onMsgFunc: any, _buildFuncSendWithPromiseFunc: any): Promise<Collab.WorkerInfo> {
        const worker = new Worker(moduleOrFile, Object.assign({}, opts, {
            workerData: { type, name, options }
        }));

        worker.on('message', (msg) => {
            onMsgFunc(name, msg);
        });

        return {
            name,
            type,
            options,
            process: worker as any,
            data,
            send: (data: any) => {
                this.sendData(worker, data, _objectifyDataFunc);
            },
            sendWithPromise: _buildFuncSendWithPromiseFunc((data: any) => {
                this.sendData(worker, data, _objectifyDataFunc);
            })
        };
    }

    getMyRole() {
        return isMainThread ? '' : (workerData && workerData.type ? workerData.type : '');
    }

    sendData(proc: Worker, data: any, _objectifyDataFunc: any) {
        proc.postMessage(_objectifyDataFunc(data));
    }

    sendDataToManager(proc, data: any, _objectifyDataFunc: any) {
        if (parentPort)
            parentPort.postMessage(_objectifyDataFunc(data));
    }

    registerOnMgrMsg(dataClb) {
        if (parentPort) {
            parentPort.on('message', (data) => {
                dataClb(data);
            });
        }
    }
}
