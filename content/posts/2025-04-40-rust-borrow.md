+++
authors = ["Lenox"]
title = "探究Rust中HashMap的get方法"
date = "2025-04-30"
description = ""
tags = [
    "Rust",
    "trait",
    "Borrow",
    "HashMap"
]
categories = [
    "Rust",
]
series = []
disableComments = true
draft = false
+++

标准库的 `std::collections::HashMap` struct 定义如下:

```rust
pub struct HashMap<K, V, S = RandomState> {
    base: base::HashMap<K, V, S>,
}
```

泛型 K 限制 key 的类型, 泛型 V 限制 value 的类型, 当我们需要插入一条数据的时候，可以使用 `insert` 方法，定义如下:

```rust
 pub fn insert(&mut self, k: K, v: V) -> Option<V> {
        self.base.insert(k, v)
 }
```

很清晰，key/value都分别限制了类型，并需要移动所有权。
当我们需要获取指定 key 的 value 的时候，可以使用 `get` 方法，定义如下:

```rust
pub fn get<Q: ?Sized>(&self, k: &Q) -> Option<&V>
where
    K: Borrow<Q>,
    Q: Hash + Eq,
{
    self.base.get(k)
}
```

可以看到，`k` 的类型并不是我们预想的 `K`, 而是 `&Q`，为什么要这么设计呢？
首先我们先看下泛型要求:

- `K` 要求实现 `Borrow<Q>` 特征
- `Q` 要求实现 `Hash` 和 `Eq` 特征

我们考虑如下代码:

```rust
let mut m: HashMap<String, i32> = HashMap::<String, i32>::new();
m.insert("kobe".to_owned(), 40);
```

这里我们定义了一个变量 `m`, 其类型为 `HashMap<String, i32>`, 这就意味着 `K` 的类型为 `String`, `V` 的类型为 `i32`, 当我们想要获取 key 为 `kobe `
的 value 时，我们可以这样:

```rust
m.get(&"kobe".to_owned()) // Some(40)
```

根据 `get` 方法的签名我们可以知道，此时 `Q` 为 `String`, `K` 为 `String`, 首先， `Q` 要求实现 `Hash` 和 `Eq` 特征, `String` 满足; `K` 要求实现 `Borrow<Q>` 特征,
也就是说 `String` 要实现 `Borrow<String>` 特征, 我们好像在定义 `String` 的文件里没有找到这个，那它在哪呢?

```rust
#[stable(feature = "rust1", since = "1.0.0")]
impl<T: ?Sized> Borrow<T> for T {
    #[rustc_diagnostic_item = "noop_method_borrow"]
    fn borrow(&self) -> &T {
        self
    }
}
```

位于: _src/rust/library/core/src/borrow.rs_

这个叫做 **reflexive implementation**（自反实现），他表示：标准库已经为任何类型实现了 `Borrow` 特征，所以 `String` 也默认实现了 `Borrow<String>` 特征.
我们还可以使用如下方式获取 key 为 `kobe ` 的 value：

```rust
m.get("kobe") // Some(40)
```

比 `m.get(&"kobe".to_owned())` 这种方案更加简洁, 为什么可以这样呢？
`"kobe"` 的类型其实是 `&str`, 这就意味着 `Q` 为 `str`, `Q` 要求实现 `Hash` 和 `Eq` 特征, `str` 满足; `K` 要求实现 `Borrow<Q>` 特征, 也就是说 `String` 要实现 `Borrow<str>` 特征, 我们找找
标准库有没有定义:

```rust
#[stable(feature = "rust1", since = "1.0.0")]
impl Borrow<str> for String {
    #[inline]
    fn borrow(&self) -> &str {
        &self[..]
    }
}
```

确实有，位于: _src/rust/library/alloc/src/str.rs_
对于上述的例子, `get` 方法可以接收 `&str` 和 `&String` 这样的类型，由于Rust不支持方法重载, 这样可以支持更多类型参数，而且也更加简便.
