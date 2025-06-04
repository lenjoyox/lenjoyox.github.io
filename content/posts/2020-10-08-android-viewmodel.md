+++
authors = ["Lenox"]
title = "Android ViewModel"
date = "2020-10-08"
description = ""
tags = []
categories = [
    "Android",
]
series = []
disableComments = true
draft = false
+++

#### androidx.activity.ComponentActivity

设计架构：

```txt
+-----------------------------------------------------------------------------------------------------+
|androidx.activity.ComponentActivity(or Derived Class)                                                |
|                                                          onResume(new instance)                     |
|                                                              ^                                      |
|                                                              |                                      |
|              getViewModelStore()                         onStart(new instance)->getViewModelStore() |
|                     ^                                        ^                                      |
|                     |                                        |                                      |
|    +-------------------------------------------+         onCreate(new instance)->getViewModelStore()|    
|    |    androidx.lifecycle.ViewModelStore      |             ^                                      |
|    | (Single instance & Lazy initialization)   |             |                                      |
|    |     --------------------------------      |         onDestroy                                  |
|    |    |androidx.lifecycle.ViewModel - 1|     |             ^                                      |
|    |    |androidx.lifecycle.ViewModel - 2|     |             |                                      |
|    |    |androidx.lifecycle.ViewModel - 3|     |             |                                      |
|    |    |...                             |     |------>onRetainNonConfigurationInstance()           |   
|    |    |androidx.lifecycle.ViewModel - N|     |             ^                                      |
|    |     --------------------------------      |             |                                      |
|    |                                           |             |                                      |
|    |  clear: 1. Call clear() of each ViewModel.|           onStop                                   |
|    |   ^     2. Clear all viewModels           |             ^                                      |
|    +---|---------------------------------------+             |                                      |
|        |                                                     |                                      |
|        |                                                  onPause(due to configuration changed)     |
|        |                                                                                            |
|     onDestroy <---onStop <--- onPause(activity is done and should be closed.)                       |
+-----------------------------------------------------------------------------------------------------+
```

上面这张架构图描述了`androidx.activity.ComponentActivity`, `androidx.lifecycle.ViewModelStore` 和 `androidx.lifecycle.ViewModel`之间的关系：每个`androidx.activity.ComponentActivity`的派生Activity都会持有**1个**`androidx.lifecycle.ViewModelStore`，只不过`androidx.lifecycle.ViewModelStore`直到`getViewModelStore()`调用时才会惰性创建1次（需要注意的是，创建这个`androidx.lifecycle.ViewModelStore`的前提有两个：当前Activity对象持有的`mViewModelStore`为`null`；如果当前Activity对象是由于配置改变（如旋转）重新创建的，而`getViewModelStore()`并没有在*onCreate*或*onStart*时调用，则获取不到上次存储的`androidx.lifecycle.ViewModelStore`实例），这个`androidx.lifecycle.ViewModelStore`中会存储所有在这个派生Activity里创建的`androidx.lifecycle.ViewModel`。当当前Activity正常需要销毁的时候，会调用`androidx.lifecycle.ViewModelStore`的`clear`方法：先去调用所有的`androidx.lifecycle.ViewModel`的`clear`方法以通知当前`ViewModelStoreOwner`（`androidx.activity.ComponentActivity`/`androidx.fragment.app.Fragment`）需要销毁了，然后在清除调所有的`androidx.lifecycle.ViewModel`。

```java
//androidx.activity.ComponentActivity.java

package androidx.activity;

public class ComponentActivity extends androidx.core.app.ComponentActivity implements
        LifecycleOwner,
        ViewModelStoreOwner,
        HasDefaultViewModelProviderFactory,
        SavedStateRegistryOwner,
        OnBackPressedDispatcherOwner {

    static final class NonConfigurationInstances {
        Object custom;
        ViewModelStore viewModelStore;
    }

    // Lazily recreated from NonConfigurationInstances by getViewModelStore()
    private ViewModelStore mViewModelStore;

    /**
     * Default constructor for ComponentActivity. All Activities must have a default constructor
     * for API 27 and lower devices or when using the default
     * {@link android.app.AppComponentFactory}.
     */
    public ComponentActivity() {
        getLifecycle().addObserver(new LifecycleEventObserver() {
            @Override
            public void onStateChanged(@NonNull LifecycleOwner source,
                    @NonNull Lifecycle.Event event) {
                if (event == Lifecycle.Event.ON_DESTROY) {
                    if (!isChangingConfigurations()) {
                        getViewModelStore().clear();
                    }
                }
            }
        });
    }

    /**
     * Retain all appropriate non-config state.  You can NOT
     * override this yourself!  Use a {@link androidx.lifecycle.ViewModel} if you want to
     * retain your own non config state.
     */
    @Override
    @Nullable
    public final Object onRetainNonConfigurationInstance() {
        Object custom = onRetainCustomNonConfigurationInstance();

        ViewModelStore viewModelStore = mViewModelStore;
        if (viewModelStore == null) {
            // No one called getViewModelStore(), so see if there was an existing
            // ViewModelStore from our last NonConfigurationInstance
            NonConfigurationInstances nc =
                    (NonConfigurationInstances) getLastNonConfigurationInstance();
            if (nc != null) {
                viewModelStore = nc.viewModelStore;
            }
        }

        if (viewModelStore == null && custom == null) {
            return null;
        }

        NonConfigurationInstances nci = new NonConfigurationInstances();
        nci.custom = custom;
        nci.viewModelStore = viewModelStore;
        return nci;
    }

    /**
     * Returns the {@link ViewModelStore} associated with this activity
     * <p>
     * Overriding this method is no longer supported and this method will be made
     * <code>final</code> in a future version of ComponentActivity.
     *
     * @return a {@code ViewModelStore}
     * @throws IllegalStateException if called before the Activity is attached to the Application
     * instance i.e., before onCreate()
     */
    @NonNull
    @Override
    public ViewModelStore getViewModelStore() {
        if (getApplication() == null) {
            throw new IllegalStateException("Your activity is not yet attached to the "
                    + "Application instance. You can't request ViewModel before onCreate call.");
        }
        if (mViewModelStore == null) {
            NonConfigurationInstances nc =
                    (NonConfigurationInstances) getLastNonConfigurationInstance();
            if (nc != null) {
                // Restore the ViewModelStore from NonConfigurationInstances
                mViewModelStore = nc.viewModelStore;
            }
            if (mViewModelStore == null) {
                mViewModelStore = new ViewModelStore();
            }
        }
        return mViewModelStore;
    }
}
```

综上所述，下面列出几个的关键点：

- 当你的Activity是`androidx.activity.ComponentActivity`的派生类，如果需要存储一些将由配置改变（比如旋转）而丢失的昂贵数据，推荐使用   `androidx.lifecycle.ViewModel`。这是因为`androidx.activity.ComponentActivity`重写了`onRetainNonConfigurationInstance()`这个方法并添加了`final`修饰符，所以不允许其派生类继续重写。当然你也可以使用`onRetainCustomNonConfigurationInstance`和`getLastCustomNonConfigurationInstance`这两个方法实现，但这两个方法都已经废弃，所以不推荐使用。
- `getViewModelStore()`不能在`onCreate()`生命周期之前调用。
- 如果当前Activity实例是由于配置变更（比如旋转）重新创建的，`getViewModelStore()`的调用除了不能在`onCreate()`生命周期之前调用，还不能在`onStart`之后调用，即只能在`onCreate`和`onStart`这两个生命周期中调用。
- 如果当前Activity实例由于配置变更（比如旋转）执行销毁流程，当销毁的时候，不移除所有存储的`androidx.lifecycle.ViewModel`。
- 如果当前Activity实例正常执行销毁流程，当销毁的时候，会调用所有`androidx.lifecycle.ViewModel`的`clear`方法，然后在`androidx.lifecycle.ViewModel`的内部调用`onCleared`方法，这样我们就可以在我们自定义的`androidx.lifecycle.ViewModel`的`onCleared`方法中执行资源释放，网络请求取消等操作。

#### androidx.fragment.app.Fragment

设计架构：

```txt
+-----------------------------------------------------------------------------------------------------+
                 |androidx.fragment.app.Fragment(or Derived Class)|                                   |
                 +------------------------------------------------+                                   |
                                                                                                      |
    getViewModelStore()
            ^
            |
    +-------|-----------------------------------------------------------------------------------+
            |    |androidx.fragment.app.FragmentManager|                                        |
            |    +-------------------------------------+                                        |
            |                                                                                   |
    getViewModelStore(androidx.fragment.app.Fragment)
            ^
            |
    +-------|--------------------------------------------------------------------------------+
            |    |androidx.fragment.app.FragmentManagerViewModel|                            |
            |    +----------------------------------------------+                            |
            |                                                                                |
    getViewModelStore(androidx.fragment.app.Fragment)  
            ^
            |
        +---------------------------------------------------------------------------------+
        |         |mViewModelStores(HashMap<String, androidx.lifecycle.ViewModelStore>)|  |
        |         +--------------------------------------------------------------------+  |
        |                                                                                 |
        |  androidx.fragment.app.Fragment@1 => androidx.lifecycle.ViewModelStore@1        |
        |  androidx.fragment.app.Fragment@2 => androidx.lifecycle.ViewModelStore@2        |
        |  androidx.fragment.app.Fragment@3 => androidx.lifecycle.ViewModelStore@3        |
        |  ...                                                                            |
        |  androidx.fragment.app.Fragment@N => androidx.lifecycle.ViewModelStore@N        |
        |                                                                                 |
        +---------------------------------------------------------------------------------+
```

在梳理`androidx.lifecycle.ViewModel`在`androidx.fragment.app.Fragment`中的设计流程之前，我们需要先了解一些`FragmentManager`的知识：当我们创建了一个直接/间接继承自`androidx.fragment.app.FragmentActivity`的Activity并交给系统，然后系统开始**实例化**这个Activity的时候，同时也会初始化了一个`FragmentManager`（只不过这个`FragmentManager`被`androidx.fragment.app.FragmentHostCallback`直接持有，而`androidx.fragment.app.FragmentController`又直接持有`androidx.fragment.app.FragmentHostCallback`, `androidx.fragment.app.FragmentController`又被`androidx.fragment.app.FragmentActivity`直接持有），所以直接在这个Activity中通过事务提交的Fragments都由这个`FragmentManager`直接管理，并且这些Fragment中持有的`mFragmentManager`也是这个`FragmentManager`。而在这些Fragment中创建的子Fragment由它的创建者Fragment（父Fragment）的`mChildFragmentManager`(在父Fragment实例化的时候初始化)负责管理。

![img](/images/2020-10-08-android-viewmodel-fragment-fragmentmanager.png)

每个`FragmentManager`持有一个`androidx.fragment.app.FragmentManagerViewModel`,由它负责管理这些Fragments（由这个`FragmentManager`直接管理）中使用的`androidx.lifecycle.ViewModelStore`。

我们在Fragment中获取到的ViewModelStore来自于**androidx.fragment.app.FragmentManagerViewModel**，这是一个`ViewModel`，它内部维护了一个K-V容器用来存储每个Fragment对应的ViewModelStore。那这个`FragmentManagerViewModel`是怎么创建的呢？

```java
// androidx.fragment.app.FragmentManager.java

package androidx.fragment.app;

public abstract class FragmentManager {

    private FragmentManagerViewModel mNonConfig;
    
    void attachController(@NonNull FragmentHostCallback<?> host,
            @NonNull FragmentContainer container, @Nullable final Fragment parent) {
        ...

        // Get the FragmentManagerViewModel
        if (parent != null) {
            mNonConfig = parent.mFragmentManager.getChildNonConfig(parent);
        } else if (host instanceof ViewModelStoreOwner) {
            ViewModelStore viewModelStore = ((ViewModelStoreOwner) host).getViewModelStore();
            mNonConfig = FragmentManagerViewModel.getInstance(viewModelStore);
        } else {
            mNonConfig = new FragmentManagerViewModel(false);
        }
    }

    @NonNull
    private FragmentManagerViewModel getChildNonConfig(@NonNull Fragment f) {
        return mNonConfig.getChildNonConfig(f);
    }
}
```

创建`FragmentManagerViewModel`有三种情况：

 1. 第一种情况：

    ```java
    ViewModelStore viewModelStore = ((ViewModelStoreOwner) host).getViewModelStore();
    mNonConfig = FragmentManagerViewModel.getInstance(viewModelStore);
    ```

    这种情况发生在`androidx.fragment.app.FragmentActivity`执行到生命周期*onCreate*的时候，此时`host`会attach到`FragmentManager`，这样之后才可以用这个`FragmentManager`管理Fragments。由上述代码可知，`ViewModelStore`来自于`host`，这个`host`实现了`ViewModelStoreOwner`这个接口以提供`ViewModelStore`，然后我们通过将新创建的`FragmentManagerViewModel`存储到这个`ViewModelStore`中。

    ```java
    // androidx.fragment.app.FragmentManagerViewModel.java

    package androidx.fragment.app;

    final class FragmentManagerViewModel extends ViewModel { 
        private static final ViewModelProvider.Factory FACTORY = new ViewModelProvider.Factory() {
            @NonNull
            @Override
            @SuppressWarnings("unchecked")
            public <T extends ViewModel> T create(@NonNull Class<T> modelClass) {
                FragmentManagerViewModel viewModel = new FragmentManagerViewModel(true);
                return (T) viewModel;
            }
        }

        @NonNull
        static FragmentManagerViewModel getInstance(ViewModelStore viewModelStore) {
            ViewModelProvider viewModelProvider = new ViewModelProvider(viewModelStore,
                    FACTORY);
            return viewModelProvider.get(FragmentManagerViewModel.class);
        }
    }
    ```

    现在我们只要知道`host`在哪，我们就知道`FragmentManagerViewModel`存储在哪：

    ```java
    // androidx.fragment.app.FragmentActivity.java

    package androidx.fragment.app;

    public class FragmentActivity extends ComponentActivity implements
            ActivityCompat.OnRequestPermissionsResultCallback,
            ActivityCompat.RequestPermissionsRequestCodeValidator {

        final FragmentController mFragments = FragmentController.createController(new HostCallbacks());

        class HostCallbacks extends FragmentHostCallback<FragmentActivity> implements
                ViewModelStoreOwner,
                OnBackPressedDispatcherOwner {
            public HostCallbacks() {
                super(FragmentActivity.this /*fragmentActivity*/);
            }

            @NonNull
            @Override
            public ViewModelStore getViewModelStore() {
                return FragmentActivity.this.getViewModelStore();
            }
        }
    }
    ```

    很清楚了，`FragmentActivity`继承自`ComponentActivity`，所以`FragmentManagerViewModel`存储在这个Fragment的宿主Activity中。

 2. 第二种情况

    ```java
    mNonConfig = parent.mFragmentManager.getChildNonConfig(parent);
    ```

    我们知道，一个Fragment包含两个`FragmentManager`：`mFragmentManager`和`mChildFragmentManager`，后者就是用来管理在这个Fragment中创建的所有子Fragment，当这个Fragment attach到`host`的时候，`mChildFragmentManager`会在父Fragment关联的`FragmentManagerViewModel`中的`mChildNonConfigs`创建一个新的`FragmentManagerViewModel`（key:父Fragment）供这个`mChildFragmentManager`所管理的所有Fragments使用。

    ```java
    // androidx.fragment.app.Fragment

    package androidx.fragment.app;

    public class Fragment implements ComponentCallbacks, OnCreateContextMenuListener, LifecycleOwner,
        ViewModelStoreOwner, HasDefaultViewModelProviderFactory, SavedStateRegistryOwner {

        void performAttach() {
            mChildFragmentManager.attachController(mHost, new FragmentContainer() {
                @Override
                @Nullable
                public View onFindViewById(int id) {
                    if (mView == null) {
                        throw new IllegalStateException("Fragment " + this + " does not have a view");
                    }
                    return mView.findViewById(id);
                }

                @Override
                public boolean onHasView() {
                    return (mView != null);
                }
            }, this);
            mState = ATTACHED;
            mCalled = false;
            onAttach(mHost.getContext());
            if (!mCalled) {
                throw new SuperNotCalledException("Fragment " + this
                        + " did not call through to super.onAttach()");
            }
        }
    }
    ```

    这样意味这我们可以在`androidx.fragment.app.FragmentActivity`的`ViewModelStore`里存储的`FragmentManagerViewModel`通过`mChildNonConfigs`和`mViewModelStores`直接或间接获取到附加到这个Activity上所有的Fragment和子Fragment的`ViewModel`。

    ![img](/images/2020-10-08-android-viewmodel-fragmentmanagerviewmodel.png)

 3. 第三种情况

    ```java
    mNonConfig = new FragmentManagerViewModel(false);
    ```

    这种已经废弃，可以不用考虑。

#### androidx.lifecycle.ViewModel

我们平时所使用的`ViewModel`都需要继承这个类，这个类设计的很简单，对于我们来说有用的方法只有一个：`onCleared`，要注意这个方法很重要，当我们的`ViewModel`需要被移除的时候，会调用这个方法，所以我们可以在这个方法对正在观察的数据去取消订阅，关闭正在加载的资源等。

`ViewModel`禁止持有一些如View/Activity/Fragment这些引用，想象一下旋转一个Activity的时候，如果ViewModel持有这个Activity的引用，导致这个Activity在需要被销毁的时候由于ViewModel的引用而导致无法被销毁，导致Activity内存泄漏。

`ViewModel`的存在也简化了`Fragment`与`Fragment`之间的通信：我们只需要定义一个用于Fragment之间共享的ViewModel，然后将它存储在这些Fragment的宿主Activity的ViewModelStore中，然后这些Fragment就都可以获取到这个Fragment，然后相互通信，不需要定义交互接口，不要在宿主Activity中处理过多的逻辑。

`ViewModel`也是官方推荐替换onRetainNonConfigurationInstance去保留所有适当的非配置状态（non-config state）的方法。
