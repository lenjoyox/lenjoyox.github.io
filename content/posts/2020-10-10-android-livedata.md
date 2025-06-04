+++
authors = ["Lenox"]
title = "Android LiveData"
date = "2020-10-10"
description = ""
tags = []
categories = [
    "Android",
]
series = []
disableComments = true
draft = false
+++

#### 设计架构

![img](/images/2020-10-10-android-livedata-arch.png)

通常`LiveData`存在于`ViewModel`，这样可保证在配置变更（如旋转）情况下，`LiveData`数据源稳定存在。

#### 观察

`LiveData`作为可观察对象，提供以下两种观察方式：

##### observe [LifecycleBoundObserver]

所有通过这种方式添加的`Observer`都会包装成`LifecycleBoundObserver`，这样`Observer`就和`LifecycleOwner`的生命周期绑定，由`LifecycleOwner`的生命周期决定当前`Observer`是否是活动（active）状态，`LiveData`规定的活动状态是: `LifecycleOwner`的Lifecyle state至少是*STARTED*，也就是Activity/Fragment的生命周期处于*onStart*, *onResume*或*onPause*，下图解释Lifecycle中*STATE*和*EVENT*的关系。

![img](/images/2020-10-10-android-livedata-lifecyle-state-event.png)

不仅如此，Lifecycle的加入也让观察者对象具备根据活动（active）状态主动分发数据的能力。这意味着如果`LiveData`在`LifecycleOwner`非活动状态下发送数据，这时候数据不会通知给观察者，而是先存储下来，等待`LifecycleOwner`处于活动状态后再将数据分发给观察者。

由于`Observer`会包装成`LifecycleBoundObserver`交给Lifecycle管理，当受到DESTROYED信号的时候，它会自动移除该观察者。

##### observeForever [AlwaysActiveObserver]

所有通过这种方式添加的`Observer`都会包装成`AlwaysActiveObserver`，该观察者会一直处于活动（active）状态，这样`LiveData`发送的所有数据都会通知给观察者。

不像`LifecycleBoundObserver`会自动移除观察者，`AlwaysActiveObserver`需要我们手动手动的去移除观察这对象。

#### 通知

`LiveData`提供了两种通知方式：

##### postValue

这个方法用于发送数据所处的线程是工作线程时，数据会存储到`mPendingData`，直到系统调度`Runnable`到主线程去执行的时候把`mPendingData`通过`setValue()`分发出去，再系统调度过程中，`mPendingData`之存储最近一次更新的数据，这个方法是线程安全。

这里系统调用`Runnable`到主线程的时候，`Handler`发送的是异步消息，这样使消息不受同步屏障的影响尽快得到调度，降低因系统调度的延迟造成部分数据丢失的情况。

##### setValue

这个方法用于发送数据所处的线程是主线程是，它会将数据存储在`mData`等待合适的条件去分发（根据观察者的类型），将`mVersion`递增，让观察者对象与自己的`mLastVersion`对比，以确定是否有可用的数据等待去分发（mVersion > mLastVersion）。
