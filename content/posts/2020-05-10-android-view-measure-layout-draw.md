+++
authors = ["Lenox"]
title = "Android中View的Measure, Layout, Draw流程"
date = "2020-05-10"
description = ""
tags = [
    "View",
]
categories = [
    "Android",
]
series = []
disableComments = true
draft = false
+++

> 这篇文章主要讨论一下Android中的View的Measure, Layout, Draw流程。

#### 问题

在讨论整个流程之前，首先抛出两个问题，这两个问题的答案我会在后续进行解答：

- 为什么在`Activity`的**onCreate**这个生命周期方法中尝试获取某个View的宽高为**0**？
- 为什么在`Activity`的**onCreate**这个生命周期方法中使用`View#post()`或`viewTreeObserver`可以获取到某个View的宽高？

```kotlin
// MainActivity.kt

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val myView = findViewById<MyView>(R.id.myView)

        myView.post {
            val width = myView.measuredWidth
            val height = myView.measuredHeight
        }
        myView.viewTreeObserver.addOnGlobalLayoutListener(object :ViewTreeObserver.OnGlobalLayoutListener {
            override fun onGlobalLayout() {
                myView.viewTreeObserver.removeOnGlobalLayoutListener(this)

                val width = myView.measuredWidth
                val height = myView.measuredHeight
            }
        })
    }
```

#### 总体流程

由于`Activity`是Ui展示的重要组件，所以我们从`Activity`生命周期的角度去讨论View的**Measure**,**Layout**,**Draw**流程。`ActivityThread`是个非常重要的类，它管理主线程的执行，调度，执行应用中的Activities,Broadcasts等组件，这个类中有几个和`Activity`密切相关的方法：

- performLaunchActivity()：主要用于`Activity`的创建和初始化，并调用`Activity`的生命周期方法-**onCreate()**。
- handleResumeActivity()：主要用于`DecorView`的创建并添加到与`Activity`（`Window`）关联的`WindowManager`上，开始进行View Tree的Measure, Layout, Draw，并调用`Activity`的生命周期方法-**onResume()**。

由上可知，在执行`Activity`的生命周期方法**onCreate()**时，尚未开始进行View Tree的Measure，所以此时获取不到View的宽高，这就解决了第一个问题。

在**Resume**`Activity`后，开始执行View Tree的Measure, Layout, Draw流程，我们开始详细讨论这一部分。

#### ActivityThread#handleResumeActivity

这是**Resume Activity**的关键方法，我们摘取部分关键代码：

```java
// ActivityThread.java

    public void handleResumeActivity(IBinder token, boolean finalStateRequest, boolean isForward,
            String reason) {
        ...
        // TODO Push resumeArgs into the activity for consideration
        final ActivityClientRecord r = performResumeActivity(token, finalStateRequest, reason);
        if (r == null) {
            // We didn't actually resume the activity, so skipping any follow-up actions.
            return;
        }
        if (mActivitiesToBeDestroyed.containsKey(token)) {
            // Although the activity is resumed, it is going to be destroyed. So the following
            // UI operations are unnecessary and also prevents exception because its token may
            // be gone that window manager cannot recognize it. All necessary cleanup actions
            // performed below will be done while handling destruction.
            return;
        }

        final Activity a = r.activity;

        if (r.window == null && !a.mFinished && willBeVisible) {
            r.window = r.activity.getWindow();
            View decor = r.window.getDecorView();
            decor.setVisibility(View.INVISIBLE);
            ViewManager wm = a.getWindowManager();
            WindowManager.LayoutParams l = r.window.getAttributes();
            a.mDecor = decor;
            l.type = WindowManager.LayoutParams.TYPE_BASE_APPLICATION;
            l.softInputMode |= forwardBit;
            if (r.mPreserveWindow) {
                a.mWindowAdded = true;
                r.mPreserveWindow = false;
                // Normally the ViewRoot sets up callbacks with the Activity
                // in addView->ViewRootImpl#setView. If we are instead reusing
                // the decor view we have to notify the view root that the
                // callbacks may have changed.
                ViewRootImpl impl = decor.getViewRootImpl();
                if (impl != null) {
                    impl.notifyChildRebuilt();
                }
            }
            if (a.mVisibleFromClient) {
                if (!a.mWindowAdded) {
                    a.mWindowAdded = true;
                    wm.addView(decor, l);
                } else {
                    // The activity will get a callback for this {@link LayoutParams} change
                    // earlier. However, at that time the decor will not be set (this is set
                    // in this method), so no action will be taken. This call ensures the
                    // callback occurs with the decor set.
                    a.onWindowAttributesChanged(l);
                }
            }

            // If the window has already been added, but during resume
            // we started another activity, then don't yet make the
            // window visible.
        } else if (!willBeVisible) {
            if (localLOGV) Slog.v(TAG, "Launch " + r + " mStartedActivity set");
            r.hideForNow = true;
        }
        ...
    }
```

我们可以看到，这里创建了一个`DecorView`并添加到`Activity`的`WindowManager`上，我们具体看看`WindowManager#addView()`的实现：

```java
// WindowManagerImpl.java

    private final WindowManagerGlobal mGlobal = WindowManagerGlobal.getInstance();

    @Override
    public void addView(@NonNull View view, @NonNull ViewGroup.LayoutParams params) {
        applyDefaultToken(params);
        mGlobal.addView(view, params, mContext.getDisplayNoVerify(), mParentWindow,
                mContext.getUserId());
    }
```

实际使用的是`WindowManagerGlobal`这个单例对象进行DecoreView的添加，我们再进入看看：

```java
// WindowManagerGlobal.java

    public void addView(View view, ViewGroup.LayoutParams params,
            Display display, Window parentWindow, int userId) {
        ...

        ViewRootImpl root;
        View panelParentView = null;

        synchronized (mLock) {
            ...

            root = new ViewRootImpl(view.getContext(), display);

            view.setLayoutParams(wparams);

            mViews.add(view);
            mRoots.add(root);
            mParams.add(wparams);

            // do this last because it fires off messages to start doing things
            try {
                root.setView(view, wparams, panelParentView, userId);
            } catch (RuntimeException e) {
                // BadTokenException or InvalidDisplayException, clean up.
                if (index >= 0) {
                    removeViewLocked(index, true);
                }
                throw e;
            }
        }
    }
```

实际又是通过`ViewRootImpl`设置`DecoreView`的，我们继续进入看看：

```java
// ViewRootImpl.java

    public void setView(View view, WindowManager.LayoutParams attrs, View panelParentView,
            int userId) {
        synchronized (this) {
            if (mView == null) {
                mView = view;

                // Schedule the first layout -before- adding to the window
                // manager, to make sure we do the relayout before receiving
                // any other events from the system.
                requestLayout();
            }
        }
    }

    @Override
    public void requestLayout() {
        if (!mHandlingLayoutInLayoutRequest) {
            checkThread();
            mLayoutRequested = true;
            scheduleTraversals();
        }
    }

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

    final class TraversalRunnable implements Runnable {
        @Override
        public void run() {
            doTraversal();
        }
    }

    final TraversalRunnable mTraversalRunnable = new TraversalRunnable();

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
```

注意`mChoreographer.postCallback(Choreographer.CALLBACK_TRAVERSAL, mTraversalRunnable, null);`这个地方，这个意思是在下一帧的时候执行`mTraversalRunnable`这个`Runnable`,它最终使用的是`Handler`。

```java
// Choreographer.java

    private void scheduleFrameLocked(long now) {
        if (!mFrameScheduled) {
            mFrameScheduled = true;
            if (USE_VSYNC) {
                if (DEBUG_FRAMES) {
                    Log.d(TAG, "Scheduling next frame on vsync.");
                }

                // If running on the Looper thread, then schedule the vsync immediately,
                // otherwise post a message to schedule the vsync from the UI thread
                // as soon as possible.
                if (isRunningOnLooperThreadLocked()) {
                    scheduleVsyncLocked();
                } else {
                    Message msg = mHandler.obtainMessage(MSG_DO_SCHEDULE_VSYNC);
                    msg.setAsynchronous(true);
                    mHandler.sendMessageAtFrontOfQueue(msg);
                }
            } else {
                final long nextFrameTime = Math.max(
                        mLastFrameTimeNanos / TimeUtils.NANOS_PER_MS + sFrameDelay, now);
                if (DEBUG_FRAMES) {
                    Log.d(TAG, "Scheduling next frame in " + (nextFrameTime - now) + " ms.");
                }
                Message msg = mHandler.obtainMessage(MSG_DO_FRAME);
                msg.setAsynchronous(true);
                mHandler.sendMessageAtTime(msg, nextFrameTime);
            }
        }
    }
```

我们追踪到`performTraversals`这个方法，这个方法很长，这个方法中包含几个重要的部分，我这里摘取出来：

```java
// ViewRootImpl.java

    private void performTraversals() {
        ...

        host.dispatchAttachedToWindow(mAttachInfo, 0);

        ...

        // Ask host how big it wants to be
        windowSizeMayChange |= measureHierarchy(host, lp, res, desiredWindowWidth, desiredWindowHeight);

        ...

        performLayout(lp, mWidth, mHeight);

        ...

        if (triggerGlobalLayoutListener) {
            mAttachInfo.mRecomputeGlobalAttributes = false;
            mAttachInfo.mTreeObserver.dispatchOnGlobalLayout();
        }

        ..


        performDraw();
    }   
```

上面这个方法包含Measure, Layout, Draw整个过程。

##### Measure

ViewRootImpl#measureHierarchy() => ViewRootImpl#performMeasure() => DecorView#measure() => DecorView#onMeasure()

##### Layout

ViewRootImpl#performLayout() => DecorView#layout() => DecorView#onLayout()

##### Draw

ViewRootImpl#performDraw() =>  ViewRootImpl#draw() => ViewRootImpl#drawSoftware() => DecorView#draw() => DecorView#onDraw()

从`ViewRootImpl`的`performTraversals`这个方法我们也可以解释第二个问题。

#### 为什么在`Activity#onCreate`中使用`View#post`可以获取到宽高？

我们先看一下`View#post`的源码：

```java
// View.java

    public boolean post(Runnable action) {
        final AttachInfo attachInfo = mAttachInfo;
        if (attachInfo != null) {
            return attachInfo.mHandler.post(action);
        }

        // Postpone the runnable until we know on which thread it needs to run.
        // Assume that the runnable will be successfully placed after attach.
        getRunQueue().post(action);
        return true;
    }

    private HandlerActionQueue getRunQueue() {
        if (mRunQueue == null) {
            mRunQueue = new HandlerActionQueue();
        }
        return mRunQueue;
    }
```

执行`Runnable`有两种方式，第一种使用`mAttachInfo`，第二种使用`mRunQueue`，那`mAttachInfo`什么时候被赋值呢？，`mRunQueue`什么时候被调用呢？
答案在`View`的`dispatchAttachedToWindow()`方法中。这个方法在`ViewRootImpl`的`performTraversals()`中被调用，`mAttachInfo`和`mRunQueue`使用了`ViewRootHandler`去发送消息，**当这个消息被分发的时候，`performTraversals`已经执行完成，这也意味这DecoreView Tree已经完成Measure**,所以此时可以获取到View的宽高。

```java
// View.java

    void dispatchAttachedToWindow(AttachInfo info, int visibility) {
        mAttachInfo = info;
        
        ...

        // Transfer all pending runnables.
        if (mRunQueue != null) {
            mRunQueue.executeActions(info.mHandler);
            mRunQueue = null;
        }
        
        ...
    }
```

#### 为什么在`Activity#onCreate`中使用`View#viewTreeObserver`可以获取到宽高？

同样的方法，查看源码：

```java
// View.java

    public ViewTreeObserver getViewTreeObserver() {
        if (mAttachInfo != null) {
            return mAttachInfo.mTreeObserver;
        }
        if (mFloatingTreeObserver == null) {
            mFloatingTreeObserver = new ViewTreeObserver(mContext);
        }
        return mFloatingTreeObserver;
    }

    public void addOnGlobalLayoutListener(OnGlobalLayoutListener listener) {
        checkIsAlive();

        if (mOnGlobalLayoutListeners == null) {
            mOnGlobalLayoutListeners = new CopyOnWriteArray<OnGlobalLayoutListener>();
        }

        mOnGlobalLayoutListeners.add(listener);
    }

    void dispatchAttachedToWindow(AttachInfo info, int visibility) {
        mAttachInfo = info;
        
        ...

        if (mFloatingTreeObserver != null) {
            info.mTreeObserver.merge(mFloatingTreeObserver);
            mFloatingTreeObserver = null;
        }

        ...
    }
```

当View被attach到Window的时候，`mFloatingTreeObserver`会被merge进`AttachInfo`的`mTreeObserver`中，那`AttachInfo`的`mTreeObserver`什么时候被调用呢？答案在`ViewRootImpl`的`performTraversals()`,可以退回上面看这个方法，在执行完Measure和Layout之后就调用`AttachInfo#mTreeObserver`的`dispatchOnGlobalLayout`方法。因为此时已经完成了Measure,所以可以获取到View的宽高。

```java
// ViewTreeObserver.java

    public final void dispatchOnGlobalLayout() {
        // NOTE: because of the use of CopyOnWriteArrayList, we *must* use an iterator to
        // perform the dispatching. The iterator is a safe guard against listeners that
        // could mutate the list by calling the various add/remove methods. This prevents
        // the array from being modified while we iterate it.
        final CopyOnWriteArray<OnGlobalLayoutListener> listeners = mOnGlobalLayoutListeners;
        if (listeners != null && listeners.size() > 0) {
            CopyOnWriteArray.Access<OnGlobalLayoutListener> access = listeners.start();
            try {
                int count = access.size();
                for (int i = 0; i < count; i++) {
                    access.get(i).onGlobalLayout();
                }
            } finally {
                listeners.end();
            }
        }
    }
```
