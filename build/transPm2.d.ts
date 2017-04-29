import Collab = require("./collab");
export default class Pm2Transport implements Collab.Transport {
    protected pm2: any;
    protected msgFuncs: {};
    constructor(pm2: any);
    defaultModuleOrFile(): string;
    /**
     * Adds new Worker using child_process.fork() and links it with this Manager. This will return WorkerInfo instance with the possibilities to send messages and with unique name field.
     * @param type String with name of type of Worker (for example 'worker' or 'readNode'). MUST BE ONE WORD, ONLY LETTERS.
     * @param moduleOrFile Module or file to run (to be used as first parameter in child_process.fork()).
     * @param options Options to pass to the Worker - may be anything.
     * @param data Data about this Worker to store in this Manager. May by anything.
     * @param opts Any options you may use with pm2.start().
     */
    newWorker(name: string, type: string, moduleOrFile: string, options: any, data: any, opts: any, _objectifyDataFunc: any, onMsgFunc: any, _buildFuncSendWithPromiseFunc: any): Promise<Collab.WorkerInfo>;
    getMyRole(): string;
    sendData(proc: any, data: any, _objectifyDataFunc: any): void;
    sendDataToManager(proc: any, data: any, _objectifyDataFunc: any): void;
    registerOnMgrMsg(dataClb: any): void;
}
