import { Worker } from 'worker_threads';
import Collab = require("./collab");
export default class WorkerThreadsTransport implements Collab.Transport {
    defaultModuleOrFile(): string;
    newWorker(name: string, type: string, moduleOrFile: string, options: any, data: any, opts: any, _objectifyDataFunc: any, onMsgFunc: any, _buildFuncSendWithPromiseFunc: any): Promise<Collab.WorkerInfo>;
    getMyRole(): any;
    sendData(proc: Worker, data: any, _objectifyDataFunc: any): void;
    sendDataToManager(proc: any, data: any, _objectifyDataFunc: any): void;
    registerOnMgrMsg(dataClb: any): void;
}
