
import init, { fib } from "rust-wasm";

self.onmessage = function (e) {
    console.log("Start init Wasm with Rust ...")
    let init_start_time = performance.now()
    init().then(() => {
        let init_end_time = performance.now()
        console.log(`Init Wasm with Rust done, took ${init_end_time - init_start_time} milliseconds!`)
        let n = e.data
        let startTime = performance.now()
        let r = fib(n)
        let endTime = performance.now()
        let take = endTime - startTime

        console.log(`Calculating ${n}th Fibonacci with Wasm_Rust took ${take} milliseconds,${n}th fibonacci is ${r}.`)
        self.postMessage({ r: r, take: take });
    })
};
