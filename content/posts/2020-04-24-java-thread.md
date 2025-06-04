+++
authors = ["Lenox"]
title = "Java Thread"
date = "2020-04-24"
description = ""
tags = [
    "Thread",
]
categories = [
    "Java",
]
series = []
disableComments = true
draft = false
+++

> 这篇文章聊一下Java中的Thread。

### Thread State

JVM中的 `Thread` 一共有**6**种状态，分别是 `NEW`, `RUNNABLE`, `BLOCKED`, `WAITING`, `TIMED_WAITING`, `TERMINATED`，需要注意的是，JVM的线程状态并不直接映射到操作系统的线程状态。

#### 1.NEW

表示线程当前处于 **新建** 状态，尚未启动（尚未执行`Thread#start()`）

#### 2.RUNNABLE

表示线程当前处于 **可运行** 状态（执行了`Thread#start()`），此时这个线程正在JVM中执行但是可能正在等待获取CPU时间片（timeslice）。所以这种状态下的线程其实可以分为 **Ready** 和 **Running** 两种状态。

- Ready：此时线程正在等待CPU的调度，处于准备运行状态。
- Running：此时线程已经获取到CPU时间片，正在运行中。

Ready --> Running：只有当前线程获取到CPU时间片后，才能从 **Ready** 状态切换到 **Running** 状态。

Running --> Ready：当前正在运行中的线程放弃正在占有的CPU时间片后，它将处于 **Ready** 状态，可以通过 `Thread#yield()` 的方式给调度器发送一个提示表示当前线程愿意放弃正在占用的CPU时间片，从而让其他线程有获得CPU调度的机会，这是一种启发性（heuristic）的尝试。

#### 3.BLOCKED

表示线程由于要等待获取锁的监视器（monitor）的所有权而处于 **阻塞** 状态。

 ```kotlin
 private fun blockedTest() {
    println("${Thread.currentThread().name} have entered the outside of the synchronized block.")
    synchronized(Any::class.java) {
        println("${Thread.currentThread().name} have acquired the lock")
        println("${Thread.currentThread().name} is ready to exit the synchronized block.")
    }
}
 ```

当我启动5个线程执行上面这个方法的时候，会有如下打印（当然每次的执行结果都不一样）：

 ```txt
Thread-0 have entered the outside of the synchronized block.
Thread-0 have acquired the lock.
Thread-2 have entered the outside of the synchronized block.
Thread-1 have entered the outside of the synchronized block.
Thread-4 have entered the outside of the synchronized block.
Thread-3 have entered the outside of the synchronized block.
Thread-5 have entered the outside of the synchronized block.
Thread-0 is ready to exit the synchronized block. // 此时有5个线程处于blocked状态
Thread-5 have acquired the lock.
Thread-5 is ready to exit the synchronized block. // 此时有4个线程处于blocked状态
Thread-3 have acquired the lock.
Thread-3 is ready to exit the synchronized block. // 此时有3个线程处于blocked状态
Thread-4 have acquired the lock.
Thread-4 is ready to exit the synchronized block. // 此时有2个线程处于blocked状态
Thread-1 have acquired the lock.
Thread-1 is ready to exit the synchronized block. // 此时有1个线程处于blocked状态
Thread-2 have acquired the lock.
Thread-2 is ready to exit the synchronized block. // 此时有0个线程处于blocked状态
 ```

我们可以通过上面打印结果得到哪些线程处于阻塞状态，当然我们还有更简便的方式-使用 `java.util.concurrent.locks.ReentrantLock`：

```kotlin
private val lock = ReentrantLock()

private fun blockedTest(value: Int) {
    println("${Thread.currentThread().name} have entered the outside of the synchronized block.")
    lock.lock()
    try {
        println("${Thread.currentThread().name} have acquired the lock")
    } finally {
        println("${Thread.currentThread().name} is ready to exit the synchronized block, the number of" +
                " threads in a blocked state: ${lock.queueLength}")
        lock.unlock()
    }
}
```

Output:

```txt
Thread-0 have entered the outside of the synchronized block.
Thread-3 have entered the outside of the synchronized block.
Thread-2 have entered the outside of the synchronized block.
Thread-1 have entered the outside of the synchronized block.
Thread-0 have acquired the lock.
Thread-0 is ready to exit the synchronized block, the number of threads in a blocked state: 3.
Thread-4 have entered the outside of the synchronized block.
Thread-4 have acquired the lock.
Thread-5 have entered the outside of the synchronized block.
Thread-4 is ready to exit the synchronized block, the number of threads in a blocked state: 3
Thread-3 have acquired the lock,
Thread-3 is ready to exit the synchronized block, the number of threads in a blocked state: 3.
Thread-2 have acquired the lock.
Thread-2 is ready to exit the synchronized block, the number of threads in a blocked state: 2.
Thread-1 have acquired the lock.
Thread-1 is ready to exit the synchronized block, the number of threads in a blocked state: 1.
Thread-5 have acquired the lock.
Thread-5 is ready to exit the synchronized block, the number of threads in a blocked state: 0.
```

#### WAITING

表示一个线程由于要等另外一个线程执行某个特殊操作而处于 **等待** 状态，主要表现在以下几个情况下：

 1.调用 `Object#wait() with no timeout`

当一个线程中使用锁对象的wait方法的时候，此时当前线程处于 **等待** 状态，它等待另一个线程使用相同的锁去 `notify` 或 `notifyAll`。

 2.调用 `Thread#join() with no timeout`

当在一个线程中调用另一个线程的 `join` 方法后，此时前者处于 **等待** 状态，前者需要等待后者执行完毕后才能继续执行。

 3.调用 `LockSupport#park()`

当一个线程在运行的时候调用 `LockSupport#park()`，此时这个线程处于 **等待** 状态，这个线程等待在另一个线程中以它为target调用 `interrupt()` 或 `LockSupport.unpark(target)`。

```kotlin
fun main() {
    val thread = thread {
        println("${Thread.currentThread().name} is ready to park.")
        LockSupport.park()
        println("${Thread.currentThread().name} ends park.")
    }

    Thread.sleep(1000)
    println("${Thread.currentThread().name} is running. ready to unpark ${thread.name}.")
    LockSupport.unpark(thread) // or thread.interrupt()
}
```

Output:

```txt
Thread-0 is ready to park.
main is running. ready to unpark Thread-0.
Thread-0 ends park.
```

#### TIMED_WAITING

表示一个线程处于 **定时等待** 状态，主要表现在以下几个情况下：

  1.调用 `Thread#sleep()`

  2.调用 `Object#wait() with timeout`

  3.调用 `Thread#join() with timeout`
  
  4.调用 `LockSupport#parkNanos()`

  5.调用 `LockSupport#parkUntil()`

#### TERMINATED

表示一个线程处于 **终止** 状态，此时线程已经执行完成。

### wait/notify

需要注意的是，`Object#wait()` 必须调用在 **同步块** 中，否则会抛出 `IllegalMonitorStateException`，因为 `wait` 方法会使当前线程在这个锁的监视器(monitor)上等待，某个线程进入同步块(synchronized(lock))后，才会拥有这个锁的监视器(monitor)，当这个线程执行到锁的 `wait()`，这个线程会释放这个锁的监视器(monitor)的所有权，此时当前线程处于 **WAITING** 状态，这时候其他线程就可以获取这个锁的监视器(monitor)然后进入同步块(synchronized(lock))。

当在另外一个线程中使用该锁去 `notify` 或 `notifyAll` 的时候，前者会唤醒某一个等待在这个锁的监视器(monitor)上的线程，后者则会唤醒所有，**这样被唤醒的线程会一直等待直到重新获取到这个锁的监视器(monitor)的所有权后，然后继续执行**。

```kotlin
fun foo() {
    // 多个线程进入
    synchronized(lock) {
        // 只有一个线程获取到这个锁的监视器（monitor）进入同步块，其他线程处于BLOCKED状态
        while(<condition does not hold>) {
            lock.wait() // 当前线程释放了这个锁的监视器（monitor）的所有权后处于WAITING状态，其他处于BLOCKED状态的线程拥有
                        // 获得锁的监视器（monitor）的所有权后进入同步块的机会。

            // 如果wait()方法返回，则说明处于WAITING状态的线程被唤醒后重新获取到了这个锁的监视器(monitor)的所有权。       
        }

        // Perform action appropriate to condition
    }
}
```

#### 经典的生产者-消费者模型

```kotlin

class Plate {
    private var food: Food? = null

    fun addFood(food: Food) {
        this.food = food
    }

    fun hasFood(): Boolean = food != null

    fun removeFood() {
        food = null
    }
}

class Food

private val lock = ReentrantLock()
private val condition = lock.newCondition()
private val myPlate = Plate()

private fun tryAddFood() {
    lock.lock()
    try {
        while (myPlate.hasFood()) {
            condition.await()
        }
        myPlate.addFood(Food())
        println("${Thread.currentThread().name} has added Food.")
        condition.signalAll()
    } finally {
        lock.unlock()
    }
}

private fun tryEatFood() {
    lock.lock()
    try {
        while (!myPlate.hasFood()) {
            condition.await()
        }
        myPlate.removeFood()
        println("${Thread.currentThread().name} has eaten Food.")
        condition.signalAll()
    } finally {
        lock.unlock()
    }
}

fun main() {
    for (i in 0..10) {
        thread {
            tryEatFood()
        }
    }

    for (i in 0..10) {
        thread {
            tryAddFood()
        }
    }
}
```

Output:

```txt
Thread-6 has added Food.
Thread-0 has eaten Food.
Thread-7 has added Food.
Thread-1 has eaten Food.
Thread-8 has added Food.
Thread-2 has eaten Food.
Thread-9 has added Food.
Thread-3 has eaten Food.
Thread-10 has added Food.
Thread-4 has eaten Food.
Thread-11 has added Food.
Thread-5 has eaten Food.
```
