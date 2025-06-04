+++
authors = ["Lenox"]
title = "sun.misc.Unsafe"
date = "2020-06-10"
description = ""
tags = [
    "Unsafe"
]
categories = [
    "Java",
]
series = []
disableComments = true
draft = false
+++

`Unsafe` 提供了一组比较低级(low-level)API允许Java程序员执行一些在Java层面上"不安全"的操作，比如说内存的分配和释放，"不安全"其实是相对的，如果一个Java程序员有一些C/C++开发经验的话，那这些"不安全"的API可以成为程序员窥探Java底层的工具。JDK中有大量的API借助了`Unsafe`, 比如:

- 原子操作类(Atomic)
- `java.util.concurrent.locks.LockSupport`
- 支持并发操作的(`java.util.concurrent.ConcurrentHashMap`)集合

#### 如何获取Unsafe对象

由于JDK的限制，`Unsafe`不允许在系统范围之外的类中通过`getUnsafe()`获取`Unsafe`对象。所以我们只能通过反射获取`theUnsafe`这个静态对象。

```java
Field theUnsafe = Unsafe.class.getDeclaredField("theUnsafe");
theUnsafe.setAccessible(true);
Unsafe unsafe = (Unsafe) theUnsafe.get(null);
```

#### 数组操作

- int arrayBaseOffset(Class<?> arrayClass)：返回给定数组类的存储分配中第一个元素的偏移量。
- int arrayIndexScale(Class<?> arrayClass)：返回给定数组类的存储分配中寻址元素的比例因子。

比如现在定义了一个`long`类型的数组：

```java
long[] longs = {20L, 30L, 40L};
```

我们获取这个数组类的存储分配中第一个元素的偏移量：

```java
int baseOffsetOfLongs = unsafe.arrayBaseOffset(longs.getClass());
```

我们获取这个数组类的存储分配中寻址元素的比例因子：

```java
int indexScaleOfLongs = unsafe.arrayIndexScale(longs.getClass()); // Output: 8
```

然后我们可以根据这个比例因子遍历出`longs`这个数组中的所有值：

```java
for (int i = 0; i < longs.length; i++) {
    long value = unsafe.getLong(longs, baseOffsetOfLongs + (long) indexScaleOfLongs * i);
    System.out.printf("%d <=====> %d%n", i, value);
}
/*
  Output:
  0 <=====> 20
  1 <=====> 30
  2 <=====> 40
*/
```

我们也可以修改这个数组上某个索引对应的值，假如我们修改index=1对应的值30L为100L:

```java
unsafe.putLong(longs, baseOffsetOfLongs + (long) indexScaleOfLongs * 1, 100L);
```

其实一些*基本数据类型数组类*和*对象类型数组类*的存储分配中第一个元素的偏移量的值在相关VM中已经确定了，对于上述中`baseOffsetOfLongs`的值我们还可以通过另一种方法获取：

```java
int baseOffsetOfLongs = Unsafe.ARRAY_LONG_BASE_OFFSET;
```

|  数组类型   |         获取第一个元素的偏移量API     |
|    ----    |              ----                 |
| `boolean[]`| `Unsafe.ARRAY_BOOLEAN_BASE_OFFSET`|
| `byte[]`   | `Unsafe.ARRAY_BYTE_BASE_OFFSET`   |
| `short[]`  | `Unsafe.ARRAY_SHORT_BASE_OFFSET`  |
| `char[]`   | `Unsafe.ARRAY_CHAR_BASE_OFFSET`   |
| `int[]`    | `Unsafe.ARRAY_INT_BASE_OFFSET`    |
| `long[]`   | `Unsafe.ARRAY_LONG_BASE_OFFSET`   |
| `float[]`  | `Unsafe.ARRAY_FLOAT_BASE_OFFSET`  |
| `double[]` | `Unsafe.ARRAY_DOUBLE_BASE_OFFSET` |
| `Object[]` | `Unsafe.ARRAY_OBJECT_BASE_OFFSET` |

同样一些*基本数据类型数组类*和*对象类型数组类*的存储分配中寻址元素的比例因子的值在相关VM中已经确定了，对于上述中`indexScaleOfLongs`的值我们还可以通过另一种方法获取：

```java
int indexScaleOfLongs = Unsafe.ARRAY_LONG_INDEX_SCALE; // Output: 8
```

|  数组类型   |         获取比例因子API             |
|    ----    |              ----                 |
| `boolean[]`| `Unsafe.ARRAY_BOOLEAN_INDEX_SCALE`|
| `byte[]`   | `Unsafe.ARRAY_BYTE_INDEX_SCALE`   |
| `short[]`  | `Unsafe.ARRAY_SHORT_INDEX_SCALE`  |
| `char[]`   | `Unsafe.ARRAY_CHAR_INDEX_SCALE`   |
| `int[]`    | `Unsafe.ARRAY_INT_INDEX_SCALE`    |
| `long[]`   | `Unsafe.ARRAY_LONG_INDEX_SCALE`   |
| `float[]`  | `Unsafe.ARRAY_FLOAT_INDEX_SCALE`  |
| `double[]` | `Unsafe.ARRAY_DOUBLE_INDEX_SCALE` |
| `Object[]` | `Unsafe.ARRAY_OBJECT_INDEX_SCALE` |

#### 内存操作

假如我们分配一块大小为1个字节内存块，这块内存的内容是未初始化的，如果分配成功，则返回一个指向这个内存的指针：

```java
long ptr = unsafe.allocateMemory(1L);
```

然后我们可以初始化这块内存，这里我们存储127到这块内存上：

```java
unsafe.putByte(ptr, Byte.MAX_VALUE);
```

然后我们校验以下这块内存上的值是否是127：

```java
byte value = unsafe.getByte(ptr);
System.out.println(value); // Output: 127
```

假如已经分配的内存已经不满足需求，我们需要拓展为2个字节，需要注意的是，此时我们超出旧的内存块1个字节，新块的这1个字节是未被初始化的：

```java
ptr = unsafe.reallocateMemory(ptr, 2L);
```

我们也可以将某块内存中的所有字节copy到另一块内存：

```java
long ptr1 = unsafe.allocateMemory(1L);
unsafe.putByte(ptr1, Byte.MAX_VALUE);

long ptr2 = unsafe.allocateMemory(1L);
System.out.printf("Before copy: %d%n", unsafe.getByte(ptr2));
unsafe.copyMemory(ptr1, ptr2, 1L);
System.out.printf("After copy: %d%n", unsafe.getByte(ptr2));

unsafe.freeMemory(ptr1);
unsafe.freeMemory(ptr2);
/*
Output:
Before copy: -28
After copy: 127
*/
```

当我们使用完这块内存后，**必须释放**：

```java
unsafe.freeMemory(ptr);
```

#### Field Offset

假如我们定义一个`Circle`，如下所示：

```java
public class Circle {
    public static final double PI = Math.PI;

    public final double radius;

    public Circle(double radius) {
        this.radius = radius;
    }
}
```

我们想要获取`radius`这个`Field`的位置，这个位置和这个类对象的布局有关。

```java
long offsetOfRadius = unsafe.objectFieldOffset(Circle.class.getField("radius"));
System.out.println(offsetOfRadius); // Output:16
```

在我的Hotspot VM环境下，offset为16，这是因为`Circle`对象的布局如下所示：

```diff
  OFFSET  SIZE     TYPE DESCRIPTION                         
       0     4          (object header)
       4     4          (object header)
       8     4          (object header)
      12     4          (alignment/padding gap)                  
+     16     8   double Circle.radius                             
```

现在我们想要通过`Unsafe`获取一个`Circle`对象里`radius`属性的值，我们可以这么做：

```java
Circle circle = new Circle(200);
double radius = unsafe.getDouble(circle, unsafe.objectFieldOffset(Circle.class.getField("radius")));
System.out.println(radius); // Output: 200
```

我们想要获取`PI`这个静态字段在这个类的存储分配中的位置：

```java
long offsetOfPI = unsafe.staticFieldOffset(Circle.class.getField("PI"));
```

现在我们想要通过`Unsafe`获取`Circle`类里`PI`这个静态常量的值，我们可以这么做：

```java
Field piField = Circle.class.getField("PI");
double pi = unsafe.getDouble(
        unsafe.staticFieldBase(piField),
        unsafe.staticFieldOffset(piField)
);
System.out.println(pi); //Output:3.141592653589793
```

#### 原子操作

- compareAndSwapInt
- compareAndSwapLong
- compareAndSwapObject

- getAndAddInt
- getAndAddLong

- getAndSetInt
- getAndSetLong
- getAndSetObject

#### get/put

在*数组操作*,*内存操作*和*Field offset*的描述中，我们其实已经介绍了get*()/put*()操作，我们整理一下：

对于基础数据类型（`boolean` / `byte` / `char` / `short` / `int` / `long` / `float` / `double`）,它们都有3类get*()，3类put*():

- get*(long address)
- get*(Object o, long offset)
- get*Volatile(Object o, long offset)

- put*(long address,* value)
- put*(Object o, long offset,* value)
- put*Volatile(Object o, long offset,* value)

对于Object类型：

- getObject(Object o, long offset)
- getObjectVolatile(Object o, long offset)

- putObject(Object o, long offset, Object value)
- putObjectVolatile(Object o, long offset, Object value)
