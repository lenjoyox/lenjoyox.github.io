+++
authors = ["Lenox"]
title = "Object Layout"
date = "2020-12-05"
description = ""
tags = [
    "Align",
    "Gap"
]
categories = [
    "VM",
]
series = []
disableComments = true
draft = false
+++

#### Heap

程序在执行期间，JVM(Java Virtual Machine)提供了两种类型的运行时数据区（Run-Time Data Areas）供程序使用：

 1. 全局数据区：随JVM的启动（start-up）而创建，随JVM的退出（exit）而销毁。
 2. 线程数据区：随线程的创建（create）而创建，随线程的退出（exit）而销毁。

堆（Heap）随VM的启动而创建，所以它属于全局数据区，由于是全局数据区，所以它可以被所有的JVM线程共享，我们平时常用的类和数组的实例都是从堆（Heap）上分配（allocate）的，有分配就有释放（deallocated），与C/C++需要程序员自己管理内存不同的是，JVM使用GC(garbage collector) 来自动管理内存。

堆（Heap）的大小可以是固定的，也可以按需扩大，如果不需要更多的空间，也可以进行收缩。如果JVM无法提供更多的堆空间，则JVM将抛出`java.lang.OutOfMemoryError`。

#### Object Layout

当我们在堆上分配一块内存区域，然后在这个区域上去创建一个对象后，这个对象肯定是有大小的，那这个对象的大小是怎么计算的，它是怎么布局的，我们研究一下这个问题。

如果我们使用的是JVM，我们可以使用[JOL](https://github.com/openjdk/jol)，它可以分析JVMs上的对象布局信息，并且它比一些基于Hprof的分析工具更佳准确。

我们以 `java.util.HashMap` 为例，查看以下JOL(internals)的分析结果：

```shell
# Running 64-bit HotSpot VM.
# Using compressed oop with 3-bit shift.
# Using compressed klass with 3-bit shift.
# Objects are 8 bytes aligned.
# Field sizes by type: 4, 1, 1, 2, 2, 4, 4, 8, 8 [bytes]
# Array element sizes: 4, 1, 1, 2, 2, 4, 4, 8, 8 [bytes]

Instantiated the sample instance via default constructor.

java.util.HashMap object internals:
 OFFSET  SIZE                       TYPE DESCRIPTION                               VALUE
      0     4                            (object header)                           01 00 00 00 (00000001 00000000 00000000 00000000) (1)
      4     4                            (object header)                           00 00 00 00 (00000000 00000000 00000000 00000000) (0)
      8     4                            (object header)                           bd 37 00 f8 (10111101 00110111 00000000 11111000) (-134203459)
     12     4              java.util.Set AbstractMap.keySet                        null
     16     4       java.util.Collection AbstractMap.values                        null
     20     4                        int HashMap.size                              0
     24     4                        int HashMap.modCount                          0
     28     4                        int HashMap.threshold                         0
     32     4                      float HashMap.loadFactor                        0.75
     36     4   java.util.HashMap.Node[] HashMap.table                             null
     40     4              java.util.Set HashMap.entrySet                          null
     44     4                            (loss due to the next object alignment)
Instance size: 48 bytes
Space losses: 0 bytes internal + 4 bytes external = 4 bytes total
```

从上面我们可以了解到一个对象基本由三部分构成：Header, Fields, Gap(Optional)：

- Headers：Header的大小并不固定，对于HotSpot VM，它可以是8/12/16字节大小（这里是12字节）。Header包含两部分：_markword_（对象的元信息），_classword_（类引用），在32位/64位的模式下，Markword占用4/8个字节，Classword仅仅是个引用，因此它可以在64位模式下被压缩，这也是造成Header的大小不固定的直接原因。
- Fields: 包含当前类及父类的所有属性。
- Gap：这是一块无用的内存空间，由于对象需要被对齐（aligned）导致内存浪费，这些内存成为对象之间的间距。

对于Header的大小，JOL是通过"猜测"的方法计算出来。JOL定义了一个只有一个属性的类(`org.openjdk.jol.vm.Experiments$HeaderClass`)，注意它不能继承其他有属性的父类：

```java
//org.openjdk.jol.vm.Experiments.java

package org.openjdk.jol.vm;

class Experiments {
    ...
    public static class HeaderClass {
        public boolean b1;
    }
    ...
}
```

然后通过 `sun.misc.Unsafe#objectFieldOffset(Field)` 方法获取 `b1` 这个Field的Offset，由于只有`b1`一个属性，则它的Offset就是Header的大小，我们可以通过JOL查看HeaderClass的布局信息（可以观察_OFFSET_和_SIZE_的值 ）：

```shell
...
org.openjdk.jol.vm.Experiments$HeaderClass object internals:
 OFFSET  SIZE      TYPE DESCRIPTION                               VALUE
      0     4           (object header)                           01 00 00 00 (00000001 00000000 00000000 00000000) (1)
      4     4           (object header)                           00 00 00 00 (00000000 00000000 00000000 00000000) (0)
      8     4           (object header)                           49 1f 01 f8 (01001001 00011111 00000001 11111000) (-134144183)
     12     1   boolean HeaderClass.b1                            false
     13     3           (loss due to the next object alignment)
Instance size: 16 bytes
Space losses: 0 bytes internal + 3 bytes external = 3 bytes total
```

上面提到Gap是由于对象的对齐（aligned）产生的，通常对象按照8个字节对齐，在JOL的输出信息中的最后一行（Space losses），它的值就是计算这些间距所占用的内存大小。对齐（aligned）可以按照下面这种方式理解：

```txt
G: Gap

    OFFSET      SIZE
+   0           4
G   4           2
-   6           2
*   8           2
G   10          2
@   12          3
G   15          1

0 1 2 3 4 5 6 7 8
|+|+|+|+|G|G|-|-|
8 9 ----------->16
|*|*|G|G|@|@|@|G|

Space losses: (2+2) bytes internal + 1 bytes external = 5 bytes total
```

所以一个对象的大小 = Size(Header) + Size(Fields) + Size(Gap)

##### Fields在内存中的排列顺序

- 前N个字节用于存储父类中所有Fields。
- 当Field被插入的时候，根据他们的大小对齐：比如`long`以8个字节对齐，`boolean`以1个字节对齐，对齐过程中会产生间距。
- 插入顺序为：基本数据类型->引用类型。

```shell
# Running 64-bit HotSpot VM.
# Using compressed oop with 3-bit shift.
# Using compressed klass with 3-bit shift.
# Objects are 8 bytes aligned.
# Field sizes by type: 4, 1, 1, 2, 2, 4, 4, 8, 8 [bytes]
# Array element sizes: 4, 1, 1, 2, 2, 4, 4, 8, 8 [bytes]

Instantiated the sample instance via default constructor.

cn.nikeo.Child object internals:
 OFFSET  SIZE               TYPE DESCRIPTION                               VALUE
      0     4                    (object header)                           01 00 00 00 (00000001 00000000 00000000 00000000) (1)
      4     4                    (object header)                           00 00 00 00 (00000000 00000000 00000000 00000000) (0)
      8     4                    (object header)                           33 22 01 f8 (00110011 00100010 00000001 11111000) (-134143437)
     12     4                int Parent.myParentInt                        0
     16     8               long Parent.myParentLong                       0
     24     8             double Parent.myParenDouble                      0.0
     32     4              float Parent.myParentFloat                      0.0
     36     2               char Parent.myParentChar                        
     38     2              short Parent.myParentShort                      0
     40     1               byte Parent.myParentByte                       0
     41     1            boolean Parent.myParentBoolean                    false
     42     2                    (alignment/padding gap)                  
     44     4     java.lang.Long Parent.myParentBoxedLong                  null
     48     4   java.lang.String Parent.myParentString                     null
     52     4                int Child.myChildInt                          0
     56     8               long Child.myChildLong                         0
     64     8             double Child.myParenDouble                       0.0
     72     4              float Child.myChildFloat                        0.0
     76     2               char Child.myChildChar                          
     78     2              short Child.myChildShort                        0
     80     1               byte Child.myChildByte                         0
     81     1            boolean Child.myChildBoolean                      false
     82     2                    (alignment/padding gap)                  
     84     4     java.lang.Long Child.myChildBoxedLong                    null
     88     4   java.lang.String Child.myChildString                       null
     92     4                    (loss due to the next object alignment)
Instance size: 96 bytes
Space losses: 4 bytes internal + 4 bytes external = 8 bytes total
```

#### Dalvik/ART runtime

由于JOL只能运行在JVMs，所以在Android（Dalvik/ART runtime）中，我们无法直接使用JOL,但我们可以根据JOL的原理简单的进行计算。

假如我们定义了一个 `School.java`，我们想要知道这个类的对象的大小：

```java
package cn.nikeo.app;

public class School {
    public String name = "School";
    public long index;
    public boolean state;
    public boolean open;
    public int classCount;
}
```

和JOL一样，我们也需要 `sun.misc.Unsafe`，但是我们无法直接引用这个API，但我们可以通过反射获取，这里我们简单封装一个自己的`Unsafe`：

```kotlin
package cn.nikeo.app

import java.lang.reflect.Field

class Unsafe private constructor(
    private val unsafeClass: Class<*>,
    private val unsafeInstance: Any
) {

    /**
     * Report the location of a given static field, in conjunction with {@link
     * #staticFieldBase}.
     * <p>Do not expect to perform any sort of arithmetic on this offset;
     * it is just a cookie which is passed to the unsafe heap memory accessors.
     *
     * <p>Any given field will always have the same offset, and no two distinct
     * fields of the same class will ever have the same offset.
     *
     * <p>As of 1.4.1, offsets for fields are represented as long values,
     * although the Sun JVM does not use the most significant 32 bits.
     * It is hard to imagine a JVM technology which needs more than
     * a few bits to encode an offset within a non-array object,
     * However, for consistency with other methods in this class,
     * this method reports its result as a long value.
     * @see #getInt(Object, long)
     */
    fun objectFieldOffset(f: Field): Long {
        return unsafeClass.getMethod("objectFieldOffset", Field::class.java)
            .invoke(unsafeInstance, f) as Long
    }

    companion object {

        @JvmStatic
        fun getUnsafe(): Unsafe {
            val unsafeClass: Class<*> = Class.forName("sun.misc.Unsafe", true, null)
            val unsafeInstance = unsafeClass.getDeclaredField("theUnsafe")
                .apply { isAccessible = true }
                .run { get(null)!! }
            return Unsafe(
                unsafeClass = unsafeClass,
                unsafeInstance = unsafeInstance
            )
        }
    }
}
```

现在我们可以通过 `objectFieldOffset` 方法获取 `School`类中每个Field的Offset:

```kotlin
package cn.nikeo.app

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.Message
import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import androidx.core.util.Supplier
import cn.nikeo.app.databinding.ActivityMemoryBinding


class MemoryActivity : AppCompatActivity() {

    private val school = School()

    private lateinit var binding: ActivityMemoryBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMemoryBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.text.text = school.name

        val unsafe = Unsafe.getUnsafe()
        val headerSize = unsafe.objectFieldOffset(
            Experiments.HeaderClass::class.java.getDeclaredField("b1").apply { isAccessible = true }
        )

        School::class.java.fields.map { field ->
            field to unsafe.objectFieldOffset(field)
        }.sortedBy { it.second }.apply {
            log(this.joinToString("\n"))
        }
        log("headerSize: $headerSize")
    }

    private fun log(message: String) = Log.i("MemoryActivity", message)
}
```

运行后如下打印(格式化后)：

```shell
2021-01-19 20:48:40.660 19030-19030/cn.nikeo.app I/MemoryActivity: 

    (public java.lang.String cn.nikeo.app.School.name, 8 )
    (public int cn.nikeo.app.School.classCount,        12)
    (public long cn.nikeo.app.School.index,            16)
    (public boolean cn.nikeo.app.School.open,          24)
    (public boolean cn.nikeo.app.School.state,         25)

2021-01-19 20:48:40.660 19030-19030/cn.nikeo.app I/MemoryActivity: headerSize: 8
```

可以发现在当前Android VM中，对象的Header的大小为8个字节。从每个字段的Offset我们可以得到它的布局信息：

```txt
               OFFSET  SIZE
    header:    0       8
      name:    8       4
classCount:    12      4
     index:    16      8
      open:    24      1
     state:    25      1
       gap:    26      6

Instance size: 32 bytes
Space losses: 0 bytes internal + 6 bytes external = 6 bytes total       
```

我们得到这个School对象应该会占用32个字节，其中有6个由于要和下个对象对齐导致浪费。

这是我们自己计算出的，我们通过 **Android Profile** Dump Java Heap，查看一个`MemoryActivity`这个对象中的`school`对象的大小，以验证以下我们的计算是否正确：

![img](/images/2020-12-05-vm-object-layout-profile.png)

我们发现这个工具计算出的大小（Shallow Size）为26个字节，小于我们的32个字节，但我们可以发现，我们正好多处6个字节，而这6个字节正好是GAP，所以 **Android Profile** 可能并未计算 external GAP的大小，当然这只是猜测。

#### Link

- [https://shipilev.net/jvm/objects-inside-out/](https://shipilev.net/jvm/objects-inside-out/)
- [https://shipilev.net/blog/2014/heapdump-is-a-lie/](https://shipilev.net/blog/2014/heapdump-is-a-lie/)
