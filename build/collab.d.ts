import { ChildProcess } from "child_process";
declare module Collab {
    interface NormalSendFunction {
        /**
         * @param data Any data you want to pass.
         */
        (data?: any): void;
    }
    interface ResolveFunction {
        /**
         * @param data Any data you want to pass.
         */
        (data?: any): void;
    }
    interface ResolveBalancedFunction {
        /**
         * @param data Any data you want to pass.
         * @param sendWorkDone False (default) means this will be sent as normal Promise answer. Set to True to send as work-done Promise answer.
         */
        (data?: any, sendWorkDone?: boolean): void;
    }
    interface RejectFunction {
        /**
         * @param error Error information to send.
         */
        (error?: any): void;
    }
    interface RejectBalancedFunction {
        /**
         * @param error Error information to send.
         * @param sendWorkDone False (default) means this will be sent as normal Promise answer. Set to True to send as work-done Promise answer.
         */
        (error?: any, sendWorkDone?: boolean): void;
    }
    interface WorkerMsgClbFunction {
        /**
         * @param worker Current Worker info object.
         * @param data Data passed from Worker.
         * @param send This is shortcut to worker.send() function for quick answers.
         */
        (worker?: WorkerInfo, data?: any, send?: NormalSendFunction): void;
    }
    interface ManagerMsgClbFunction {
        /**
         * @param data Data passed from Manager.
         * @param send This is shortcut to Worker.send() function for quick answers.
         */
        (data?: any, send?: NormalSendFunction, sendWorkDone?: NormalSendFunction): void;
    }
    interface ManagerPromisedMsgClbFunction {
        /**
         * @param data Data passed from Manager.
         */
        (data?: any, resolve?: ResolveBalancedFunction, reject?: RejectBalancedFunction): void;
    }
    /**
     * Information about Worker.
     */
    interface WorkerInfo {
        /**
         * Name given automatically.
         */
        name?: string;
        /**
         * Type name given by you.
         */
        type?: string;
        /**
         * Options passed by you when forking.
         */
        options?: any;
        /**
         * Internal ChildProcess.
         */
        process?: ChildProcess;
        /**
         * Your internal data.
         */
        data?: any;
        /**
         * Function to send non-Promised message.
         */
        send?: NormalSendFunction;
        /**
         * Function to send Promised message.
         */
        sendWithPromise?: NormalSendFunction;
    }
    /**
     * This is internal structure used for Promises.
     */
    interface Promises {
        id: number;
        resolve?: ResolveFunction;
        reject?: RejectFunction;
    }
    class PromiseCommunicationBase {
        protected promiseIdx: number;
        protected promises: Promises[];
        constructor();
        protected _buildFuncSendWithPromise(process: ChildProcess | NodeJS.Process): NormalSendFunction;
        protected _makeResolveFunc(promiseId: number, sendFunc: NormalSendFunction, sendWorkDoneFunc?: NormalSendFunction): (data?: any, sendWorkDone?: boolean) => void;
        protected _makeRejectFunc(promiseId: number, sendFunc: NormalSendFunction, sendWorkDoneFunc?: NormalSendFunction): (err?: any, sendWorkDone?: boolean) => void;
        protected filterMsgIfPromised(data: any, promisedMsgClb: ManagerPromisedMsgClbFunction, sendFunc: NormalSendFunction, sendWorkDoneFunc?: NormalSendFunction): boolean;
    }
    class Manager extends PromiseCommunicationBase {
        protected onWorkerMessage: WorkerMsgClbFunction;
        protected onWorkerPromisedMessage: ManagerPromisedMsgClbFunction;
        protected workers: WorkerInfo[];
        /**
         * Class constructor for Manager - CEO and mid-level managers.
         * @param onWorkerMessage Callback which will run when non-Promised message arrives to Manager from Worker.
         */
        constructor(onWorkerMessage?: WorkerMsgClbFunction, onWorkerPromisedMessage?: ManagerPromisedMsgClbFunction);
        protected onMessage(worker: WorkerInfo, data: any): void;
        /**
         * Adds new Worker using child_process.fork() and links it with this Manager. This will return WorkerInfo instance with the possibilities to send messages and with unique name field.
         * @param type String with name of type of Worker (for example 'worker' or 'readNode'). MUST BE ONE WORD, ONLY LETTERS.
         * @param moduleOrFile Module or file to run (to be used as first parameter in child_process.fork()).
         * @param options Options to pass to the Worker - may be anything.
         * @param data Data about this Worker to store in this Manager. May by anything.
         * @param forkOpts Any fork options (options : ForkOptions) you may use with child_process.fork().
         */
        newWorker(type: string, moduleOrFile?: string, options?: any, data?: any, forkOpts?: any): WorkerInfo;
        /**
         * Find WorkerInfo by Worker name.
         * @param name Name of Worker.
         */
        getWorker(name: string): WorkerInfo;
        /**
         * Find array of WorkerInfo by Worker type.
         * @param type Type of Worker.
         */
        getWorkers(type: string): WorkerInfo[];
    }
    class Balancer extends Manager {
        private queue;
        /**
         * Class constructor for Balancer Manager - mostly it will be special mid-level manager.
         * @param onWorkerMessage Callback which will run when non-Promised message arrives to Manager from Worker.
         */
        constructor(onWorkerMessage?: WorkerMsgClbFunction);
        private onQueueCheckInterval();
        private findMostFreeWorker();
        /**
         * Adds new Worker using child_process.fork() and links it with this Manager. This is special type of Worker which will be managed and balanced by this Balancer. For more information refer to Manager.newWorker() docs.
         * @param type String with name of type of Worker (for example 'worker' or 'readNode'). MUST BE ONE WORD, ONLY LETTERS.
         * @param moduleOrFile Module or file to run (to be used as first parameter in child_process.fork()).
         * @param maxJobsAtOnce Maximum number of jobs that this Worker should do at once.
         * @param options Options to pass to the Worker - may be anything.
         * @param data Data about this Worker to store in this Manager. May by anything.
         * @param forkOpts Any fork options (options : ForkOptions) you may use with child_process.fork().
         */
        newBalancedWorker(type: string, maxJobsAtOnce: number, moduleOrFile?: string, options?: any, data?: any, forkOpts?: any): WorkerInfo;
        /**
         * Adds job to do by some of the best-suited Worker. Best-suited Worker is the one with the smallest amount of current jobs and with free space for next one. If no Worker can be found the job is queued and when any of the Workers will be free this job will be executed.
         * @param data Any data you want to pass to the Worker.
         */
        addJob(data?: any): void;
        /**
         * Same as Balancer.addJob() but with Promises.
         * @param data Any data you want to pass to the Worker.
         */
        addJobWithPromise(data?: any): Promise<any>;
        protected onMessage(worker: WorkerInfo, data: any): void;
    }
    class Worker extends PromiseCommunicationBase {
        onManagerMessage: ManagerMsgClbFunction;
        onManagerMessageWithPromise: ManagerPromisedMsgClbFunction;
        private type;
        private name;
        private options;
        /**
         * Sends normal, Promised message to closest Manager.
         * @param data Any data you want to pass to the Manager.
         */
        sendWithPromise: NormalSendFunction;
        /**
         * Class constructor for Worker - it will be any worker including mid-level manager.
         * @param onManagerMessage Callback which will run when non-Promised message arrives to Worker from Manager.
         * @param onManagerMessageWithPromise Callback which will run when Promised message arrives to Worker from Manager.
         */
        constructor(onManagerMessage?: ManagerMsgClbFunction, onManagerMessageWithPromise?: ManagerPromisedMsgClbFunction);
        /**
         * Reads type name of Worker passed by Manager to this Worker while forking it.
         */
        getType(): string;
        /**
         * Reads options passed by Manager to this Worker while forking it.
         */
        getOptions(): any;
        /**
         * Reads name of Worker passed by Manager to this Worker while forking it.
         */
        getName(): string;
        private onMessage(data);
        /**
         * Sends normal, non-Promised message to closest Manager.
         * @param data Any data you want to pass to the Manager.
         */
        send(data?: any): void;
        /**
         * Sends work-done, non-Promised message to closest Manager. This is usually answer for Balancer Manager.
         * @param data Any data you want to pass to the Manager.
         */
        sendWorkDone(data?: any): void;
    }
    /**
     * Reads type name of Worker passed by Manager to this Worker while forking it or empty string for main CEO process.
     */
    function getMyRole(): string;
    /**
     * Returns true if this is main process.
     */
    function isCEO(): boolean;
}
export = Collab;
