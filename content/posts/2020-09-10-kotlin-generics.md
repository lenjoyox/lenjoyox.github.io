+++
authors = ["Lenox"]
title = "Kotlin Generics"
date = "2020-09-10"
description = ""
tags = [
    "Generics",
]
categories = [
    "Kotlin",
    "Covariant",
    "Contravariance"
]
series = ["Generics"]
disableComments = true
draft = false
+++

> 这篇文章讨论一下Kotlin中的泛型

### declaration-site variance

在Java中，`Collection<String>` 是 `Collection<? extends Object>` 的子类，因为该类型发生了协变(covariant)，根据PECS原则，此类型作为Producer只能生产数据。对于下面这个类：

```java
interface Producer<T> {
    T produce();
}
```

这个类只有一个方法，它只能生产数据，并不能消耗数据，所以 `Producer<String>` 应该是 `Producer<Object>` 的子类，但Java编译器不知道，而且没有办法向Java编译器解释这种行为，所以Java禁止了它。

但是在Kotlin中，可以向Kotlin编译器解释这种行为，这被称为：**declaration-site variance**。

#### variance annotation - out修饰符

我们可以对 `Producer` 的类型参数（type parameter）T进行注释，以确保仅从 `Producer<T>` 的 `produce` 方法返回（产生）该参数，并且永不使用它。为此我们提供 `out` 修饰符（**variance annotation**）：

```kotlin
interface Producer<out T> {  
    fun produce(): T  
}
```

这样，Producer在类型参数T中是协变的，或者T是协变类型参数。我们可以将Producer视为T的生产者，而不是T的消费者。
这样就完成下面转换：

```kotlin
val stringProducer = object : Producer<String> {  
    override fun produce(): String = "produce str"  
}  
  
val anyProducer: Producer<Any> = stringProducer
```

#### variance annotation - in修饰符

相对于 `out` 修饰符使类型参数（type parameter）发生协变(covariant)， `in` 修饰符使类型参数（type parameter）发生逆变(contravariance)，我们可以对 `Consumer` 的类型参数（type parameter）T进行 `in` 注释，以确保它只能被消耗而不能产生。这样我们可以将 `Consumer` 视为T的消费者而不是生产者。

```kotin
interface Consumer<in T> {  
    fun consume(t: T)  
}
```

这样就完成下面转换：

```kotlin
val anyConsumer = object : Consumer<Any> {  
    override fun consume(t: Any) {  
        require(t is String && t == "string consumer")  
    }  
}  
  
val stringConsumer: Consumer<String> = anyConsumer  
stringConsumer.consume("string consumer")
```

也就是说: **Consumer in, Producer out**

### Type projections

* `Array<out String>` 对应Java中的 `Array<? extends String>`。
* `Array<in String>` 对应Java中的 `Array<? super String>`。

### Generic constraints

上边界（Upper bounds）是泛型限制中最常见的限制类型，泛型默认的上边界是 `Any?` ，并且只能有一个上边界：
`<T: Number>`。如果同一个类型参数需要一个以上的上限，则需要单独的 `where` 子句：

```kotlin
fun <T> copyWhenGreater(list: List<T>, threshold: T): List<String>  
        where T : CharSequence,
              T : Comparable<T> {  
    return list.filter { it > threshold }.map { it.toString() }  
}
```

传递的类型必须同时满足where子句的所有条件。在上面的示例中，T类型必须同时实现CharSequence和Comparable。

### Type erasure

在泛型声明中，Kotlin仅仅在编译时（compile time）执行类型安全检查，而在运行时（runtime），泛型类型的实例不持有类型参数的实际任何信息（类型擦除），比如 `Comparable<String>` 实例在运行时会被擦除成 `Comparable<*>`。

因此，编译器禁止 `comparable is Comparable<String>`。

```txt
Cannot check for instance of erased type: Comparable<String>
```

并且类型转换（Type casts）在运行时（runtime）是*unchecked*的：`comparable as Comparable<String>`。

```txt
Unchecked cast: Comparable<T> to Comparable<String>
```

**内联函数的 `reified` 的类型参数被调用位置的内联函数主体中的实际类型参数替换，因此可以用于类型检查和强制转换**

```kotlin
inline fun <reified T> membersOf() = T::class.members

inline fun <reified T> foo(t: T): Int? {  
    if (t is String) {  
        return (t as String).toIntOrNull()  
    }  
    if (t is Int) return t  
    if (t is Int?) return t  
    return null  
}
```
