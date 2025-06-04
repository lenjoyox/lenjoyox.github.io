+++
authors = ["Lenox"]
title = "IPC"
date = "2020-10-21"
description = ""
tags = [
    "AIDL",
    "Messenger",
    "Binder"
]
categories = [
    "Android",
]
series = []
disableComments = true
draft = false
+++

在Android中可以通过两种方式实现进程间通信，一种是使用 `Messenger`，另一种是使用 **AIDL**，当然这两种方式都是基于 **Binder**，不同之处在于`Messenger`使用 `Handler`进行线程安全的消息处理，所以不需要在Service端处理多线程(multithreading)，所以AIDL是 **并发IPC(concurrent IPC)**。

#### AIDL

- 支持AIDL文件中所有的代码注释（除了 `import` 或 `package` 语句之前的注释）

 ```java
 // AIDLService.aidl
package cn.nikeo.app;

// The comment before import statement.
import java.lang.String;
/**
 *  The comment before AIDLService.
 */
interface AIDLService {
    /**
     * Demonstrates some basic types that you can use as parameters
     * and return values in AIDL.
     */
    void basicTypes(int anInt, long aLong, boolean aBoolean, float aFloat,
            double aDouble, String aString);

    /**
     * The comment before constants.
     */
    const int TYPE = 10;
}
 ```

Generated

```java
/*
 * This file is auto-generated.  DO NOT MODIFY.
 */
package cn.nikeo.app;
/**
 *  The comment before AIDLService.
 */
public interface AIDLService extends android.os.IInterface
{
  
  ...

  /**
       * The comment before constants.
       */
  public static final int TYPE = 10;
  /**
       * Demonstrates some basic types that you can use as parameters
       * and return values in AIDL.
       */
  public void basicTypes(int anInt, long aLong, boolean aBoolean, float aFloat, double aDouble, java.lang.String aString) throws android.os.RemoteException;
}

```

- 对于一些自定义的AIDL-generated接口类型或自定义的parcelable类型，如果要在其他AIDL文件中引用它，即使是同包下，也需要主动 `import` 该类型。

```java
// Runnable.aidl
package cn.nikeo.app;

interface Runnable {
    void run();
}
```

```java
// Rect.aidl
package cn.nikeo.app;

parcelable Rect {
    int left;
    int top;
    int right;
    int bottom;
}
```

```java
// AIDLService.aidl
package cn.nikeo.app;

import cn.nikeo.app.Runnable;
import cn.nikeo.app.Rect;

interface AIDLService {
    void stringType(String str);
    void runnableType(Runnable runnable);
    void rectType(inout Rect rect);
}
```

##### 支持的数据类型

- 除 `short` 之外的所有基本数据类型（`boolean`, `char`, `byte`, `int`, `long`, `float`, `double`）。

   方向标记：必须是 `in`，可以省略。

- `java.lang.String`。
  
   方向标记：必须是 `in`，可以省略。

- `java.lang.CharSequence`。
  
   方向标记：必须是 `in`，可以省略。

- AIDL-generated interfaces。

   方向标记：必须是 `in`，可以省略。

- `android.os.IBinder`。
  
   方向标记：必须是 `in`，可以省略。

- `android.os.Parcelable`的实现类（如 `android.os.Bundle`）。
  
   方向标记：必须是 `in`, `out` 或 `inout`，不可以省略。  

- `java.util.List`。支持指定泛型参数类型（如`List<String>`），接收端实际接受到的具体类型是 `java.util.ArrayList`。
  
   方向标记：必须是 `in`, `out` 或 `inout`，不可以省略。

- `java.util.Map`。不支持指定泛型参数类型（如`Map<String, String>`），接收端实际接受到的具体类型是 `java.util.HashMap`,推荐使用 `android.os.Bundle`。
  
   方向标记：必须是 `in`, `out` 或 `inout`，不可以省略。

- 数组类型（如 `int[]`, `String[]`）。
  
   方向标记：必须是 `in`, `out` 或 `inout`，不可以省略。

##### AIDL 接口方法

- 方法可以携带0个或多个方法参数，返回 `void` 或一个值。
- 可以定义 `java.lang.String` 或 `int` 类型的常量。

 ```java
    const int VERSION = 1;
    const String TAG = "TAG";
 ```

- Nullable的参数或返回值可以注解 `@nullable`。

 ```java
    @nullable
    String nullableType(@nullable String name);
 ```

##### C/S双向通信

###### AIDL协议文件

```java
// Messenger.aidl
package cn.nikeo.app;

interface Messenger {
    void message(int what, inout @nullable Bundle data);
}
```

```java
// Rect.aidl
package cn.nikeo.app;

parcelable Rect {
    int left;
    int top;
    int right;
    int bottom;
}
```

```java
// Service.aidl
package cn.nikeo.app;

import cn.nikeo.app.Messenger;
import cn.nikeo.app.Rect;

interface Service {
    void replyTo(Messenger clientMessenger);

    void saveRect(in Rect rect);
}
```

###### Client

```kotlin
package cn.nikeo.app

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Bundle
import android.os.IBinder
import androidx.appcompat.app.AppCompatActivity
import cn.nikeo.app.databinding.ActivityClientBinding
import kotlin.concurrent.thread

class Client : AppCompatActivity() {

    private var service: Service? = null

    private val incomingMessageFromServer = object : Messenger.Stub() {
        override fun message(what: Int, data: Bundle?) {
            ipcLog("Client", "Receive a message( what: $what ) from the server.")
        }
    }

    private val conn: ServiceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName, binder: IBinder) {
            service = Service.Stub.asInterface(binder).apply {
                replyTo(incomingMessageFromServer)
            }
            bound = true
        }

        override fun onServiceDisconnected(name: ComponentName) {
            service = null
            bound = false
        }
    }

    private var bound = false

    private lateinit var binding: ActivityClientBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityClientBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.saveRect.setOnClickListener {
            for (i in 0..10) {
                thread {
                    val rect = Rect().apply {
                        left = i
                        top = i
                        right = 100
                        bottom = 100
                    }
                    ipcLog("Client", "Send a message( saveRect( Rect(left: ${rect.left}, top: ${rect.top}, right: ${rect.right}, bottom: ${rect.bottom}) ) ) from the client.")
                    service?.saveRect(rect)
                }
            }
        }
    }

    override fun onStart() {
        super.onStart()
        bindService(
            Intent(this, Server::class.java),
            conn,
            Context.BIND_AUTO_CREATE
        )
    }

    override fun onStop() {
        super.onStop()
        if (bound) {
            unbindService(conn)
            bound = false
        }
    }
}
```

###### Server

注意到在 `saveRect` 的方法中在写入SharedPreferences的时候添加了并发锁，防止多线程相关问题。

```kotlin
package cn.nikeo.app

import android.app.Service
import android.content.Intent
import android.os.IBinder
import androidx.core.content.edit
import java.util.concurrent.locks.ReentrantLock

class Server : Service() {

    override fun onBind(intent: Intent): IBinder {
        return binder
    }

    private val binder = object : cn.nikeo.app.Service.Stub() {
        private var clientMessenger: Messenger? = null
        override fun replyTo(clientMessenger: Messenger) {
            this.clientMessenger = clientMessenger
        }

        private val lock = ReentrantLock()

        override fun saveRect(rect: Rect) {
            lock.lock()
            ipcLog(
                "Server",
                "Receive a message( Rect(left: ${rect.left}, top: ${rect.top}, right: ${rect.right}, bottom: ${rect.bottom}) ) from the client. the number of threads in a blocked state: ${lock.queueLength}"
            )
            try {
                getSharedPreferences("Rect", MODE_PRIVATE).edit {
                    putInt("Left", rect.left)
                    putInt("Top", rect.top)
                    putInt("Right", rect.right)
                    putInt("Bottom", rect.bottom)
                }
                clientMessenger?.message(1, null)
            } finally {
                lock.unlock()
            }
        }
    }
}
 ```

###### AndroidManifest配置

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="cn.nikeo.app">

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.App">
        <service
            android:name=".Server"
            android:enabled="true"
            android:exported="false"
            android:process=":server" />
        <activity android:name=".Client">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />

                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

</manifest>
```

当我们在Client多线程发送11次 `saveRect` 命令的时候，监测Client端(cn.nikeo.app(7997))进程，打印如下：

```txt
2021-01-12 22:32:31.461 7997-8049/cn.nikeo.app I/IPC: "
                Client
                Process: 7997
                Thread:  Thread[Thread-6,5,main]
                
                Send a message( saveRect( Rect(left: 4, top: 4, right: 100, bottom: 100) ) ) from the client.
2021-01-12 22:32:31.461 7997-8055/cn.nikeo.app I/IPC: "
                Client
                Process: 7997
                Thread:  Thread[Thread-12,5,main]
                
                Send a message( saveRect( Rect(left: 10, top: 10, right: 100, bottom: 100) ) ) from the client.
2021-01-12 22:32:31.461 7997-8046/cn.nikeo.app I/IPC: "
                Client
                Process: 7997
                Thread:  Thread[Thread-3,5,main]
                
                Send a message( saveRect( Rect(left: 1, top: 1, right: 100, bottom: 100) ) ) from the client.
2021-01-12 22:32:31.462 7997-8048/cn.nikeo.app I/IPC: "
                Client
                Process: 7997
                Thread:  Thread[Thread-5,5,main]
                
                Send a message( saveRect( Rect(left: 3, top: 3, right: 100, bottom: 100) ) ) from the client.
2021-01-12 22:32:31.462 7997-8054/cn.nikeo.app I/IPC: "
                Client
                Process: 7997
                Thread:  Thread[Thread-11,5,main]
                
                Send a message( saveRect( Rect(left: 9, top: 9, right: 100, bottom: 100) ) ) from the client.
2021-01-12 22:32:31.462 7997-8045/cn.nikeo.app I/IPC: "
                Client
                Process: 7997
                Thread:  Thread[Thread-2,5,main]
                
                Send a message( saveRect( Rect(left: 0, top: 0, right: 100, bottom: 100) ) ) from the client.
2021-01-12 22:32:31.462 7997-8052/cn.nikeo.app I/IPC: "
                Client
                Process: 7997
                Thread:  Thread[Thread-9,5,main]
                
                Send a message( saveRect( Rect(left: 7, top: 7, right: 100, bottom: 100) ) ) from the client.
2021-01-12 22:32:31.463 7997-8047/cn.nikeo.app I/IPC: "
                Client
                Process: 7997
                Thread:  Thread[Thread-4,5,main]
                
                Send a message( saveRect( Rect(left: 2, top: 2, right: 100, bottom: 100) ) ) from the client.
2021-01-12 22:32:31.463 7997-8053/cn.nikeo.app I/IPC: "
                Client
                Process: 7997
                Thread:  Thread[Thread-10,5,main]
                
                Send a message( saveRect( Rect(left: 8, top: 8, right: 100, bottom: 100) ) ) from the client.
2021-01-12 22:32:31.463 7997-8051/cn.nikeo.app I/IPC: "
                Client
                Process: 7997
                Thread:  Thread[Thread-8,5,main]
                
                Send a message( saveRect( Rect(left: 6, top: 6, right: 100, bottom: 100) ) ) from the client.
2021-01-12 22:32:31.463 7997-8050/cn.nikeo.app I/IPC: "
                Client
                Process: 7997
                Thread:  Thread[Thread-7,5,main]
                
                Send a message( saveRect( Rect(left: 5, top: 5, right: 100, bottom: 100) ) ) from the client.
```

监测Server端(cn.nikeo.app:server(8022))进程，打印如下：

```txt
2021-01-12 22:32:32.284 8022-8042/cn.nikeo.app I/IPC: "
                Server
                Process: 8022
                Thread:  Thread[Binder:8022_1,5,main]
                
                Receive a message( Rect(left: 10, top: 10, right: 100, bottom: 100) ) from the client. the number of threads in a blocked state: 0
2021-01-12 22:32:32.401 8022-8057/cn.nikeo.app I/IPC: "
                Server
                Process: 8022
                Thread:  Thread[Binder:8022_3,5,main]
                
                Receive a message( Rect(left: 1, top: 1, right: 100, bottom: 100) ) from the client. the number of threads in a blocked state: 9
2021-01-12 22:32:32.485 8022-8058/cn.nikeo.app I/IPC: "
                Server
                Process: 8022
                Thread:  Thread[Binder:8022_4,5,main]
                
                Receive a message( Rect(left: 3, top: 3, right: 100, bottom: 100) ) from the client. the number of threads in a blocked state: 8
2021-01-12 22:32:32.654 8022-8059/cn.nikeo.app I/IPC: "
                Server
                Process: 8022
                Thread:  Thread[Binder:8022_5,5,main]
                
                Receive a message( Rect(left: 9, top: 9, right: 100, bottom: 100) ) from the client. the number of threads in a blocked state: 7
2021-01-12 22:32:32.657 8022-8060/cn.nikeo.app I/IPC: "
                Server
                Process: 8022
                Thread:  Thread[Binder:8022_6,5,main]
                
                Receive a message( Rect(left: 0, top: 0, right: 100, bottom: 100) ) from the client. the number of threads in a blocked state: 6
2021-01-12 22:32:32.660 8022-8061/cn.nikeo.app I/IPC: "
                Server
                Process: 8022
                Thread:  Thread[Binder:8022_7,5,main]
                
                Receive a message( Rect(left: 7, top: 7, right: 100, bottom: 100) ) from the client. the number of threads in a blocked state: 5
2021-01-12 22:32:32.662 8022-8062/cn.nikeo.app I/IPC: "
                Server
                Process: 8022
                Thread:  Thread[Binder:8022_8,5,main]
                
                Receive a message( Rect(left: 2, top: 2, right: 100, bottom: 100) ) from the client. the number of threads in a blocked state: 4
2021-01-12 22:32:32.664 8022-8063/cn.nikeo.app I/IPC: "
                Server
                Process: 8022
                Thread:  Thread[Binder:8022_9,5,main]
                
                Receive a message( Rect(left: 8, top: 8, right: 100, bottom: 100) ) from the client. the number of threads in a blocked state: 3
2021-01-12 22:32:32.666 8022-8064/cn.nikeo.app I/IPC: "
                Server
                Process: 8022
                Thread:  Thread[Binder:8022_A,5,main]
                
                Receive a message( Rect(left: 6, top: 6, right: 100, bottom: 100) ) from the client. the number of threads in a blocked state: 2
2021-01-12 22:32:32.668 8022-8065/cn.nikeo.app I/IPC: "
                Server
                Process: 8022
                Thread:  Thread[Binder:8022_B,5,main]
                
                Receive a message( Rect(left: 5, top: 5, right: 100, bottom: 100) ) from the client. the number of threads in a blocked state: 1
2021-01-12 22:32:32.670 8022-8043/cn.nikeo.app I/IPC: "
                Server
                Process: 8022
                Thread:  Thread[Binder:8022_2,5,main]
                
                Receive a message( Rect(left: 4, top: 4, right: 100, bottom: 100) ) from the client. the number of threads in a blocked state: 0
```

##### 通信原理（框架层）

从上面的 **C/S双向通信** 可以得到一个基本的通信流程：

```txt
 -----------                                                  -----------              
|Server Side|(Binder Thread)                                 |Client Side| (Any Thread)
 -----------                                                  -----------

Service.Stub(IBinder(Binder)) <------------------------------> Service.Stub.Proxy(IBinder(BinderProxy))
    |                                                               | Waiting for response
onTransact()                                                     transact() 
    |                                                               | Marshalle data
 saveRect()                                                      saveRect()
```

当Client进程与Server进程处于连接状态的时候，双端会拿到用于通信的 `IBinder`对象，这个对象描述了与远程对象通信的协议，Client拿到的实际上是一个 `BinderProxy`，而Server实际上是自定义的 `Service.Stub`，其实它是一个 `Binder`。

我们以 `saveRect` 为例，当Client发送消息的时候，实际使用的 `Service.Stub.Proxy` 发送，这个代理类持有一个用于通信的 `IBinder`（`BinderProxy`），当编组（Marshalling）完要发送的数据对象(`data`)和用于接受消息的回复对象后(`reply`)后，然后使用 `IBinder`（`BinderProxy`）通过transact()将这些数据发送给Server。这个 `BinderProxy` 是一个**native IBinder**的代理，他由 **native**管理，负责将编组的数据传输给底层。

```java
// android.os.BinderProxy.java

/**
 * Java proxy for a native IBinder object.
 * Allocated and constructed by the native javaObjectforIBinder function. Never allocated
 * directly from Java code.
 *
 * @hide
 */
public final class BinderProxy implements IBinder {
    
    public boolean transact(int code, Parcel data, Parcel reply, int flags) throws RemoteException {
        ...

        try {
            return transactNative(code, data, reply, flags);
        } finally {
            ...
        }
    }

    /**
     * Native implementation of transact() for proxies
     */
    public native boolean transactNative(int code, Parcel data, Parcel reply,
            int flags) throws RemoteException;
}
```

现在底层接受到了编组后数据，现在需要将这个数据发送给Server进程，这里不详细讨论Binder的底层IPC通信原理，这时候我们将目光转到Server端。

前面提到，相较于Client使用 `BinderProxy`作为具体的 `IBinder`，Server则使用 `Binder` 作为具体的 `IBinder`.当Server进程接收到来自Client进程的消息后，底层会调用该 `Binder`对象的 `execTransact` 方法：

```java
// android.os.Binder.java

public class Binder implements IBinder {
    ...

    // Entry point from android_util_Binder.cpp's onTransact
    @UnsupportedAppUsage
    private boolean execTransact(int code, long dataObj, long replyObj,
            int flags) {
        ...

        try {
            return execTransactInternal(code, dataObj, replyObj, flags, callingUid);
        } finally {
            ...
        }
    }

    private boolean execTransactInternal(int code, long dataObj, long replyObj, int flags,
            int callingUid) {
        ...
        Parcel data = Parcel.obtain(dataObj);
        Parcel reply = Parcel.obtain(replyObj);
        ...
        try {
            ...
            if ((flags & FLAG_COLLECT_NOTED_APP_OPS) != 0) {
                AppOpsManager.startNotedAppOpsCollection(callingUid);
                try {
                    res = onTransact(code, data, reply, flags);
                } finally {
                    AppOpsManager.finishNotedAppOpsCollection();
                }
            } else {
                res = onTransact(code, data, reply, flags);
            }
        } catch (RemoteException|RuntimeException e) {
            ...
        } finally {
            ...
        }
        checkParcel(this, code, reply, "Unreasonably large binder reply buffer");
        reply.recycle();
        data.recycle();
        ...
        return res;
    }
}
```

最终调用 `Binder`的 `onTransact`，而 `Service.Stub` 这个具体的 `Binder` 对 `onTransact`进行了 `override`，目的就是根据这个方法的第一个参数 `code`，将消息分派给对应的接受者去处理( `android.os.Parcel` -> `android.os.Parcelable`)。当处理完后，回复Client处理结果( `reply.writeNoException()` )。

需要特别注意的是，这一个完整的通信过程是 **同步** 完成的，这意味这只有Server处理完成后，Client的调用才会return，在return之前，调用处所在的线程一直处于阻塞状态，所以如果Client调用处是主线程，当Server端处理时间过长，会阻塞主线程，造成ANR。推荐在子线程进行IPC通信。

#### Messenger

理解了AIDL的整个通信流程后，`Messenger` 就跟容易理解了，它底层也是使用AIDL进行IPC通信，以下是[它使用的AIDL文件](// <https://android.googlesource.com/platform/frameworks/base/+/master/core/java/android/os/IMessenger.aidl)：>

```java
//android/os/IMessenger.aidl

**
** Copyright 2007, The Android Open Source Project
**
** Licensed under the Apache License, Version 2.0 (the "License"); 
** you may not use this file except in compliance with the License. 
** You may obtain a copy of the License at 
**
**     http://www.apache.org/licenses/LICENSE-2.0 
**
** Unless required by applicable law or agreed to in writing, software 
** distributed under the License is distributed on an "AS IS" BASIS, 
** WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. 
** See the License for the specific language governing permissions and 
** limitations under the License.
*/
package android.os;
import android.os.Message;
/** @hide */
oneway interface IMessenger {
    void send(in Message msg);
}
```

相较于原始的AIDL，它使用 `Handler` 来处理 **消息并发**，所以在 `Handler` 消息处理（`handleMessage`）处不需要进行并发编程，这是线程安全的。

Server所使用的 `IBinder`(`Binder`)来自于用于接收消息的 `Hander`:

```java
// android.os.Messenger.java

public final class Messenger implements Parcelable {
    private final IMessenger mTarget;

    /**
     * Create a new Messenger pointing to the given Handler.  Any Message
     * objects sent through this Messenger will appear in the Handler as if
     * {@link Handler#sendMessage(Message) Handler.sendMessage(Message)} had
     * been called directly.
     * 
     * @param target The Handler that will receive sent messages.
     */
    public Messenger(Handler target) {
        mTarget = target.getIMessenger();
    }

    /**
     * Retrieve the IBinder that this Messenger is using to communicate with
     * its associated Handler.
     * 
     * @return Returns the IBinder backing this Messenger.
     */
    public IBinder getBinder() {
        return mTarget.asBinder();
    }
}    
```

我们从AIDL的解析可以知道这个对象其实是 `IMessenger.Stub` 这个抽象内部类的实例，这个类的实现类(`MessengerImpl`)来自于 `Handler`：

```java
// android.os.Handler.java

public class Handler {
    @UnsupportedAppUsage
    final IMessenger getIMessenger() {
        synchronized (mQueue) {
            if (mMessenger != null) {
                return mMessenger;
            }
            mMessenger = new MessengerImpl();
            return mMessenger;
        }
    }

    private final class MessengerImpl extends IMessenger.Stub {
        public void send(Message msg) {
            msg.sendingUid = Binder.getCallingUid();
            Handler.this.sendMessage(msg);
        }
    }
}

```

可以看到，当收到消息后（并发），`Handler` 负责 **线程安全** 的队列分发这些消息。AIDL进行IPC通信的消息载体是 `android.os.Parcel`，它支持将 `android.os.Parcelable` 写入到这个消息载体，而 `android.os.Message` 就是 `android.os.Parcelable`。`android.os.Message` 是 `Messenger` 唯一可使用的数据类型。

Client使用 `Messenger` 发送消息的时候。它会使用 `IBinder`(`BinderProxy`)进行通信，其实底层还是 `IMessenger.Stub.asInterface()`：

```java
// android.os.Messenger.java

public final class Messenger implements Parcelable {
    private final IMessenger mTarget;

    /**
     * Send a Message to this Messenger's Handler.
     * 
     * @param message The Message to send.  Usually retrieved through
     * {@link Message#obtain() Message.obtain()}.
     * 
     * @throws RemoteException Throws DeadObjectException if the target
     * Handler no longer exists.
     */
    public void send(Message message) throws RemoteException {
        mTarget.send(message);
    }

    /**
     * Create a Messenger from a raw IBinder, which had previously been
     * retrieved with {@link #getBinder}.
     * 
     * @param target The IBinder this Messenger should communicate with.
     */
    public Messenger(IBinder target) {
        mTarget = IMessenger.Stub.asInterface(target);
    }
}
```

注意到这个 `Messenger` 也是个 `Parcelable`，这有什么用呢，我们看一下 `android.os.Message` 的一个变量：

```java
// android.os.Message.java

public final class Message implements Parcelable {
    /**
     * Optional Messenger where replies to this message can be sent.  The
     * semantics of exactly how this is used are up to the sender and
     * receiver.
     */
    public Messenger replyTo;
}
```

应该很清楚了，它就是用来 **双向通信** 的。
