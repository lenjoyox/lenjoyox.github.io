+++
authors = ["Lenox"]
title = "Java Volatile"
date = "2020-04-26"
description = ""
tags = [
    "Volatile",
]
categories = [
    "Java",
]
series = []
disableComments = true
draft = false
+++

> 这篇文章聊一下Java中的Volatile。

### 前言

在讨论Volatile之前，我们先看以下代码。我们定义了一个 `Boolean` 类型的变量-`flag`，线程（Thread-flagSetter）负责等待线程（Thread-flagGetter）运行后设置 `flag` 为 `true`，线程（Thread-flagGetter）循环读取 `flag` 的值，如果发现 `flag` 被更改为 `true`，则退出循环，此线程运行结束。由于JVM会等待所有的非守护线程运行结束后结束进程，所以按照预期，此时 *Thread-flagGetter*/*Thread-flagSetter*/*Thread-main*三个线程运行结束，JVM结束运行。

```kotlin
private var flag = false

fun main() {
    thread(name = "Thread-flagGetter") {
        println("${Thread.currentThread().name} is running until flag is set to true.")
        var count = 0
        while (!flag) {
            count++
        }
        println("${Thread.currentThread().name} is ready to terminate. the count of loop is $count")
    }

    thread(name = "Thread-flagSetter") {
        Thread.sleep(1000) // wait for Thread-flagGetter to run first.
        println("${Thread.currentThread().name} is ready to set flag to true.")
        flag = true
    }
}
```

但是真的会按照我们设想的预期执行吗，我们运行以上代码，控制台如下打印：

```txt
Thread-flagGetter is running until flag is set to true.
Thread-flagSetter is ready to set flag to true.
```

我们发现线程（Thread-flagSetter）已经将 `flag` 设置为 `true`，线程（Thread-flagGetter）也一直在运行并循环获取 `flag`的值，但这个值一直是先前的值 - `false`，JVM进程因此一直保持活动状态。

#### 解决方案一

向 `flag` 变量添加 `@Volatile` 注解，这是Kotlin语法，其作用和Java中添加 `volatile` 关键字一样。

```diff
+@Volatile 
 private var flag = false

 ...

```

```kotlin
// JvmFlagAnnotations.kt

/**
 * Marks the JVM backing field of the annotated property as `volatile`, meaning that writes to this field
 * are immediately made visible to other threads.
 */
@Target(FIELD)
@Retention(AnnotationRetention.SOURCE)
@MustBeDocumented
public actual annotation class Volatile
```

修改完后，继续运行代码，控制台如下打印：

```txt
Thread-flagGetter is running until flag is set to true.
Thread-flagSetter is ready to set flag to true.
Thread-flagGetter is ready to terminate. the count of loop is -27740848

Process finished with exit code 0
```

#### 解决方案二

修改 `flag` 变量的类型为 `java.util.concurrent.atomic.AtomicBoolean`，使用该类型的成员方法去 get/set：

```diff
-private var flag = false
+private val flag = AtomicBoolean(false)

fun main() {
    thread(name = "Thread-flagGetter") {
        println("${Thread.currentThread().name} is running until flag is set to true.")
        var count = 0
-       while (!flag)
+       while (!flag.get()) {
            count++
        }
        println("${Thread.currentThread().name} is ready to terminate. the count of loop is $count")
    }

    thread(name = "Thread-flagSetter") {
        Thread.sleep(1000) // wait for Thread-flagGetter to run first.
        println("${Thread.currentThread().name} is ready to set flag to true.")
-       flag = true
+       flag.compareAndSet(false, true)
    }
}
```

修改完后，继续运行代码，控制台如下打印：

```txt
Thread-flagGetter is running until flag is set to true.
Thread-flagSetter is ready to set flag to true.
Thread-flagGetter is ready to terminate. the count of loop is 213872250

Process finished with exit code 0
```

### 正文

由于现代计算机是多处理器架构，所以每个线程可能运行在不同的处理器上，当在某个线程中处理数据的时候，该线程也许会将数据从 **RAM**（Main Memory） 拷贝（Copy）到执行它的CPU的缓存（Cache）上，所以线程可能直接对CPU的缓存（Cache）进行读写而不是 **RAM**（Main Memory）。上面例子中，线程（Thread-flagSetter）和 线程（Thread-flagGetter）将 `flag` 变量从 **RAM**（Main Memory） 拷贝（Copy）到各自执行它的CPU的缓存（Cache）上，使其成为副本，当线程（Thread-flagSetter）更新 `flag` 变量的值时，实际会先更新到缓存（Cache），此时尚未立刻同步到 **RAM**（Main Memory） 上，当线程（Thread-flagGetter）读取 `flag` 变量的值时，实际也是先读取的是缓存（Cache）上的值，虽然 **RAM**（Main Memory） 上的 `flag` 变量的值已经改变，但是尚未同步，所以线程（Thread-flagGetter）读取的还是未同步的旧值，这也是上个例子中问题的原因。

由于该变量尚未被另一个线程写回 **RAM**（Main Memory） 而导致线程尚未看到变量的最新值而导致的问题称为 **可见性（visibility）** 问题。一个线程的更新对其他线程不可见。

处理器负责执行程序指令，通常他们需要从 **RAM**（Main Memory） 获取程序指令以及需要的相关数据，由于处理器可以每秒处理大量的指令，所以直接从 **RAM**（Main Memory） 获取并不是一个高效的选择，因此为了处理的更快些，将这些相关指令和数据存入缓存（Cache）中，只有当高速缓存（Cache）和 **RAM**（Main Memory） 之间发生 **同步** 时，对数据的更改才会写会到 **RAM**（Main Memory） 中，但是 **同步** 的时机无法把控，这也意味这对缓存数据的更改 **并不会立即** 同步到 **RAM**（Main Memory） 中，所以，**缓存一致性（cache coherence）** 是必须考虑的，否则就会出现以上例子中出现的问题。

#### Volatile（易变性）

Java中的 `volatile` 关键字和Kotlin中的 `@Volatile` 注解就是用来解决变量可见性这个问题的。正如解决方案一，将 `flag` 变量声明成 `volatile` 后，所有对该 `flag` 变量值的更新会 **立刻** 写会回到 **RAM**（Main Memory）上，并且所有对该 `flag` 变量值的读取会直接从 **RAM**（Main Memory）上读取，这样就保证了该变量对其他线程可见（variable）。
