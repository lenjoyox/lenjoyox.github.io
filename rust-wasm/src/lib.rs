use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    pub fn alert(s: &str);
}

#[wasm_bindgen]
pub fn greet(name: &str) {
    alert(&format!("Hello, {}!", name));
}

#[wasm_bindgen]
pub fn fib(nth: i32) -> i32 {
    if nth < 2 {
        return nth;
    }
    fib(nth - 1) + fib(nth - 2)
}


#[cfg(test)]
mod tests {
    use crate::fib;

    #[test]
    fn fib_45_works() {
        assert_eq!(1134903170, fib(45));
    }

    #[test]
    fn fib_0_works() {
        assert_eq!(0, fib(0));
    }

    #[test]
    fn fib_1_works() {
        assert_eq!(1, fib(1));
    }
}
