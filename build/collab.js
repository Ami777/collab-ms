"use strict";
const cp = require('child_process');
var Collab;
(function (Collab) {
    function _isObject(value) {
        return Object.prototype.toString.call(value) == '[object Object]';
    }
    function _objectifyData(data) {
        return (_isObject(data) ?
            data :
            {
                'dataObjectified$': data
            });
    }
    function _prepClearData(dataObj) {
        if (typeof dataObj !== 'object')
            return dataObj;
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
    class PromiseCommunicationBase {
        constructor() {
            this.promiseIdx = 0;
            this.promises = [];
        }
        _buildFuncSendWithPromise(process) {
            return (data) => {
                let promises;
                const promiseId = this.promiseIdx++;
                const promise = new Promise((resolve, reject) => {
                    promises = {
                        id: promiseId,
                        resolve: resolve,
                        reject: reject,
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
        _makeResolveFunc(promiseId, sendFunc, sendWorkDoneFunc) {
            return (data = null, sendWorkDone = false) => {
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
            };
        }
        _makeRejectFunc(promiseId, sendFunc, sendWorkDoneFunc) {
            return (err = null, sendWorkDone = false) => {
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
            };
        }
        filterMsgIfPromised(data, promisedMsgClb, sendFunc, sendWorkDoneFunc) {
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
    Collab.PromiseCommunicationBase = PromiseCommunicationBase;
    class Manager extends PromiseCommunicationBase {
        /**
         * Class constructor for Manager - CEO and mid-level managers.
         * @param onWorkerMessage Callback which will run when non-Promised message arrives to Manager from Worker.
         */
        constructor(onWorkerMessage, onWorkerPromisedMessage) {
            super();
            this.onWorkerMessage = onWorkerMessage;
            this.onWorkerPromisedMessage = onWorkerPromisedMessage;
            this.workers = [];
        }
        onMessage(worker, data) {
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
        newWorker(type, moduleOrFile = 'index', options = null, data = null, forkOpts = null) {
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
                name: name,
                type: type,
                options: options,
                process: process,
                data: data,
                send: function (data) {
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
        getWorker(name) {
            return this.workers.find(worker => worker.name == name);
        }
        /**
         * Find array of WorkerInfo by Worker type.
         * @param type Type of Worker.
         */
        getWorkers(type) {
            return this.workers.filter(worker => worker.type == type);
        }
    }
    Collab.Manager = Manager;
    class Balancer extends Manager {
        // private queueCheckInterval : Timer;
        /**
         * Class constructor for Balancer Manager - mostly it will be special mid-level manager.
         * @param onWorkerMessage Callback which will run when non-Promised message arrives to Manager from Worker.
         */
        constructor(onWorkerMessage) {
            super(onWorkerMessage);
            this.queue = [];
            // this.queueCheckInterval = setInterval(() => this.onQueueCheckInterval(), 1000);
        }
        // public destroy() {
        // clearInterval(this.queueCheckInterval);
        // }
        onQueueCheckInterval() {
            if (this.queue.length == 0)
                return;
            let freeWorker = this.findMostFreeWorker();
            if (!freeWorker)
                return;
            do {
                freeWorker.data.jobsCount$++;
                freeWorker.send(this.queue.shift());
                freeWorker = this.findMostFreeWorker();
            } while (freeWorker && this.queue.length > 0);
        }
        findMostFreeWorker() {
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
        newBalancedWorker(type, maxJobsAtOnce, moduleOrFile = 'index', options = null, data = null, forkOpts = null) {
            return super.newWorker(type, moduleOrFile, options, Object.assign({}, {
                maxJobsAtOnce$: maxJobsAtOnce,
                jobsCount$: 0,
            }, _objectifyData(data)), forkOpts);
        }
        /**
         * Adds job to do by some of the best-suited Worker. Best-suited Worker is the one with the smallest amount of current jobs and with free space for next one. If no Worker can be found the job is queued and when any of the Workers will be free this job will be executed.
         * @param data Any data you want to pass to the Worker.
         */
        addJob(data = null) {
            this.queue.push(data);
            this.onQueueCheckInterval();
        }
        /**
         * Same as Balancer.addJob() but with Promises.
         * @param data Any data you want to pass to the Worker.
         */
        addJobWithPromise(data = null) {
            let promises;
            const promiseId = this.promiseIdx++;
            const promise = new Promise((resolve, reject) => {
                promises = {
                    id: promiseId,
                    resolve: resolve,
                    reject: reject,
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
        onMessage(worker, data) {
            if (data['workDone$']) {
                worker.data.jobsCount$--;
                this.onQueueCheckInterval();
            }
            super.onMessage(worker, data);
        }
    }
    Collab.Balancer = Balancer;
    class Worker extends PromiseCommunicationBase {
        /**
         * Class constructor for Worker - it will be any worker including mid-level manager.
         * @param onManagerMessage Callback which will run when non-Promised message arrives to Worker from Manager.
         * @param onManagerMessageWithPromise Callback which will run when Promised message arrives to Worker from Manager.
         */
        constructor(onManagerMessage, onManagerMessageWithPromise) {
            super();
            this.onManagerMessage = onManagerMessage;
            this.onManagerMessageWithPromise = onManagerMessageWithPromise;
            /**
             * Sends normal, non-Promised message to closest Manager.
             * @param data Any data you want to pass to the Manager.
             */
            this.send = (data = null) => {
                process.send(_objectifyData(data));
            };
            /**
             * Sends work-done, non-Promised message to closest Manager. This is usually answer for Balancer Manager.
             * @param data Any data you want to pass to the Manager.
             */
            this.sendWorkDone = (data = null) => {
                const dataWorkDone = Object.assign({}, {
                    'workDone$': true
                }, _objectifyData(data));
                this.send(dataWorkDone);
            };
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
        getType() {
            return this.type;
        }
        /**
         * Reads options passed by Manager to this Worker while forking it.
         */
        getOptions() {
            return this.options;
        }
        /**
         * Reads name of Worker passed by Manager to this Worker while forking it.
         */
        getName() {
            return this.name;
        }
        onMessage(data) {
            if (!this.filterMsgIfPromised(data, this.onManagerMessageWithPromise, this.send, this.sendWorkDone)) {
                if (this.onManagerMessage)
                    this.onManagerMessage(_prepClearData(data), this.send, this.sendWorkDone);
            }
        }
    }
    Collab.Worker = Worker;
    /**
     * Reads type name of Worker passed by Manager to this Worker while forking it or empty string for main CEO process.
     */
    function getMyRole() {
        return process.argv[2] ? process.argv[2] : '';
    }
    Collab.getMyRole = getMyRole;
    /**
     * Returns true if this is main process.
     */
    function isCEO() {
        return getMyRole() == '';
    }
    Collab.isCEO = isCEO;
})(Collab || (Collab = {}));
module.exports = Collab;
