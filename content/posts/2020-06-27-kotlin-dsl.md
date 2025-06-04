+++
authors = ["Lenox"]
title = "Kotlin DSL"
date = "2020-06-27"
description = ""
tags = [
    "DSL",
]
categories = [
    "Kotlin",
]
series = []
disableComments = true
draft = false
+++

> 相信每个使用过*Gradle*的人或多或少喜欢上了这种简洁易懂的DSL语法。起初这都得益于*Groovy DSL*这门动态脚本语言，但随着Kotlin的兴起，其优秀的语法糖也让其支持DSL，现在*Gradle*也支持*Kotlin DSL*，而且相比*Groovy DSL*，IDE也对其更加友好，如代码高亮，智能提示等，现在Google Android Team的Gradle Plugin 也慢慢从*Groovy* 切换到 *Kotlin*。现在*Kotlin DSL* 已经广泛的应用到各个方面，如*Android*, *Gradle*等。

#### 没有Kotlin DSL的Android世界

```kotlin
application.registerActivityLifecycleCallbacks(object : Application.ActivityLifecycleCallbacks {  
  
    override fun onActivityPaused(p0: Activity) {  
    }  
  
    override fun onActivityStarted(p0: Activity) {  
    }  
  
    override fun onActivityDestroyed(p0: Activity) {  
    }  
  
    override fun onActivitySaveInstanceState(p0: Activity, p1: Bundle) {  
    }  
  
    override fun onActivityStopped(p0: Activity) {  
    }  
  
    override fun onActivityCreated(p0: Activity, p1: Bundle?) {  
    }  
  
    override fun onActivityResumed(p0: Activity) {  
    }  
  
})
```

相信从事过Android开发的人都很清楚上面的代码的意思：它注册了一个监听全局`Activity`生命周期的回调接口，当然，它的回调接口需要包含`Activity`全部生命周期回调方法。
但是有时候我们并不需要`override`生命周期中的全部方法，我们可能只需要监听`Activity`的创建和销毁，其他不关心，那其实我们只需要`override` `fun onActivityCreated(p0: Activity, p1: Bundle?)` 和`fun onActivityDestroyed(p0: Activity)`，但是由于`ActivityLifecycleCallbacks`是一个`interface`，首先于语法，我们必须`override`所有，即使我们不需要，这对于一个有代码洁癖的人，看到这么多没有内容的空方法是不能接受的，标记为很丑陋的代码。
这只是Android中的其中之一，向类似这种情况在Android有很多，比如说`TextWatcher`，有时候可以在SDK中发现一些抽象类实现了这类接口，然后重写所有抽象方法，然后将其命名为`Default*`，这也是一种方式，但并不优雅。

#### 优化1：使用接口动态代理 + Delegation

```kotlin
import java.lang.reflect.InvocationHandler
import java.lang.reflect.Proxy

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        object : Application.ActivityLifecycleCallbacks by noOpDelegate() {
            override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
            }

            override fun onActivityDestroyed(activity: Activity) {
            }
        }

        object : TextWatcher by noOpDelegate() {
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
            }
        }
    }

    companion object {
        // https://github.com/square/leakcanary/blob/main/leakcanary-android-utils/src/main/java/leakcanary/internal/Objects.kt
        inline fun <reified T : Any> noOpDelegate(): T {
            val javaClass = T::class.java
            return Proxy.newProxyInstance(
                javaClass.classLoader, arrayOf(javaClass), NO_OP_HANDLER
            ) as T
        }

        val NO_OP_HANDLER = InvocationHandler { _, _, _ ->
            // no op
        }
    }
}
```

#### 优化2：使用DSL

```kotlin
application.registerActivityLifecycleCallbacksDsl {  
  
  onActivityCreated { activity, bundle ->    
  }
  
  onActivityDestroyed { activity ->  
  }
 }
```

这样我们只需要在DSL块中调用我们需要的方法，而不用重写所有，这是我们所期望的。

#### 如何实现？

*Kotlin DSL* 主要借助Kotlin中的高阶函数（ Higher-Order Function ）实现，当然`infix`也大量运用于*Kotlin DSL*中。
首先我们创建一个*DSL 接口*，里面包含所有我们在DSL代码块中可以调用的函数，这里只定义一部分作为演示。

```kotlin
interface ActivityLifecycleCallbacksDsl {  
    fun onActivityCreated(a: (Activity, Bundle?) -> Unit)  
    fun onActivityDestroyed(a: (Activity) -> Unit)  
}
```

然后，创建这个接口的实现类：

```kotlin
class ActivityLifecycleCallbacksDslImpl : ActivityLifecycleCallbacksDsl {  
    private var onActivityCreatedImpl: ((Activity, Bundle?) -> Unit)? = null  
    private var onActivityDestroyedImpl: ((Activity) -> Unit)? = null  
  
    override fun onActivityCreated(a: (Activity, Bundle?) -> Unit) {  
        onActivityCreatedImpl = a  
    }  
  
    override fun onActivityDestroyed(a: (Activity) -> Unit) {  
        onActivityDestroyedImpl = a  
    }  
  
    fun create(application: Application) {  
        application.registerActivityLifecycleCallbacks(object :  
            Application.ActivityLifecycleCallbacks {  
  
            override fun onActivityPaused(p0: Activity) {  
            }  
  
            override fun onActivityStarted(p0: Activity) {  
            }  
  
            override fun onActivityDestroyed(p0: Activity) {  
                onActivityDestroyedImpl?.invoke(p0)  
            }  
  
            override fun onActivitySaveInstanceState(p0: Activity, p1: Bundle) {  
            }  
  
            override fun onActivityStopped(p0: Activity) {  
            }  
  
            override fun onActivityCreated(p0: Activity, p1: Bundle?) {  
                onActivityCreatedImpl?.invoke(p0, p1)  
            }  
  
            override fun onActivityResumed(p0: Activity) {  
            }  
  
        })  
    }  
}
```

最后，我们创建一个`Application`的拓展方法：

```kotlin
fun Application.registerActivityLifecycleCallbacksDsl(dsl: ActivityLifecycleCallbacksDsl.() -> Unit) {  
    ActivityLifecycleCallbacksDslImpl().apply(dsl).create(this)  
}
```

#### DslMarker

我们使用Jake Wharton的 [picnic](https://github.com/JakeWharton/picnic)来说明DSL中的一个至关重要的点。
当我们使用[picnic](https://github.com/JakeWharton/picnic)创建一个包含header 和 footer的表格时，代码如下所示：

```kotlin
table {
  header {
    // Rows in a header always come first no matter when they're added.
    row("Hello", "Header")
  }
  footer {
    // Rows in a footer always come last no matter when they're added.
    row("Hello", "Footer")
  }
  row("Hello", "World")
  cellStyle {
    border = true
  }
}
```

按照逻辑，header的DSL块中不应该包含footer，比如说（下面代码是个错误示范）：

```kotlin
table {
  header {
    // Rows in a header always come first no matter when they're added.
    row("Hello", "Header")
     // this is error
    footer {
      // Rows in a footer always come last no matter when they're added.
      row("Hello", "Footer")
    }
  }
  footer {
    // Rows in a footer always come last no matter when they're added.
    row("Hello", "Footer")
  }
  row("Hello", "World")
  cellStyle {
    border = true
  }
}
```

当我们按如上代码编写的时候，编译器会报出一个错误：*'fun footer(content: TableSectionDsl.() -> Unit): Unit' can't be called in this context by implicit receiver. Use the explicit one if necessary*。这意味这某个DSL块中的方法只能受限于当前上下文下调用，这就是`DslMarker`这个注解的作用。

```kotlin
@DslMarker  
private annotation class PicnicDsl  
  
fun table(content: TableDsl.() -> Unit) = TableDslImpl().apply(content).create()  
  
@PicnicDsl  
interface TableDsl : TableSectionDsl {  
  fun header(content: TableSectionDsl.() -> Unit)  
  fun body(content: TableSectionDsl.() -> Unit)  
  fun footer(content: TableSectionDsl.() -> Unit)  
  fun style(content: TableStyleDsl.() -> Unit)  
}  
  
@PicnicDsl  
interface TableStyleDsl {  
  var border: Boolean?  
  var borderStyle: BorderStyle?  
}
```
