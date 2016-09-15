import {ChildProcess} from "child_process";
import cp = require('child_process');

module Collab {
    function _isObject(value : any) {
        return Object.prototype.toString.call(value) == '[object Object]';
    }

    function _objectifyData(data : any){
        return (_isObject(data) ?
            data    :
            {
                'dataObjectified$':data
            });
    }

    function _prepClearData(dataObj: any) {
        if (typeof dataObj !== 'object') return dataObj;

        if (dataObj.hasOwnProperty('dataObjectified$')) {
            return dataObj['dataObjectified$'];
        }

        const reservedInternalProps = ['promised$', 'promisedReq$', 'promiseError$', 'promiseResult$', 'promiseId$', 'workDone$', 'maxJobsAtOnce$', 'jobsCount$'];

        let clearObj = {};
        for (let name in dataObj) {
            if (reservedInternalProps.indexOf(name) == -1 /*Damn, need another typing for includes...*/)
                clearObj[name] = dataObj[name];
        }

        return clearObj;
    }

    export interface NormalSendFunction{
        /**
         * @param data Any data you want to pass.
         */
        (data?:any):void;
    }

    export interface ResolveFunction{
        /**
         * @param data Any data you want to pass.
         */
        (data?:any):void;
    }

    export interface ResolveBalancedFunction{
        /**
         * @param data Any data you want to pass.
         * @param sendWorkDone False (default) means this will be sent as normal Promise answer. Set to True to send as work-done Promise answer.
         */
        (data?:any, sendWorkDone?: boolean):void;
    }

    export interface RejectFunction{
        /**
         * @param error Error information to send.
         */
        (error?:any):void;
    }

    export interface RejectBalancedFunction{
        /**
         * @param error Error information to send.
         * @param sendWorkDone False (default) means this will be sent as normal Promise answer. Set to True to send as work-done Promise answer.
         */
        (error?:any, sendWorkDone?: boolean):void;
    }

    export interface WorkerMsgClbFunction{
        /**
         * @param worker Current Worker info object.
         * @param data Data passed from Worker.
         * @param send This is shortcut to worker.send() function for quick answers.
         */
        (worker?:WorkerInfo, data?:any, send?:NormalSendFunction):void;
    }

    export interface ManagerMsgClbFunction{
        /**
         * @param data Data passed from Manager.
         * @param send This is shortcut to Worker.send() function for quick answers.
         */
        (data?:any, send?:NormalSendFunction, sendWorkDone?:NormalSendFunction):void;
    }

    export interface ManagerPromisedMsgClbFunction{
        /**
         * @param data Data passed from Manager.
         */
        (data?:any, resolve?:ResolveBalancedFunction, reject?:RejectBalancedFunction):void;
    }

    /**
     * Information about Worker.
     */
    export interface WorkerInfo{
        /**
         * Name given automatically.
         */
        name?               :   string;
        /**
         * Type name given by you.
         */
        type?               :   string;
        /**
         * Options passed by you when forking.
         */
        options?            :   any;
        /**
         * Internal ChildProcess.
         */
        process?            :   ChildProcess;
        /**
         * Your internal data.
         */
        data?               :   any;

        /**
         * Function to send non-Promised message.
         */
        send?               :   NormalSendFunction;
        /**
         * Function to send Promised message.
         */
        sendWithPromise?    :   NormalSendFunction;
    }

    /**
     * This is internal structure used for Promises.
     */
    export interface Promises {
        id          :   number;
        resolve?    :   ResolveFunction;
        reject?     :   RejectFunction;
    }

    export class PromiseCommunicationBase {
        protected promiseIdx: number;
        protected promises: Promises[];

        public constructor(){
            this.promiseIdx = 0;
            this.promises = [];
        }

        protected _buildFuncSendWithPromise(process: ChildProcess | NodeJS.Process) : NormalSendFunction {
            return (data): Promise<any> => {
                let promises: Promises;
                const promiseId = this.promiseIdx++;

                const promise = new Promise<any>((resolve, reject) => {
                    promises = {
                        id: promiseId,
                        resolve,
                        reject,
                    };
                });

                this.promises.push(promises);

                const dataWithPromise = Object.assign({}, {
                    'promisedReq$': true,
                    'promiseId$': promiseId
                }, _objectifyData(data));

                process.send(dataWithPromise);

                return promise;
            };
        }


        protected _makeResolveFunc(promiseId: number, sendFunc: NormalSendFunction, sendWorkDoneFunc?:NormalSendFunction) {
            return (data: any = null, sendWorkDone: boolean = false) => {
                if (!sendWorkDoneFunc && sendWorkDone)
                    throw "Invalid type of process (not Worker) to send workDone answer.";

                (new Promise((resolve, reject) => {
                    resolve(data);
                })).then(dataResolved => {
                    const dataWithPromise = {
                        'promised$': true,
                        'promiseId$': promiseId,
                        'promiseError$': null,
                        'promiseResult$': dataResolved
                    };

                    if (sendWorkDone && sendWorkDoneFunc)
                        sendWorkDoneFunc(dataWithPromise);
                    else
                        sendFunc(dataWithPromise);
                }, error => {
                    this._makeRejectFunc(promiseId, sendFunc, sendWorkDoneFunc)(error, sendWorkDone);
                });
            }
        }

        protected _makeRejectFunc(promiseId: number, sendFunc: NormalSendFunction, sendWorkDoneFunc?:NormalSendFunction) {
            return (err: any = null, sendWorkDone: boolean = false) => {
                if (!sendWorkDoneFunc && sendWorkDone)
                    throw "Invalid type of process (not Worker) to send workDone answer.";

                const dataWithPromise = {
                    'promised$': true,
                    'promiseId$': promiseId,
                    'promiseError$': err,
                    'promiseResult$': null
                };

                if (sendWorkDone && sendWorkDoneFunc)
                    sendWorkDoneFunc(dataWithPromise);
                else
                    sendFunc(dataWithPromise);
            }
        }

        protected filterMsgIfPromised(data : any, promisedMsgClb : ManagerPromisedMsgClbFunction, sendFunc: NormalSendFunction, sendWorkDoneFunc?:NormalSendFunction){
            if (data['promised$']) {
                const promiseIdx = this.promises.findIndex(promises => promises.id == data['promiseId$']);
                const promises = this.promises[promiseIdx];
                this.promises.splice(promiseIdx, 1);

                if (data['promiseError$'])
                    promises.reject(data['promiseError$']);
                else
                    promises.resolve(data['promiseResult$']);

                return true;
            }
            if (data['promisedReq$']) {
                if (promisedMsgClb)
                    promisedMsgClb(_prepClearData(data), this._makeResolveFunc(data['promiseId$'], sendFunc, sendWorkDoneFunc), this._makeRejectFunc(data['promiseId$'], sendFunc, sendWorkDoneFunc));

                return true;
            }

            return false;
        }
    }

    export class Manager extends PromiseCommunicationBase {

        protected workers: WorkerInfo[];

        /**
         * Class constructor for Manager - CEO and mid-level managers.
         * @param onWorkerMessage Callback which will run when non-Promised message arrives to Manager from Worker.
         */
        public constructor(protected onWorkerMessage?: WorkerMsgClbFunction, protected onWorkerPromisedMessage?: ManagerPromisedMsgClbFunction) {
            super();

            this.workers = [];
        }

        protected onMessage(worker: WorkerInfo, data: any) {
            if (!this.filterMsgIfPromised(data, this.onWorkerPromisedMessage, worker.send)) {
                if (this.onWorkerMessage)
                    this.onWorkerMessage(worker, _prepClearData(data), worker.send);
            }
        }

        /**
         * Adds new Worker using child_process.fork() and links it with this Manager. This will return WorkerInfo instance with the possibilities to send messages and with unique name field.
         * @param type String with name of type of Worker (for example 'worker' or 'readNode'). MUST BE ONE WORD, ONLY LETTERS.
         * @param moduleOrFile Module or file to run (to be used as first parameter in child_process.fork()).
         * @param options Options to pass to the Worker - may be anything.
         * @param data Data about this Worker to store in this Manager. May by anything.
         * @param forkOpts Any fork options (options : ForkOptions) you may use with child_process.fork().
         */
        public newWorker(type: string, moduleOrFile:string = 'index', options: any = null, data: any = null, forkOpts: any = null): WorkerInfo {
            if (/[^a-z]/i.test(type))
                throw "Worker type must be one word, only letters!";

            const idx = this.workers.filter(worker => worker.type == type).length + 1;
            const name = `${type.toUpperCase()} #${idx}`;
            const process = cp.fork(moduleOrFile, [
                type,
                JSON.stringify(name),
                JSON.stringify(options)
            ], forkOpts);
            const workerInfo = {
                name,
                type,
                options,
                process,
                data,
                send: function(data:any) {
                    process.send(_objectifyData(data));
                },
                sendWithPromise: this._buildFuncSendWithPromise(process)
            };

            process.on('message', (data) => {
                this.onMessage(this.getWorker(name), data);
            });

            this.workers.push(workerInfo);

            return workerInfo;
        }

        /**
         * Find WorkerInfo by Worker name.
         * @param name Name of Worker.
         */
        public getWorker(name: string): WorkerInfo {
            return this.workers.find(worker => worker.name == name);
        }

        /**
         * Find array of WorkerInfo by Worker type.
         * @param type Type of Worker.
         */
        public getWorkers(type: string): WorkerInfo[] {
            return this.workers.filter(worker => worker.type == type);
        }
    }

    export class Balancer extends Manager {
        private queue: any[];
        // private queueCheckInterval : Timer;

        /**
         * Class constructor for Balancer Manager - mostly it will be special mid-level manager.
         * @param onWorkerMessage Callback which will run when non-Promised message arrives to Manager from Worker.
         */
        public constructor(onWorkerMessage?: WorkerMsgClbFunction) {
            super(onWorkerMessage);

            this.queue = [];
            // this.queueCheckInterval = setInterval(() => this.onQueueCheckInterval(), 1000);
        }

        // public destroy() {
            // clearInterval(this.queueCheckInterval);
        // }

        private onQueueCheckInterval() {
            if (this.queue.length == 0) return;

            let freeWorker = this.findMostFreeWorker();

            if (!freeWorker) return;

            do {
                freeWorker.data.jobsCount$++;
                freeWorker.send(this.queue.shift());

                freeWorker = this.findMostFreeWorker();
            } while (freeWorker && this.queue.length > 0);
        }

        private findMostFreeWorker(): WorkerInfo {
            let res = null;
            let minJobs = +Infinity;

            this.workers.find(worker => {
                if (worker.data.jobsCount$ == 0) {
                    res = worker;
                    return true; //Break the loop, this is satisfying
                }

                if ((worker.data.jobsCount$ < minJobs) && (worker.data.jobsCount$ < worker.data.maxJobsAtOnce$) && (worker.process.connected)) {
                    minJobs = worker.data.jobsCount$;
                    res = worker;
                }
            });

            return res;
        }

        /**
         * Adds new Worker using child_process.fork() and links it with this Manager. This is special type of Worker which will be managed and balanced by this Balancer. For more information refer to Manager.newWorker() docs.
         * @param type String with name of type of Worker (for example 'worker' or 'readNode'). MUST BE ONE WORD, ONLY LETTERS.
         * @param moduleOrFile Module or file to run (to be used as first parameter in child_process.fork()).
         * @param maxJobsAtOnce Maximum number of jobs that this Worker should do at once.
         * @param options Options to pass to the Worker - may be anything.
         * @param data Data about this Worker to store in this Manager. May by anything.
         * @param forkOpts Any fork options (options : ForkOptions) you may use with child_process.fork().
         */
        public newBalancedWorker(type: string, maxJobsAtOnce: number, moduleOrFile:string = 'index', options: any = null, data: any = null, forkOpts: any = null): WorkerInfo {
            return super.newWorker(type, moduleOrFile, options, Object.assign({}, {
                maxJobsAtOnce$:maxJobsAtOnce,
                jobsCount$: 0,
            }, _objectifyData(data)), forkOpts);
        }

        /**
         * Adds job to do by some of the best-suited Worker. Best-suited Worker is the one with the smallest amount of current jobs and with free space for next one. If no Worker can be found the job is queued and when any of the Workers will be free this job will be executed.
         * @param data Any data you want to pass to the Worker.
         */
        public addJob(data: any = null) {
            this.queue.push(data);
            this.onQueueCheckInterval();
        }

        /**
         * Same as Balancer.addJob() but with Promises.
         * @param data Any data you want to pass to the Worker.
         */
        public addJobWithPromise(data: any = null): Promise<any> {
            let promises: Promises;
            const promiseId = this.promiseIdx++;

            const promise = new Promise<any>((resolve, reject) => {
                promises = {
                    id: promiseId,
                    resolve,
                    reject,
                };
            });

            this.promises.push(promises);

            const dataWithPromise = Object.assign({}, {
                'promisedReq$': true,
                'promiseId$': promiseId
            }, _objectifyData(data));

            this.addJob(dataWithPromise);

            return promise;
        }

        protected onMessage(worker: WorkerInfo, data: any) {
            if (data['workDone$']) {
                worker.data.jobsCount$--;
                this.onQueueCheckInterval();
            }

            super.onMessage(worker, data);
        }
    }

    export class Worker extends PromiseCommunicationBase {
        private type: string;
        private name: string;
        private options: any;

        /**
         * Sends normal, Promised message to closest Manager.
         * @param data Any data you want to pass to the Manager.
         */
        public sendWithPromise : NormalSendFunction;

        /**
         * Class constructor for Worker - it will be any worker including mid-level manager.
         * @param onManagerMessage Callback which will run when non-Promised message arrives to Worker from Manager.
         * @param onManagerMessageWithPromise Callback which will run when Promised message arrives to Worker from Manager.
         */
        public constructor(public onManagerMessage?: ManagerMsgClbFunction, public onManagerMessageWithPromise?: ManagerPromisedMsgClbFunction) {
            super();

            this.sendWithPromise = this._buildFuncSendWithPromise(process);

            process.on('message', (data) => {
                this.onMessage(data);
            });
            this.type = process.argv[2];
            this.name = JSON.parse(process.argv[3]);
            this.options = JSON.parse(process.argv[4]);
        }

        /**
         * Reads type name of Worker passed by Manager to this Worker while forking it.
         */
        public getType() {
            return this.type;
        }

        /**
         * Reads options passed by Manager to this Worker while forking it.
         */
        public getOptions() {
            return this.options;
        }
        /**
         * Reads name of Worker passed by Manager to this Worker while forking it.
         */
        public getName() {
            return this.name;
        }

        private onMessage(data: any) {
            if (!this.filterMsgIfPromised(data, this.onManagerMessageWithPromise, this.send, this.sendWorkDone)) {
                if (this.onManagerMessage)
                    this.onManagerMessage(_prepClearData(data), this.send, this.sendWorkDone);
            }
        }

        /**
         * Sends normal, non-Promised message to closest Manager.
         * @param data Any data you want to pass to the Manager.
         */
        public send(data: any = null) {
            process.send(_objectifyData(data));
        }

        /**
         * Sends work-done, non-Promised message to closest Manager. This is usually answer for Balancer Manager.
         * @param data Any data you want to pass to the Manager.
         */
        public sendWorkDone(data: any = null) {
            const dataWorkDone = Object.assign({}, {
                'workDone$': true
            }, _objectifyData(data));

            this.send(dataWorkDone);
        }
    }

    /**
     * Reads type name of Worker passed by Manager to this Worker while forking it or empty string for main CEO process.
     */
    export function getMyRole() {
        return process.argv[2] ? process.argv[2] : '';
    }

    /**
     * Returns true if this is main process.
     */
    export function isCEO() {
        return getMyRole() == '';
    }
}

export = Collab;