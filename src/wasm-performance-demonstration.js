import { fib_with_wasm_rust, fib_with_wasm_c, fib_with_javascript } from './fib-performance.js';
import { greet } from "./greet-with-wasm-rust.ts"

function addRow(tech, take, unit, value) {
    var table = document.getElementById('table');
    var newRow = table.insertRow();

    var cell_tech = newRow.insertCell(0);
    var cell_take = newRow.insertCell(1);
    var cell_unit = newRow.insertCell(2);
    var cell_value = newRow.insertCell(3);

    cell_tech.innerHTML = tech;
    cell_take.innerHTML = take;
    cell_unit.innerHTML = unit;
    cell_value.innerHTML = value;
}

function updateRow(rowIndex, take, value) {
    let table = document.getElementById('table')
    let row = table.rows[rowIndex]
    row.cells[1].innerHTML = take;
    row.cells[3].innerHTML = value;
}

const TABLE = {
    WASM_WITH_RUST: { name: 'Wasm with Rust', rowIndex: 1 },
    WASM_WITH_C: { name: 'Wasm with C', rowIndex: 2 },
    JAVASCRIPT: { name: 'JavaScript', rowIndex: 3 },
}

const LOADING = '计算中...'
const UNIT = `毫秒`

window.onload = function () {
    var fib_with_wasm_rust_done = false
    var fib_with_wasm_c_done = false
    var fib_with_javascript_done = false
    document.getElementById('btn').addEventListener('click', function () {
        if (fib_with_wasm_rust_done && fib_with_wasm_c_done && fib_with_javascript_done) {
            greet('Wasm with Rust')
        }
    });

    let n = 45
    let table_title = document.getElementById('title')
    table_title.textContent = `计算斐波那契数列的第${n}项`

    addRow('技术实现', '花费时间', '单位', '值')
    addRow(TABLE.WASM_WITH_RUST.name, LOADING, UNIT, LOADING)
    addRow(TABLE.WASM_WITH_C.name, LOADING, UNIT, LOADING)
    addRow(TABLE.JAVASCRIPT.name, LOADING, UNIT, LOADING)

    fib_with_wasm_rust(n, (r, take) => {
        updateRow(TABLE.WASM_WITH_RUST.rowIndex, take, r)
        fib_with_wasm_rust_done = true
    })
    fib_with_wasm_c(n, (r, take) => {
        updateRow(TABLE.WASM_WITH_C.rowIndex, take, r)
        fib_with_wasm_c_done = true
    })
    fib_with_javascript(n, (r, take) => {
        updateRow(TABLE.JAVASCRIPT.rowIndex, take, r)
        fib_with_javascript_done = true
    })
};