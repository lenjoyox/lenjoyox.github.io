+++
authors = ["Lenox"]
title = "屏幕刷新机制与Choreographer"
date = "2020-05-12"
description = ""
tags = [
    "屏幕刷新"
]
categories = [
    "Android",
]
series = []
disableComments = true
draft = false
+++

> 这篇文章主要讨论一下屏幕刷新机制与Android中的Choreographer。

#### 屏幕刷新率（Hz）

屏幕刷新率是指显示器每秒刷新的次数，单位是赫兹（Hz）。我们的显示器面板由许许多多的物理像素组成，比如对于一个分辨率（Resolution）为1080x1920的显示器，那它包含1080*1920个像素点（每行1080个像素点，每列1920个像素点）。

行扫描：显示器画完一行所有的像素点称为行扫描。

场扫描：显示器以行为单位画完所有的像素点成为场扫描。

水平同步信号（HSYNC）：表示开始扫描一行的物理信号。

垂直同步信号（VSYNC）：表示开始扫描一场的物理信号。

比如市面上大部分的设备的屏幕刷新率为60Hz，这意味着每秒会产生60个垂直同步信号（VSYNC）。

场同步周期（VSYNC Period）：指显示器扫描一场所消耗的时间。如对于屏幕刷新率为60Hz的显示器，扫描一场需要消耗16.6(1000/60)ms。

#### 帧率（FPS）

帧率是指帧处理器每秒合成的帧数，单位是FPS（Frames Per Seconds）。比如我们在一秒内滑动了一屏，则这一秒内一共生成了N（N>0）个帧；再比如我们浏览一个静态页面的时候，这时候我显示器一直显示的是缓存中旧的帧，所以在这期间没有新的帧生成。所以帧率是动态的。

#### 屏幕刷新总揽

FrameBuffer表示帧缓冲，存放着帧数据，其消费端来自显示器，而生产端来自帧处理器（CPU,GPU, Surface Flinger）。当显示器从FrameBuffer逐行扫描完一帧数据并渲染完成后，显示器将会开始新一轮的扫描。如果此时帧处理器正好将下一帧数据写入到FrameBuffer，那显示器就会正常扫描这新一帧的数据并渲染出来，如此循环，显示器就能播放一个连续的画面。

但这是理想的情况：新的一帧写入FrameBuffer的时机必须恰到好处，不能早于显示器扫描并渲染完一帧的时间点，否则就会导致正在扫描的一帧数据的一部分被新的一帧的一部分所更新，导致显示出来的一帧画面来自不同的两帧数据，**引发画面撕裂**；同样的也不能晚于显示器扫描并渲染完一帧的时间点，否则就会由于没有可用的新帧，导致显示器重复绘制上一帧，画面静止，**引发画面卡顿**。由此可见，帧处理器与显示器的协同很重要。

#### 撕裂

起因：假设此时帧率>屏幕刷新率（帧率=120FPS，屏幕刷新率=60Hz），则帧处理器生成一帧只需要8.3（1000/120）ms，而显示器扫描完一场需要16.6（1000/60）ms，假如显示器开始场扫描的时候同时帧处理器开始生产帧，在只有一个FrameBuffer的情况下，当显示器扫描到一半的时候，数据处理器已经生成了一个新的帧并更新到FrameBuffer，所以此时显示器开始扫描的另一半帧并不是上一个旧帧，而是新生成的帧的另一半，这就导致这一场扫描出来的画面是两个帧的组合，导致画面撕裂。

解决：导致画面撕裂的根本原因是FrameBuffer的数据在显示器尚未扫描完就被更新了，所以解决方案就是将数据处理器生成的帧存放在另一个缓冲-BackBuffer，则显示器继续从FrameBuffer读取数据，在未来一个合适的时机，交换FrameBuffer和BackBufer的数据（可以将这个过程看作瞬间完成），这样显示器就会扫描新一帧的数据。但这个合适的时机是什么呢？

- 假设是BackBuffer写完一帧数据后交换FrameBuffer和BackBuffer，如果帧处理器生成一帧的时间早于显示器扫描并渲染完一帧的时间，则也有会发生撕裂。

- 假设是显示器从FrameBuffer扫描并渲染完这一帧数据后，即将开始扫描并渲染下一帧之前，发送垂直同步信号，如果帧处理器生成一帧的时间早于显示器扫描并渲染完一帧的时间，那也就意味着此时BackBuffer已经有一帧新的数据等待交换，当收到垂直同步信号后，交换FrameBuffer和BackBuffer，显示器开始扫描并渲染这新的一帧。于此同时，帧处理器开始准备生产新的一帧数据，如此循环。

我们继续讨论以下VSYNC和Double Buffer：

##### VSYNC + FrameBuffer

此时显示器和帧处理器共用一个FrameBuffer并且使用VSYNC协调工作。假设此时显示器正在从FrameBuffer扫描并渲染帧数据，那在显示器未完成工作前，帧处理器是无法获得FrameBuffer的所有权而工作的，所以此时帧处理器只有等待显示器完成工作。当显示器终于完成帧的扫描与渲染，在开始下一帧的工作前发送垂直同步信号，帧处理器收到信号后开始生产帧，如果在开始扫描渲染帧的时候，新的一帧尚未准备好，那显示器还是显示的上一帧的数据，导致卡顿。这种帧处理先生产，显示器后渲染的模式非常类似于生产者消费者模型。所以单缓冲的情况下，显示器和帧处理器需要排队使用FrameBuffer，不能同时工作，提高效率，VSYNC的存在就是保证FrameBuffer的访问安全，这样可以有效的防止画面撕裂。

可见即使没有BackBuffer，VSYNC也可以防止画面撕裂，所以VSYNC才是解决画面撕裂的根本方案。

![img](/images/2020-05-12-android-display-refresh-and-choreographer-img1.png)

和JAVA中同步锁一样，虽然保证了线程安全，但是降低了效率。对应到显示器，就是避免了撕裂，增加了卡顿率，而BackBuffer的出现可以保证在显示器扫描渲染帧的同时帧处理去生产新的帧，这样提高了在显示器扫描并渲染完一帧后，能够有新的一帧去扫描和渲染的机率，注意，只是提高机率，并无法根治。

![img](/images/2020-05-12-android-display-refresh-and-choreographer-img2.png)

#### 卡顿

卡顿主要是由于在显示器正常的同步周期内，没有可用的新帧，导致重复显示上一帧，单缓冲下情况更糟，双缓冲有很大的改善，因为在双缓冲情况下帧处理器可以在显示器开始扫描并渲染帧的时候生产新的帧，这样提高了单位时间新帧的生产率，但是如果在开始扫描新帧的时候依旧没有新帧在BackBuffer中生成，则依旧会卡顿。

假设此时帧率<屏幕刷新率（帧率=60FPS，屏幕刷新率=120Hz），则帧处理器生成一帧需要16.6（1000/60）ms，而显示器扫描完一场只需要8.3（1000/120）ms，假如FrameBuffer已经有一帧的数据，显示器开始场扫描的时候同时帧处理器开始生产帧，8.3ms后扫描完毕，发生垂直同步信息开始扫描下一帧，但是帧处理器距离一帧生成还需要8.3ms，所以BackBuffer中尚未生成完毕，则显示器继续显示旧帧，导致卡顿，这一次扫描结束后，BackBuffer中的帧数据就已经准备好了，垂直同步信号发送后，交换FrameBuffer与BackBuffer，这样就可以扫描新的一帧。

![img](/images/2020-05-12-android-display-refresh-and-choreographer-img3.png)

所以卡顿并不能根治，只能优化。

#### Android帧渲染流程

 1. (CPU) App的UI线程处理输入事件，调用应用回调，执行Measure, Layout, Draw更新视图层次结构中记录的绘图命令列表；
 2. (CPU) App的RenderThread负责将记录的命令发送到GPU；
 3. (GPU) GPU绘制这一帧；
 4. (SurfaceFlinger) SurfaceFlinger组合屏幕应该最终显示出的内容，并将画面提交给屏幕的硬件抽象层（HAL）;
 5. 屏幕最终呈现该帧的内容。

这个过程由基于VSYNC的Choreographer控制。

#### FrameBuffer + BackBuffer(CPU+GPU) + VSYNC

从上述*Android帧渲染流程*中可以知道，CPU->GPU->SF是串行工作的，而它们和显示器是并行工作的。除了由于帧率<屏幕刷新率而发生的卡顿，
帧率==屏幕刷新率也可能发生卡顿(并没有在一帧限定的渲染的时间范围内完成)：

![img](/images/2020-05-12-android-display-refresh-and-choreographer-img4.png)

在显示器从FrameBuffer中扫描B帧的同时帧处理器开始生产C帧，但是在CPU部分消耗的时间过长，导致超过了屏幕的同步周期，导致B帧被重复显示，从而发生卡顿；当显示开始扫描C帧的同时帧处理器开始生产D帧，但是由于GPU绘制D帧时间过长导致超过了屏幕的同步周期，导致D帧也无法在显示器同步周期内生产出来从而继续显示C帧，又引发了卡顿。

#### FrameBuffer + BackBuffer(GPU) + BackBuffer(CPU) + VSYNC

优化上述卡顿可以使用Triple Buffer：GPU和CPU拥有自己的Buffer。

![img](/images/2020-05-12-android-display-refresh-and-choreographer-img5.png)

可以看到在第三个垂直同步点，即使C帧尚未生成，但并不影响D帧在CPU上的计算，因为它们各自使用独立的Buffer，这样D帧就不需要等下一个垂直同步信号（第四个）。

即使Triple Buffer可以极大的减少卡顿，但我们重点应该放在CPU层，减少在这个层所消耗的时间，比如减少View的嵌套，避免UI线程的阻塞等方案。

#### Choreographer

- Android 3.0 引入了硬件加速（GPU）;
- Android 4.0 默认开启了硬件加速；
- Android 4.1 开始黄油计划，上层Choreographer开始介绍垂直同步信号（VSYNC），引入了三缓冲；
- VSYNC不但控制FrameBuffer和BackBuffer的交换，还控制帧处理器何时开始计算新的帧。

Choreographer是基于VSYNC的。我们通常开始进行Measure->Layout->Draw或invalidate的前提是接受到VSYNC后。

```java
// android.view.ViewRootImpl.java

package android.view;

public final class ViewRootImpl implements ViewParent,
        View.AttachInfo.Callbacks, ThreadedRenderer.DrawCallbacks {

    final class TraversalRunnable implements Runnable {
        @Override
        public void run() {
            doTraversal();
        }
    }

    final TraversalRunnable mTraversalRunnable = new TraversalRunnable();

    @UnsupportedAppUsage
    void scheduleTraversals() {
        if (!mTraversalScheduled) {
            mTraversalScheduled = true;
            mTraversalBarrier = mHandler.getLooper().getQueue().postSyncBarrier();
            mChoreographer.postCallback(
                    Choreographer.CALLBACK_TRAVERSAL, mTraversalRunnable, null);
            notifyRendererOfFramePending();
            pokeDrawLockIfNeeded();
        }
    }

    void doTraversal() {
        if (mTraversalScheduled) {
            mTraversalScheduled = false;
            mHandler.getLooper().getQueue().removeSyncBarrier(mTraversalBarrier);

            if (mProfile) {
                Debug.startMethodTracing("ViewAncestor");
            }

            performTraversals();

            if (mProfile) {
                Debug.stopMethodTracing();
                mProfile = false;
            }
        }
    }
}
```

通常我们通过`mDisplayEventReceiver#scheduleVsync()`去请求下一个垂直同步信号，当显示器开始扫描并渲染下一帧的时候，会回调`mDisplayEventReceiver`的`onVsync(long timestampNanos, long physicalDisplayId, int frame)`，然后调度到主线程，然后执行`doFrame（）`，如果主线程阻塞了一些时间，则有可能丢帧，然后按顺序执行：CALLBACK_INPUT->CALLBACK_ANIMATION->CALLBACK_INSETS_ANIMATION->CALLBACK_TRAVERSAL->CALLBACK_COMMIT，其中CALLBACK_TRAVERSAL就是视图层级的Measure->Layout->Draw。所以这部分是上层开发者唯一所能控制的帧渲染，我们需要尽量减少这部分所消耗的时间。

我们通常使用Choreographer来监控生成的每一帧所消耗的时间，从而得知是否超过屏幕的同步周期，检测卡顿。

##### 帧生成时间检测

```kotlin
    private fun calcCostTimeMillisPerFrame(intendedCostTimeMillisPerFrame: Float) {
        Choreographer.getInstance().postFrameCallback(
            MyFrameCallback(last = -1L)
        )
    }

    private inner class MyFrameCallback(private var last: Long = -1) : Choreographer.FrameCallback {

        override fun doFrame(frameTimeNanos: Long) {
            last = if (last == -1L) {
                frameTimeNanos
            } else {
                // calc
                val realCostTimeMillisPerFrame = (frameTimeNanos - last) / 1000_000F
                frameTimeNanos
            }
            Choreographer.getInstance().postFrameCallback(this)
        }
    }
```
