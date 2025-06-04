+++
authors = ["Lenox"]
title = "Dart Generics"
date = "2020-09-11"
description = ""
tags = [
    "Generics",
    "Covariant"
]
categories = [
    "Dart",
]
series = ["Generics"]
disableComments = true
draft = false
+++

> 这篇文章讨论一下Dart中的泛型中的协变(covariant)

### 与Java的不同之处

熟悉Java的人都知道，泛型类型在Java是不变（invariant）的，这意味这 `List<Cat>` 并不是 `List<Animal>` 的子类。比如以下代码在Java中会在编译期报错（`Cat` 是 `Animal` 的子类）：

```java
List<Cat> cats = new ArrayList<>();
List<Animal> animals = cats; // error
```

需要让此类型发生协变(covariant)：

```java
List<Cat> cats = new ArrayList<>();
List<? extends Animal> animals = cats; // correct
```

但在Dart中，`List<Cat>` 是 `List<Animal>` 的子类，这意味这以下代码是正常运行的：

```dart
List<Animal> animals = <Cat>[];
```

我们此时在定义一个 `Animal` 的子类- `Dog` ，我们往 `animals` 添加一只 `Dog`：

```dart
animals.add(Dog());
```

以上代码在编译期通过，但是在运行时会发生错误：

```txt
Unhandled exception:
type 'Dog' is not a subtype of type 'Cat' of 'value'
#0      List.add (dart:core-patch/growable_array.dart)
#1      main (file:///home/xianxueliang/IdeaProjects/dart_app/bin/dart_app.dart:11:12)
#2      _startIsolate.<anonymous closure> (dart:isolate-patch/isolate_patch.dart:299:32)
#3      _RawReceivePortImpl._handleMessage (dart:isolate-patch/isolate_patch.dart:168:12)
```

Dart语言的泛型系统没有Java语言那么完善，协变(covariant)（关键字*covariant*）在Dart中也比较脊肋，限制也比较多，也没有逆变一说，所以在进行程序设计的时候需要格外注意。

```dart
abstract class Animal {  
  void chase(covariant Animal animal);  
}  
  
class Cat extends Animal {  
  @override  
  void chase(Cat animal) {}  
}  
  
class Dog extends Animal {  
  @override  
  void chase(Dog animal) {}  
}
```
