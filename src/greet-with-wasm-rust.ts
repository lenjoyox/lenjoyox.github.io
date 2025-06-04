import * as wasm from 'rust-wasm'

export function greet(msg: string) {
    wasm.default().then(() => {
        wasm.greet(msg)
    })
}