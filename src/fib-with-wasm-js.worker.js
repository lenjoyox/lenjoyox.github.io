
self.onmessage = function (e) {
    let n = e.data
    let startTime = performance.now()
    let r = __fib_with_javascript(n)
    let endTime = performance.now()
    let take = endTime - startTime

    console.log(`Calculating ${n}th Fibonacci with JavaScript took ${take} milliseconds,${n}th fibonacci is ${r}.`)
    self.postMessage({ r: r, take: take });
};

function __fib_with_javascript(n) {
    if (n <= 1)
        return n;
    return __fib_with_javascript(n - 1) + __fib_with_javascript(n - 2);
}
