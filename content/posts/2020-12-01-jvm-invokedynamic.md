+++
authors = ["Lenox"]
title = "JVM的InvokeDynamic指令"
date = "2020-12-01"
description = ""
tags = [
    "Bytecode",
]
categories = [
    "JVM",
]
series = []
disableComments = true
draft = false
+++

#### [Kotlin(1.4.20)](https://kotlinlang.org/docs/reference/whatsnew1420.html)

**1.4.20** 版本的Kotlin已经于上个月正式释出，在本次更新中，有一个 **实验性(Experimental)** 的性能优化包含在其中：**Kotlin 1.4.20 can compile string concatenations into dynamic invocations on JVM 9+ targets**。字符串连接将会以新的方式实现，这样可以提高性能。在了解新方式之前，我们先了解一下9以下的JVM字节码：

首先我们定义一个Kotlin文件：FileSuffixAppender.kt，这个文件包含一些可以给文件名添加一些常用后缀的函数。

```kotlin
//cn.nikeo.kotlin.FileSuffixAppender.kt

package cn.nikeo.kotlin

fun appendKotlin(fileName: String): String = "$fileName.kt"
```

此时我们将jvmTarget切换到1.8：

```kotlin
//build.gradle.kts

tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
    kotlinOptions {
        jvmTarget = "1.8"
    }
}
```

编译完成后，我们查看以下这个文件对应的字节码：

```shell
$ ./gradlew clean compileKotlin 
$ javap -c build/classes/kotlin/main/cn/nikeo/kotlin/FileSuffixAppenderKt.class 
Compiled from "FileSuffixAppender.kt"
public final class cn.nikeo.kotlin.FileSuffixAppenderKt {
  public static final java.lang.String appendKotlin(java.lang.String);
    Code:
       0: aload_0
       1: ldc           #9                  // String fileName
       3: invokestatic  #15                 // Method kotlin/jvm/internal/Intrinsics.checkNotNullParameter:(Ljava/lang/Object;Ljava/lang/String;)V
       6: new           #17                 // class java/lang/StringBuilder
       9: dup
      10: invokespecial #21                 // Method java/lang/StringBuilder."<init>":()V
      13: aload_0
      14: invokevirtual #25                 // Method java/lang/StringBuilder.append:(Ljava/lang/String;)Ljava/lang/StringBuilder;
      17: ldc           #27                 // String .kt
      19: invokevirtual #25                 // Method java/lang/StringBuilder.append:(Ljava/lang/String;)Ljava/lang/StringBuilder;
      22: invokevirtual #31                 // Method java/lang/StringBuilder.toString:()Ljava/lang/String;
      25: areturn
}
```

由此我们可以的了解到在 **jvmTarget < 9** 的编译器（kotlinc）下，字符串连接底层使用的是 `java.lang.StringBuilder`。

现在我们将jvmTarget切换到9,并且根据文档添加一些编译器参数：

To enable `invokedynamic` string concatenation, add the `-Xstring-concat` compiler option with one of the following values:

- `indy-with-constants` to perform `invokedynamic` concatenation on strings with `StringConcatFactory.makeConcatWithConstants()`.
- `indy` to perform `invokedynamic` concatenation on strings with `StringConcatFactory.makeConcat()`.
- `inline` to switch back to the classic concatenation via `StringBuilder.append()`.

```kotlin
//build.gradle.kts

tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
    kotlinOptions {
        jvmTarget = "9"
        freeCompilerArgs = listOf(
            "-Xstring-concat=indy-with-constants"
        )
    }
}
```

编译完成后，我们查看以下这个文件对应的字节码：

```shell
$ ./gradlew clean compileKotlin
$ javap -c build/classes/kotlin/main/cn/nikeo/kotlin/FileSuffixAppenderKt.class 
Compiled from "FileSuffixAppender.kt"
public final class cn.nikeo.kotlin.FileSuffixAppenderKt {
  public static final java.lang.String appendKotlin(java.lang.String);
    Code:
       0: aload_0
       1: ldc           #9                  // String fileName
       3: invokestatic  #15                 // Method kotlin/jvm/internal/Intrinsics.checkNotNullParameter:(Ljava/lang/Object;Ljava/lang/String;)V
       6: aload_0
       7: invokedynamic #26,  0             // InvokeDynamic #0:makeConcatWithConstants:(Ljava/lang/String;)Ljava/lang/String;
      12: areturn
}

```

由此我们可以的了解到在 **jvmTarget >= 9** 的编译器（kotlinc）下，字符串连接是使用 `invokedynamic` 指令调用一个新的方法而完成。

#### Java

同样的，我们定义一个Java版本的 `FileSuffixAppender`：

```java
// cn.nikeo.java.FileSuffixAppender.java
package cn.nikeo.java;

public class FileSuffixAppender {

  public static String java(String fileName) {
    return fileName + ".java";
  }
}
```

此时我们切换编译器(javac)的 `sourceCompatibility` 和 `targetCompatibility` 为 **1.8**：

```kotlin
// build.gradle.kts

tasks.withType<JavaCompile> {
    sourceCompatibility = "1.8"
    targetCompatibility = "1.8"
}
```

编译完成后，我们查看以下这个类对应的字节码：

```shell
$ ./gradlew clean compileJava
$ javap -c build/classes/java/main/cn/nikeo/java/FileSuffixAppender.class 
Compiled from "FileSuffixAppender.java"
public class cn.nikeo.java.FileSuffixAppender {
  public cn.nikeo.java.FileSuffixAppender();
    Code:
       0: aload_0
       1: invokespecial #1                  // Method java/lang/Object."<init>":()V
       4: return

  public static java.lang.String java(java.lang.String);
    Code:
       0: new           #2                  // class java/lang/StringBuilder
       3: dup
       4: invokespecial #3                  // Method java/lang/StringBuilder."<init>":()V
       7: aload_0
       8: invokevirtual #4                  // Method java/lang/StringBuilder.append:(Ljava/lang/String;)Ljava/lang/StringBuilder;
      11: ldc           #5                  // String .java
      13: invokevirtual #4                  // Method java/lang/StringBuilder.append:(Ljava/lang/String;)Ljava/lang/StringBuilder;
      16: invokevirtual #6                  // Method java/lang/StringBuilder.toString:()Ljava/lang/String;
      19: areturn
}
```

由此我们可以的了解到在 **sourceCompatibility/targetCompatibility < 9** 的编译器（javac）下，字符串连接底层使用的是 `java.lang.StringBuilder`。

现在我们将sourceCompatibility/targetCompatibility切换到9：

```kotlin
// build.gradle.kts

tasks.withType<JavaCompile> {
    sourceCompatibility = "9"
    targetCompatibility = "9"
}
```

编译完成后，我们查看以下这个类对应的字节码：

```shell
$ ./gradlew clean compileJava
$ javap -c build/classes/java/main/cn/nikeo/java/FileSuffixAppender.class 
Compiled from "FileSuffixAppender.java"
public class cn.nikeo.java.FileSuffixAppender {
  public cn.nikeo.java.FileSuffixAppender();
    Code:
       0: aload_0
       1: invokespecial #1                  // Method java/lang/Object."<init>":()V
       4: return

  public static java.lang.String java(java.lang.String);
    Code:
       0: aload_0
       1: invokedynamic #2,  0              // InvokeDynamic #0:makeConcatWithConstants:(Ljava/lang/String;)Ljava/lang/String;
       6: areturn
}
```

由此我们可以的了解到在 **sourceCompatibility/targetCompatibility >= 9** 的编译器（javac）下，字符串连接是使用 `invokedynamic` 指令调用一个新的方法而完成。

#### JVM9+ 真正执行字符串连接的新方法是什么？

我们打印字节玛的更多信息以了解 **JVM9+** 真正执行字符串连接的新方法是什么：

```shell
$ ./gradlew clean compileJava
$ javap -c -v build/classes/java/main/cn/nikeo/java/FileSuffixAppender.class 
Classfile /home/lenox/IdeaProjects/bytecode/build/classes/java/main/cn/nikeo/java/FileSuffixAppender.class
  Last modified Jan 15, 2021; size 861 bytes
  MD5 checksum 486d3c762ec4d8e0cd4205e86450f6d4
  Compiled from "FileSuffixAppender.java"
public class cn.nikeo.java.FileSuffixAppender
  minor version: 0
  major version: 53
  flags: (0x0021) ACC_PUBLIC, ACC_SUPER
  this_class: #3                          // cn/nikeo/java/FileSuffixAppender
  super_class: #4                         // java/lang/Object
  interfaces: 0, fields: 0, methods: 2, attributes: 3
Constant pool:
   #1 = Methodref          #4.#18         // java/lang/Object."<init>":()V
   #2 = InvokeDynamic      #0:#22         // #0:makeConcatWithConstants:(Ljava/lang/String;)Ljava/lang/String;
   #3 = Class              #23            // cn/nikeo/java/FileSuffixAppender
   #4 = Class              #24            // java/lang/Object
   #5 = Utf8               <init>
   #6 = Utf8               ()V
   #7 = Utf8               Code
   #8 = Utf8               LineNumberTable
   #9 = Utf8               LocalVariableTable
  #10 = Utf8               this
  #11 = Utf8               Lcn/nikeo/java/FileSuffixAppender;
  #12 = Utf8               java
  #13 = Utf8               (Ljava/lang/String;)Ljava/lang/String;
  #14 = Utf8               fileName
  #15 = Utf8               Ljava/lang/String;
  #16 = Utf8               SourceFile
  #17 = Utf8               FileSuffixAppender.java
  #18 = NameAndType        #5:#6          // "<init>":()V
  #19 = Utf8               BootstrapMethods
  #20 = MethodHandle       6:#25          // REF_invokeStatic java/lang/invoke/StringConcatFactory.makeConcatWithConstants:(Ljava/lang/invoke/MethodHandles$Lookup;Ljava/lang/String;Ljava/lang/invoke/MethodType;Ljava/lang/String;[Ljava/lang/Object;)Ljava/lang/invoke/CallSite;
  #21 = String             #26            // \u0001.java
  #22 = NameAndType        #27:#13        // makeConcatWithConstants:(Ljava/lang/String;)Ljava/lang/String;
  #23 = Utf8               cn/nikeo/java/FileSuffixAppender
  #24 = Utf8               java/lang/Object
  #25 = Methodref          #28.#29        // java/lang/invoke/StringConcatFactory.makeConcatWithConstants:(Ljava/lang/invoke/MethodHandles$Lookup;Ljava/lang/String;Ljava/lang/invoke/MethodType;Ljava/lang/String;[Ljava/lang/Object;)Ljava/lang/invoke/CallSite;
  #26 = Utf8               \u0001.java
  #27 = Utf8               makeConcatWithConstants
  #28 = Class              #30            // java/lang/invoke/StringConcatFactory
  #29 = NameAndType        #27:#34        // makeConcatWithConstants:(Ljava/lang/invoke/MethodHandles$Lookup;Ljava/lang/String;Ljava/lang/invoke/MethodType;Ljava/lang/String;[Ljava/lang/Object;)Ljava/lang/invoke/CallSite;
  #30 = Utf8               java/lang/invoke/StringConcatFactory
  #31 = Class              #36            // java/lang/invoke/MethodHandles$Lookup
  #32 = Utf8               Lookup
  #33 = Utf8               InnerClasses
  #34 = Utf8               (Ljava/lang/invoke/MethodHandles$Lookup;Ljava/lang/String;Ljava/lang/invoke/MethodType;Ljava/lang/String;[Ljava/lang/Object;)Ljava/lang/invoke/CallSite;
  #35 = Class              #37            // java/lang/invoke/MethodHandles
  #36 = Utf8               java/lang/invoke/MethodHandles$Lookup
  #37 = Utf8               java/lang/invoke/MethodHandles
{
  public cn.nikeo.java.FileSuffixAppender();
    descriptor: ()V
    flags: (0x0001) ACC_PUBLIC
    Code:
      stack=1, locals=1, args_size=1
         0: aload_0
         1: invokespecial #1                  // Method java/lang/Object."<init>":()V
         4: return
      LineNumberTable:
        line 3: 0
      LocalVariableTable:
        Start  Length  Slot  Name   Signature
            0       5     0  this   Lcn/nikeo/java/FileSuffixAppender;

  public static java.lang.String java(java.lang.String);
    descriptor: (Ljava/lang/String;)Ljava/lang/String;
    flags: (0x0009) ACC_PUBLIC, ACC_STATIC
    Code:
      stack=1, locals=1, args_size=1
         0: aload_0
         1: invokedynamic #2,  0              // InvokeDynamic #0:makeConcatWithConstants:(Ljava/lang/String;)Ljava/lang/String;
         6: areturn
      LineNumberTable:
        line 6: 0
      LocalVariableTable:
        Start  Length  Slot  Name   Signature
            0       7     0 fileName   Ljava/lang/String;
}
SourceFile: "FileSuffixAppender.java"
InnerClasses:
  public static final #32= #31 of #35;    // Lookup=class java/lang/invoke/MethodHandles$Lookup of class java/lang/invoke/MethodHandles
BootstrapMethods:
  0: #20 REF_invokeStatic java/lang/invoke/StringConcatFactory.makeConcatWithConstants:(Ljava/lang/invoke/MethodHandles$Lookup;Ljava/lang/String;Ljava/lang/invoke/MethodType;Ljava/lang/String;[Ljava/lang/Object;)Ljava/lang/invoke/CallSite;
    Method arguments:
      #21 \u0001.java

```

看上去好像是 `java.lang.invoke.StringConcatFactory#makeConcatWithConstants`。

#### invokedynamic

Java是一门 **静态类型语言(statically typed language)** ，它在 **编译期（compile time）** 执行类型检查，当一个程序编译时，一个类的所有类型信息，实例变量，方法参数，返回值等等都是可用的，Java编译器可以使用这些类型信息编译出 **强类型（strongly typing）** 的字节玛，从而可以在 **运行时（runtime）** 被JVM有效的执行。

而类似Python/Ruby/Javascript等这些是 **动态类型语言（dynamically typed language）**，它在 **运行时（runtime）**，这些语言在 **编译期（compile time）** 通常没有任何类型信息，一个对象的类型在 **运行时（runtime）** 被确定。

**静态类型语言(statically typed language)** 和 **动态类型语言（dynamically typed language）** 可以是 **强类型（strongly typing）** ，也可以是 **弱类型（weak typing）** 。

比如说，对于一个加操作（+），在 **强类型（strongly typing）** 语言中，无论是动态类型，还是静态类型，它的行为都依赖于操作数的类型，一个静态类型语言的编译器会基于操作数的类型选择加操作的实现，比如对于Java编译器而言，如果加操作的操作数是 `Integer`类型，则会使用JVM指令 `iadd` 作为加操作的实现，加操作将会编译到方法调用处由于JVM的 `iadd` 指令要求的操作类型是静态可知的。

```java
public static int add(int x, int y) {
  return x + y;
}
```

编译后的字节玛：

```txt
public static int add(int, int);
    Code:
       0: iload_0
       1: iload_1
       2: iadd
       3: ireturn

```

相反的是，动态类型语言的编译器延迟选择加操作的实现到运行时，`a + b` 也会被编译为 `+(a, b)`，后者的 + 是一个方法名（+在JVM中是允许的，但是在Java中的非法的），假设动态类型语言的运行时能够标识 a 和 b 的类型是 Integer，则运行时会优先使用Integer类型在加操作上的实现。

编译动态类型语言所面临最大的挑战是如何实现一个运行时，从而可以选择一个方法或函数最合适的实现。

Java SE 7介绍了一个新的指令-`invokedynamic`，它可以用来自定义调用点（call site）与方法实现（method implentation）的链接关系。对于JVM9+字符串连接，它也使用了`invokedynamic` 指令，它的调用点是 `+`，这个调用点通过 **引导方法（bootstrap method）** 被链接到一个实现方法，这个 **引导方法（bootstrap method）** 就是 `java.lang.invoke.StringConcatFactory#makeConcatWithConstants`。

假设我们现在会生成一个名为 cn/nikeo/java/BinaryIntegerCalculator.class 的字节玛文件，要注意的是，这个字节玛不是通过Java文件编译来的，而是我们通过ASM(org.ow2.asm:asm:version)直接生成的。这个字节玛文件对应的Java源文件如下所示(注意这个源文件并不存在):

```java
// cn.nikeo.java.BinaryIntegerCalculator.java

public class BinaryIntegerCalculator {

    private final int a;

    private final int b;

    public BinaryIntegerCalculator(int a, int b) {
        this.a = a;
        this.b = b;
    }

    public int sum() {
        return a + b;
    }
}
```

很简单，这是一个支持二元运算的计算器，它有一个 `sum` 方法用来计算两个值的和。由于这两个值的类型是 `int`，所以这个方法进行值相加的默认实现是使用 `iadd` JVM指令，但现在我们想把加操作的实现委托给另一个类的方法，这个方法如下所示（它在用户类路经中）：

```java
// cn.nikeo.java.IntegerOpsHelper.java

package cn.nikeo.java;

public class IntegerOpsHelper {
  public static int addExact(int x, int y) {
    return Math.addExact(x, y);
  }
}

```

`IntegerOpsHelper#addExact` 这个方法会对加操作后的结果值进行判断，如果超过Integer最大值，则会抛出 `ArithmeticException`。

为了实现，我们有两种方式，一种是使用 `invokestatic` JVM指令：

```java
private static void sum(ClassWriter cw) {
    MethodVisitor sum = cw.visitMethod(Opcodes.ACC_PUBLIC, "sum", "()I", null, null);

    sum.visitVarInsn(Opcodes.ALOAD, 0);
    sum.visitFieldInsn(Opcodes.GETFIELD, CLASS_REFERENCE.replace(".", File.separator), "a", "I");

    sum.visitVarInsn(Opcodes.ALOAD, 0);
    sum.visitFieldInsn(Opcodes.GETFIELD, CLASS_REFERENCE.replace(".", File.separator), "b", "I");

    sum.visitMethodInsn(Opcodes.INVOKESTATIC, "cn/nikeo/java/IntegerOpsHelper", "addExact", "(II)I",  false);

    sum.visitInsn(Opcodes.IRETURN);

    sum.visitMaxs(2, 1);
    sum.visitEnd();
}
```

```txt
  public int sum();
    descriptor: ()I
    flags: (0x0001) ACC_PUBLIC
    Code:
      stack=2, locals=1, args_size=1
         0: aload_0
         1: getfield      #14                 // Field a:I
         4: aload_0
         5: getfield      #16                 // Field b:I
         8: invokestatic  #24                 // Method cn/nikeo/java/IntegerOpsHelper.addExact:(II)I
        11: ireturn
```

第二种使用 `invokedynamic` JVM指令，现在我们已经有了加操作的实现-`cn.nikeo.java.IntegerOpsHelper`，还缺一个 **Bootstrap method** 将加操作链接到这个实现上：

```java
package cn.nikeo.java;

import java.lang.invoke.CallSite;
import java.lang.invoke.ConstantCallSite;
import java.lang.invoke.MethodHandle;
import java.lang.invoke.MethodHandles;
import java.lang.invoke.MethodType;

public class IntegerOpsFactory {

  public static CallSite makeAdd(MethodHandles.Lookup callerClass, String dynMethodName,
      MethodType dynMethodType) throws Throwable {
    System.out.println("IntegerOpsFactory#makeAdd");

    MethodHandle mh;
    if ("addExact".equals(dynMethodName)) {
      mh = callerClass.findStatic(IntegerOpsHelper.class, dynMethodName,
          MethodType.methodType(int.class, int.class, int.class));
    } else {
      throw new IllegalArgumentException();
    }

    if (!dynMethodType.equals(mh.type())) {
      mh = mh.asType(dynMethodType);
    }

    return new ConstantCallSite(mh);
  }
}
```

OK，现在可以使用ASM去实现了：

```java
private static void sum(ClassWriter cw) {
    MethodVisitor sum = cw.visitMethod(Opcodes.ACC_PUBLIC, "sum", "()I", null, null);

    sum.visitVarInsn(Opcodes.ALOAD, 0);
    sum.visitFieldInsn(Opcodes.GETFIELD, CLASS_REFERENCE.replace(".", File.separator), "a", "I");

    sum.visitVarInsn(Opcodes.ALOAD, 0);
    sum.visitFieldInsn(Opcodes.GETFIELD, CLASS_REFERENCE.replace(".", File.separator), "b", "I");

    MethodType mt = MethodType.methodType(
        CallSite.class,
        MethodHandles.Lookup.class,
        String.class,
        MethodType.class
    );
    Handle bootstrapMethodHandler = new Handle(
        Opcodes.H_INVOKESTATIC,
        Type.getInternalName(IntegerOpsFactory.class),
        "makeAdd",
        mt.toMethodDescriptorString(),
        false
    );
    sum.visitInvokeDynamicInsn("addExact", "(II)I", bootstrapMethodHandler);

    sum.visitInsn(Opcodes.IRETURN);

    sum.visitMaxs(2, 1);
    sum.visitEnd();
  }
```

查看完整编译后字节玛：

```shell
$ javap -c -v build/classes/java/main/cn/nikeo/java/BinaryIntegerCalculator
Warning: File ./build/classes/java/main/cn/nikeo/java/BinaryIntegerCalculator.class does not contain class build/classes/java/main/cn/nikeo/java/BinaryIntegerCalculator
Classfile /home/lenox/IdeaProjects/bytecode/build/classes/java/main/cn/nikeo/java/BinaryIntegerCalculator.class
  Last modified Jan 15, 2021; size 509 bytes
  MD5 checksum d2abb2b6a3e16ee7ddac4f8eb30365d7
public class cn.nikeo.java.BinaryIntegerCalculator
  minor version: 0
  major version: 55
  flags: (0x0021) ACC_PUBLIC, ACC_SUPER
  this_class: #2                          // cn/nikeo/java/BinaryIntegerCalculator
  super_class: #4                         // java/lang/Object
  interfaces: 0, fields: 2, methods: 2, attributes: 1
Constant pool:
   #1 = Utf8               cn/nikeo/java/BinaryIntegerCalculator
   #2 = Class              #1             // cn/nikeo/java/BinaryIntegerCalculator
   #3 = Utf8               java/lang/Object
   #4 = Class              #3             // java/lang/Object
   #5 = Utf8               a
   #6 = Utf8               I
   #7 = Utf8               b
   #8 = Utf8               <init>
   #9 = Utf8               (II)V
  #10 = Utf8               ()V
  #11 = NameAndType        #8:#10         // "<init>":()V
  #12 = Methodref          #4.#11         // java/lang/Object."<init>":()V
  #13 = NameAndType        #5:#6          // a:I
  #14 = Fieldref           #2.#13         // cn/nikeo/java/BinaryIntegerCalculator.a:I
  #15 = NameAndType        #7:#6          // b:I
  #16 = Fieldref           #2.#15         // cn/nikeo/java/BinaryIntegerCalculator.b:I
  #17 = Utf8               sum
  #18 = Utf8               ()I
  #19 = Utf8               cn/nikeo/java/IntegerOpsFactory
  #20 = Class              #19            // cn/nikeo/java/IntegerOpsFactory
  #21 = Utf8               makeAdd
  #22 = Utf8               (Ljava/lang/invoke/MethodHandles$Lookup;Ljava/lang/String;Ljava/lang/invoke/MethodType;)Ljava/lang/invoke/CallSite;
  #23 = NameAndType        #21:#22        // makeAdd:(Ljava/lang/invoke/MethodHandles$Lookup;Ljava/lang/String;Ljava/lang/invoke/MethodType;)Ljava/lang/invoke/CallSite;
  #24 = Methodref          #20.#23        // cn/nikeo/java/IntegerOpsFactory.makeAdd:(Ljava/lang/invoke/MethodHandles$Lookup;Ljava/lang/String;Ljava/lang/invoke/MethodType;)Ljava/lang/invoke/CallSite;
  #25 = MethodHandle       6:#24          // REF_invokeStatic cn/nikeo/java/IntegerOpsFactory.makeAdd:(Ljava/lang/invoke/MethodHandles$Lookup;Ljava/lang/String;Ljava/lang/invoke/MethodType;)Ljava/lang/invoke/CallSite;
  #26 = Utf8               addExact
  #27 = Utf8               (II)I
  #28 = NameAndType        #26:#27        // addExact:(II)I
  #29 = InvokeDynamic      #0:#28         // #0:addExact:(II)I
  #30 = Utf8               Code
  #31 = Utf8               BootstrapMethods
{
  public cn.nikeo.java.BinaryIntegerCalculator(int, int);
    descriptor: (II)V
    flags: (0x0001) ACC_PUBLIC
    Code:
      stack=2, locals=3, args_size=3
         0: aload_0
         1: invokespecial #12                 // Method java/lang/Object."<init>":()V
         4: aload_0
         5: iload_1
         6: putfield      #14                 // Field a:I
         9: aload_0
        10: iload_2
        11: putfield      #16                 // Field b:I
        14: return

  public int sum();
    descriptor: ()I
    flags: (0x0001) ACC_PUBLIC
    Code:
      stack=2, locals=1, args_size=1
         0: aload_0
         1: getfield      #14                 // Field a:I
         4: aload_0
         5: getfield      #16                 // Field b:I
         8: invokedynamic #29,  0             // InvokeDynamic #0:addExact:(II)I
        13: ireturn
}
BootstrapMethods:
  0: #25 REF_invokeStatic cn/nikeo/java/IntegerOpsFactory.makeAdd:(Ljava/lang/invoke/MethodHandles$Lookup;Ljava/lang/String;Ljava/lang/invoke/MethodType;)Ljava/lang/invoke/CallSite;
    Method arguments:
```

现在我们来验证以下正常情况：

```java
public static void testSum() {
    try {
      Class<?> twoOpsCalculatorCls = ClassLoader.getSystemClassLoader().loadClass(CLASS_REFERENCE);
      Constructor<?> ctr = twoOpsCalculatorCls
          .getConstructor(int.class, int.class);
      Object instance = ctr.newInstance(100, 2);

      Method sumMethod = twoOpsCalculatorCls.getMethod("sum");
      int sumValue = (int) sumMethod.invoke(instance);
      System.out.println(sumValue);
    } catch (ClassNotFoundException | NoSuchMethodException | IllegalAccessException | InstantiationException | InvocationTargetException e) {
      e.printStackTrace();
    }
}
```

执行一次这个方法后
Output:

```txt
IntegerOpsFactory#makeAdd
102
```

现在我们来验证以下异常情况：

```java
public static void testSum() {
    try {
      Class<?> twoOpsCalculatorCls = ClassLoader.getSystemClassLoader().loadClass(CLASS_REFERENCE);
      Constructor<?> ctr = twoOpsCalculatorCls
          .getConstructor(int.class, int.class);
      Object instance = ctr.newInstance(Integer.MAX_VALUE, 1);

      Method sumMethod = twoOpsCalculatorCls.getMethod("sum");
      int sumValue = (int) sumMethod.invoke(instance);
      System.out.println(sumValue);
    } catch (ClassNotFoundException | NoSuchMethodException | IllegalAccessException | InstantiationException | InvocationTargetException e) {
      e.printStackTrace();
    }
}
```

执行一次这个方法后
Output:

```txt
IntegerOpsFactory#makeAdd
java.lang.reflect.InvocationTargetException
 at java.base/jdk.internal.reflect.NativeMethodAccessorImpl.invoke0(Native Method)
 at java.base/jdk.internal.reflect.NativeMethodAccessorImpl.invoke(NativeMethodAccessorImpl.java:62)
 at java.base/jdk.internal.reflect.DelegatingMethodAccessorImpl.invoke(DelegatingMethodAccessorImpl.java:43)
 at java.base/java.lang.reflect.Method.invoke(Method.java:566)
 at cn.nikeo.java.BinaryIntegerCalculatorClassGenerator.testSum(BinaryIntegerCalculatorClassGenerator.java:147)
 at cn.nikeo.java.Main.main(Main.java:7)
Caused by: java.lang.ArithmeticException: integer overflow
 at java.base/java.lang.Math.addExact(Math.java:825)
 at cn.nikeo.java.IntegerOpsHelper.addExact(IntegerOpsHelper.java:10)
 at cn.nikeo.java.BinaryIntegerCalculator.sum(Unknown Source)
 ... 6 more
Caused by: java.lang.ArithmeticException: integer overflow
```

当我们在正常情况下执行3次后，查看打印：

 ```txt
 IntegerOpsFactory#makeAdd
102
102
102
 ```

 我们注意到 _IntegerOpsFactory#makeAdd_这个只执行了一次，这是因为 **Bootstrap method** 只会被JVM链接 **调用点（call site）** 到 **方法实现** 一次，下次会直接调用方法实现。

##### 源代码完整实现

```java
// cn.nikeo.java.BinaryIntegerCalculatorClassGenerator.java

package cn.nikeo.java;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.lang.invoke.CallSite;
import java.lang.invoke.MethodHandles;
import java.lang.invoke.MethodType;
import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import org.objectweb.asm.ClassWriter;
import org.objectweb.asm.Handle;
import org.objectweb.asm.MethodVisitor;
import org.objectweb.asm.Opcodes;
import org.objectweb.asm.Type;

public class BinaryIntegerCalculatorClassGenerator {

  private static final String CLASS_REFERENCE = "cn.nikeo.java.BinaryIntegerCalculator";
  private static final String DOT_CLASS = ".class";

  public static void generateToProjectClasspath() {
    generateTo("/home/lenox/IdeaProjects/bytecode/build/classes/java/main/");
  }

  public static void generateTo(String classpath) {
    ClassWriter cw = new ClassWriter(ClassWriter.COMPUTE_MAXS);
    cw.visit(
        Opcodes.V11,
        Opcodes.ACC_PUBLIC | Opcodes.ACC_SUPER,
        CLASS_REFERENCE.replace(".", File.separator),
        null,
        Type.getInternalName(Object.class),
        null
    );

    cw.visitField(
        Opcodes.ACC_PRIVATE | Opcodes.ACC_FINAL,
        "a",
        Type.INT_TYPE.getDescriptor(),
        null,
        null
    );
    cw.visitField(
        Opcodes.ACC_PRIVATE | Opcodes.ACC_FINAL,
        "b",
        Type.INT_TYPE.getDescriptor(),
        null,
        null
    );

    // constructor start
    MethodVisitor constructor = cw.visitMethod(
        Opcodes.ACC_PUBLIC,
        "<init>",
        "(II)V",
        null,
        null
    );

    constructor.visitVarInsn(Opcodes.ALOAD, 0);
    constructor
        .visitMethodInsn(Opcodes.INVOKESPECIAL, Type.getInternalName(Object.class), "<init>", "()V",
            false);

    constructor.visitVarInsn(Opcodes.ALOAD, 0);
    constructor.visitVarInsn(Opcodes.ILOAD, 1);
    constructor
        .visitFieldInsn(Opcodes.PUTFIELD, CLASS_REFERENCE.replace(".", File.separator), "a", "I");

    constructor.visitVarInsn(Opcodes.ALOAD, 0);
    constructor.visitVarInsn(Opcodes.ILOAD, 2);
    constructor
        .visitFieldInsn(Opcodes.PUTFIELD, CLASS_REFERENCE.replace(".", File.separator), "b", "I");

    constructor.visitInsn(Opcodes.RETURN);

    constructor.visitMaxs(3, 3);
    constructor.visitEnd();
    // constructor end

    // sum start
    sum(cw);
    // sum end

    cw.visitEnd();

    try {
      String packageName = CLASS_REFERENCE.substring(0, CLASS_REFERENCE.lastIndexOf("."));
      String className = CLASS_REFERENCE.substring(CLASS_REFERENCE.lastIndexOf(".") + 1);

      if (!classpath.endsWith(File.separator)) {
        classpath += File.separator;
      }
      FileOutputStream fos = new FileOutputStream(
          new File(classpath + packageName.replace(".", File.separator),
              className + DOT_CLASS));
      fos.write(cw.toByteArray());
      fos.flush();
      fos.close();
    } catch (IOException e) {
      e.printStackTrace();
    }
  }

  private static void sum(ClassWriter cw) {
    MethodVisitor sum = cw.visitMethod(Opcodes.ACC_PUBLIC, "sum", "()I", null, null);

    sum.visitVarInsn(Opcodes.ALOAD, 0);
    sum.visitFieldInsn(Opcodes.GETFIELD, CLASS_REFERENCE.replace(".", File.separator), "a", "I");

    sum.visitVarInsn(Opcodes.ALOAD, 0);
    sum.visitFieldInsn(Opcodes.GETFIELD, CLASS_REFERENCE.replace(".", File.separator), "b", "I");

    MethodType mt = MethodType.methodType(
        CallSite.class,
        MethodHandles.Lookup.class,
        String.class,
        MethodType.class
    );
    Handle bootstrapMethodHandler = new Handle(
        Opcodes.H_INVOKESTATIC,
        Type.getInternalName(IntegerOpsFactory.class),
        "makeAdd",
        mt.toMethodDescriptorString(),
        false
    );
    sum.visitInvokeDynamicInsn("addExact", "(II)I", bootstrapMethodHandler);

//    sum.visitMethodInsn(Opcodes.INVOKESTATIC, "cn/nikeo/java/IntegerOpsHelper", "addExact", "(II)I",  false);

    sum.visitInsn(Opcodes.IRETURN);

    sum.visitMaxs(2, 1);
    sum.visitEnd();
  }

  public static void testSum() {
    try {
      Class<?> twoOpsCalculatorCls = ClassLoader.getSystemClassLoader().loadClass(CLASS_REFERENCE);
      Constructor<?> ctr = twoOpsCalculatorCls
          .getConstructor(int.class, int.class);
      Object instance = ctr.newInstance(100, 2);

      Method sumMethod = twoOpsCalculatorCls.getMethod("sum");
      int sumValue = (int) sumMethod.invoke(instance);
      System.out.println(sumValue);
    } catch (ClassNotFoundException | NoSuchMethodException | IllegalAccessException | InstantiationException | InvocationTargetException e) {
      e.printStackTrace();
    }
  }
}
```

#### 相关链接

- [https://docs.oracle.com/javase/specs/jvms/se11/html/](https://docs.oracle.com/javase/specs/jvms/se11/html/)
- [https://docs.oracle.com/javase/7/docs/technotes/guides/vm/multiple-language-support.html#invokedynamic](https://docs.oracle.com/javase/7/docs/technotes/guides/vm/multiple-language-support.html#invokedynamic)
