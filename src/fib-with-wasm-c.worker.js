
self.onmessage = function (e) {
    console.log("Start init Wasm with C ...")
    let init_start_time = performance.now()
    fetch('/misc/math_with_c.wasm')
        .then(response => response.arrayBuffer())
        .then(buffer => WebAssembly.compile(buffer))
        .then(module => { return new WebAssembly.Instance(module) })
        .then(instance => {
            let init_end_time = performance.now()
            console.log(`Init Wasm with C done, took ${init_end_time - init_start_time} milliseconds!`)
            let n = e.data
            let fib = instance.exports._Z3fibi;
            let startTime = performance.now()
            let r = fib(n)
            let endTime = performance.now()
            let take = endTime - startTime
            console.log(`Calculating ${n}th Fibonacci with Wasm_C took ${take} milliseconds,${n}th fibonacci is ${r}.`)
            self.postMessage({ r: r, take: take });
        });
};
