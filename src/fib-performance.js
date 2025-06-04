import FibWithWasmRustWorker from './fib-with-wasm-rust.worker.js';
import FibWithWasmCWorker from './fib-with-wasm-c.worker.js';
import FibWithWasmJavaScriptWorker from './fib-with-wasm-js.worker.js';

export function fib_with_wasm_rust(n, callback) {
    var worker = new FibWithWasmRustWorker();
    worker.onmessage = function (e) {
        let data = e.data
        callback(data.r, data.take)
    }
    worker.postMessage(n)
}

export function fib_with_wasm_c(n, callback) {
    var worker = new FibWithWasmCWorker();
    worker.onmessage = function (e) {
        let data = e.data
        callback(data.r, data.take)
    }
    worker.postMessage(n)
}

export function fib_with_javascript(n, callback) {
    var worker = new FibWithWasmJavaScriptWorker();
    worker.onmessage = function (e) {
        let data = e.data
        callback(data.r, data.take)
    }
    worker.postMessage(n)
}