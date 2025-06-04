+++
authors = ["Lenox"]
title = "Android消息循环机制"
date = "2020-04-05"
description = "这篇文章主要讨论一下Android中的消息循环机制, 主要包括 `Handler` , `Looper` , `Message` , `MessageQueue`"
tags = [
    "Handler",
    "Looper",
    "Message",
    "MessageQueue",
]
categories = [
    "Android",
]
series = []
disableComments = true
draft = false
+++

> 这篇文章主要讨论一下Android中的消息循环机制, 主要包括 `Handler` , `Looper` , `Message` , `MessageQueue`

### 总览

启动应用时，系统会为该应用创建一个主线程（main thread），该线程负责将事件（Event）分派给相应的界面组件，比如说输入事件，绘图事件等。所有事件都会发送到一个事件（消息）队列中，然后等待分发。在应用正常运行期间，其主线程（main thread）一定不能退出（除非遇到崩溃）， `ActivityThread` 负责管理应用进程（Application process）中主线程（main thread）的执行，并且负责比如Activity的启动以及其生命周期的变化。

```java
// ActivityThread.java

public static void main(String[] args) {  
    Trace.traceBegin(Trace.TRACE_TAG_ACTIVITY_MANAGER, "ActivityThreadMain");  
  
    // Install selective syscall interception  
    AndroidOs.install();  
  
    // CloseGuard defaults to true and can be quite spammy.  We  
    // disable it here, but selectively enable it later (via // StrictMode) on debug builds, but using DropBox, not logs.  CloseGuard.setEnabled(false);  
  
    Environment.initForCurrentUser();  
  
    // Make sure TrustedCertificateStore looks in the right place for CA certificates  
    final File configDir = Environment.getUserConfigDirectory(UserHandle.myUserId());  
    TrustedCertificateStore.setDefaultUserDirectory(configDir);  
  
    // Call per-process mainline module initialization.  
    initializeMainlineModules();  
  
    Process.setArgV0("<pre-initialized>");  
  
    Looper.prepareMainLooper();  
  
    // Find the value for {@link #PROC_START_SEQ_IDENT} if provided on the command line.  
    // It will be in the format "seq=114"  long startSeq = 0;  
    if (args != null) {  
        for (int i = args.length - 1; i >= 0; --i) {  
            if (args[i] != null && args[i].startsWith(PROC_START_SEQ_IDENT)) {  
                startSeq = Long.parseLong(  
                        args[i].substring(PROC_START_SEQ_IDENT.length()));  
            }  
        }  
    }  
    ActivityThread thread = new ActivityThread();  
    thread.attach(false, startSeq);  
  
    if (sMainThreadHandler == null) {  
        sMainThreadHandler = thread.getHandler();  
    }  
  
    if (false) {  
        Looper.myLooper().setMessageLogging(new  
        LogPrinter(Log.DEBUG, "ActivityThread"));  
    }  
  
    // End of event ActivityThreadMain.  
    Trace.traceEnd(Trace.TRACE_TAG_ACTIVITY_MANAGER);  
    Looper.loop();  
  
    throw new RuntimeException("Main thread loop unexpectedly exited");  
}
```

正如上面所说，所有事件都会发送到一个事件（消息）队列中，然后等待分发，那这个队列是什么？谁负责分发呢？这里的事件（消息）都是一个一个 `Message` ，而容纳这些事件（消息）的队列叫做 `MessageQueue` ，驱动这个队列运行的动力来源于 `Looper` ，而 `Handler` 负责发送和处理这些事件（消息）。如上面的代码所述，在主线程开始运行的时候， `ActivityThread` 就在该线程上创建一个 `Looper` ，称为MainLooper，并且这个Looper是不允许退出的，然后通过调用 `Looper` 的 `loop` 方法让主线程上的消息队列（message queue）运行起来，为了不让主线程退出（因为主线程退出，应用也就相应退出了，这也是该 `Looper` 不允许退出的原因）， `Looper` 的 `loop` 方法里使用了死循环，通过这种方式，可以持续获取消息队列里的事件（消息），然后分发到相应的Target（Handler）去处理。由于同一进程中的所有组件的创建和生命周期的调度都是在主线程（界面线程）中进行的，所以你可以在组件的生命周期中获取到MainLooper，从而达到切换线程的目的。

### Message

所有事件（消息）的载体，包含许多可配置属性，比如消息的分发对象（target），数据，是否异步等。

#### 消息构造

虽然说 `Message` 的构造器是公开的，但构造 `Message` 的最好方法是使用 `Message.obtain()` 或 `Handler＃obtainMessage` 方法之一，这将从回收对象池中提取它们，避免分配新的对象。

```java
public static Message obtain() {  
    synchronized (sPoolSync) {  
        if (sPool != null) {  
            Message m = sPool;  
            sPool = m.next;  
            m.next = null;  
            m.flags = 0; // clear in-use flag  
            sPoolSize--;  
            return m;  
        }  
    }  
    return new Message();  
}
```

当退出 `Looper` 的时候，会将任何试图加入其 `MessageQueue` 的 `Message` 都会被回收（recycle）；当一个 `Message` 被 `Handler` 处理完成后或者消息被移除了，该 `Message` 也会被回收（recycle）;这些消息将会被回收再利用。

#### 消息分类

- 同步消息：Message#setAsynchronous(false)，受同步屏障（Synchronization barriers）约束。
- 异步消息：Message#setAsynchronous(true)，**不受**同步屏障（Synchronization barriers）约束。
- 屏障消息（barriers）： `Message` 的 `target` 是 `null` 。

### MessageQueue

消息队列是一个持有等待被 `Looper` 分发的消息列表，**它与Looper直接关联**，我们可以通过 `Handler` 间接的向其关联的 `Looper` 的 `MessageQueue` 添加 `Message` 。

#### 同步屏障（Synchronization barriers）

当从 `MessageQueue` 中获取下一条消息的时候，如果取到的消息是一个屏障消息的话，Looper会丢弃这条屏障消息和后面**连续**的同步消息，直到发现异步消息，然后处理这条异步消息。

```java
// MessageQueue.java

Message next() {
 for(;;) {
  ...
    if (msg != null && msg.target == null) {  
        // Stalled by a barrier.  Find the next asynchronous message in the queue.  
        do {  
            prevMsg = msg;  
            msg = msg.next;  
        } while (msg != null && !msg.isAsynchronous());  
    }
  ...
 }
}
```

比如往MessageQueue中添加如下几个消息：

```txt
MessageA(同步消息)->MessageB(屏障消息)->MessageC(同步消息)->MessageD(同步消息)->MessageE(异步消息)
```

则最终处理的消息列表为

```txt
MessageA(同步消息)->MessageE(异步消息)
```

#### IdleHandler

`IdleHandler` 是一个接口，它用于发现线程何时将阻塞等待更多的消息，当消息队列中没有消息或者该条消息分发时间大于当前时间（时间基于系统启动时间（SystemClock#uptimeMillis））时调用该接口的 `queueIdle` 方法，如果这个方法返回true，添加的 `IdleHandler` 将一直保持活动状态，不会被自动移除。

### Looper

`Looper` 作为驱动 `MessageQueue` 运行的动力，它与 `MessageQueue` 关联在一起。`Looper` 的创建与线程有关，每个线程中只能创建一个`Looper` (Looper#prepare())，`ThreadLocal` 管理每个线程中创建的 `Looper`。

### Handler

`Handler` 用于发送和处理当前线程中 `MessageQueue` 的 `Message`，它与 `Looper` 关联在一起。`Handler` 主要有以下两种用途：

 1. 调度一条需要延迟执行的消息。
 2. 切换线程。

调度消息的两种形式：

 1. post*: 队列发送一个包含 `Runnable` 的消息对象，当 `Looper` 调度到该条消息后，会执行该 `Runnable` 。
 2. send*: 队列发送一个包含数据的消息对象，当 `Looper` 调度到该条消息后，会将该消息分发给目标 `Handler`,交给 `Handler` 的`dispatchMessage()` 去具体分发。

 ```java
 // Handler.java

/**  
 * Handle system messages here. 
 */
public void dispatchMessage(@NonNull Message msg) {  
    if (msg.callback != null) {  
        handleCallback(msg);  
    } else {  
        if (mCallback != null) {  
            if (mCallback.handleMessage(msg)) {  
                return;  
            }  
        }  
        handleMessage(msg);  
    }  
}
 ```

#### 内存泄漏

原因：当自定义的 `Handler` 是 `Activity` 的非静态内部类的时候，这时候自定义的 `Handler` 持有外部 `Activity` 的引用（this$0），由于`Message` 强引用了 `Handler`，
如果外部 `Activity` 此时需要被destory，但发送的延时消息在 `MessageQueue` 中尚未被调度处理，那外部 `Activity` 将不会被回收导致内存泄漏。

解决方案：

- 当 `Activity#onDestroy` 的时候，移除发送的延时消息。
- 将匿名内部类或非静态内部类更改为静态内部类，如果静态内部类中需要引用外部 `Activity` ，那弱应用它 - `WeakReference`

检测：
开启严格模式: `StrictMode.enableDefaults()`

```java
// Handler.java
public Handler(@Nullable Callback callback, boolean async) {  
    if (FIND_POTENTIAL_LEAKS) {  
        final Class<? extends Handler> klass = getClass();  
        if ((klass.isAnonymousClass() || klass.isMemberClass() || klass.isLocalClass()) &&  
                   (klass.getModifiers() & Modifier.STATIC) == 0) {  
               Log.w(TAG, "The following Handler class should be static or leaks might occur: " +  
                   klass.getCanonicalName());  
        }  
    }  
    ...
}
