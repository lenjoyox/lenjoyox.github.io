+++
authors = ["Lenox"]
title = "Collections and Sequences"
date = "2020-07-20"
description = ""
tags = []
categories = [
    "Kotlin",
]
series = []
disableComments = true
draft = false
+++

>*Kotlin*相比*Java*而言，一大优势在于前者利用其强大语法糖向开发者提供了丰富的函数拓展，并且通过编译优化(如*inline*)，使得这些函数在易用的同时依然保持着很高的性能。其中，*Container*作为各个编程语言中至关重要的一部分，*Kotlin*也为其增加了丰富的*operation*，比如常用的 *map/filter/reduce*。但是，随着应用/数据的日益增大，我们也应该重新审视这些当初带给我们极大便利的*operation*，即，原来的方案有哪些不足，是否有更加合适的方案来帮助我们完成这些*operation*。这就是这篇文章讨论的重点。

和往常一样，我们从一个例子开始。现在我们有一些填充了各种颜色的形状-*绿色的圆形*，*蓝色的矩形*，*红色的菱形*，*黑色的三角形*，我们将这些五彩斑斓的形状存入一个`List`中，然后通过`map`操作将这些形状的颜色全部更改成*红色*，最后通过`first`操作筛选出第一个形状为*矩形*的形状。代码如下所示：

```kotlin
listOf<Shape>(Round(Color.GREEN), Rectangle(Color.BLUE), Diamond(Color.RED), Triangle(Color.BLACK))
    .map { it.copy(Color.RED) }
    .first { it is Rectangle }
```

先考虑第一个问题：这段程序的目的是为了获取到列表中的第一个*矩形*，并且，这个矩形的颜色要通过`map`将原来的*蓝色*转换成*红色*，那其实列表中的除矩形以外的其他形状其实都没有必要做`map`映射。这些无意义的*operation*势必会随着数据量的增大为应用带来不必要的负担。

在考虑第二个问题：如果你看过*Collection*的`map`实现，那应该很清楚，这个操作除了会对列表中的所有*形状*作*map映射*，而且会*创建一个新的集合去存储这些映射后的形状*。这样，相比第一个问题中增加了许多无意义的`map`，这里的问题貌似更加严重，因为我们知道在堆（heap）中创建对象的代价是非常昂贵的，以至于*Kotlin*为了减少因为使用*lamda*而创建的匿名内部类，提供了`inline`关键字做优化。当然，对于数据量小，*operation*少的程序可以忽略。

```kotlin
public inline fun <T, R> Iterable<T>.map(transform: (T) -> R): List<R> {  
    return mapTo(ArrayList<R>(collectionSizeOrDefault(10)), transform)  
}
```

为了解决以上两个问题，*Kotlin*推出了独立于集合框架的新的标准库容器类-*Sequence*，和集合一样， 它提供了相同的函数，所以可以在不用修改原有程序的基础上进行*Collection*与*Sequence*的方便转化，但是实现却完全不一样：传统的集合的多步操作中每一步都是*提前*评估和执行，并且会产生一个*中间（intermediate）*集合；而*Sequence*将多步操作分为两类：中间操作（Intermediate）和终端操作（Terminal），所有的*中间操作*都是尽可能惰性的，只有终端操作开始执行的时候，这些中间操作链才会开始执行，而且没有中间集合的产生。很重要的一点，相对与集合中是完成整个集合的每个步骤，然后进行下一步，*Sequence*对每个元素一个一个地执行所有处理步骤（*one by one*）。

```kotlin
listOf<Shape>(Round(Color.GREEN), Rectangle(Color.BLUE), Diamond(Color.RED), Triangle(Color.BLACK))
    .asSequence()
    .map { it.copy(Color.RED) }
    .first { it is Rectangle }
```

为了更加形象的查看两种容器的执行过程，我们为每个步骤增加后打印。结果如下：

```txt
Collection:

map Round(color=GREEN)
map Rectangle(color=BLUE)
map Diamond(color=RED)
map Triangle(color=BLACK)
first Round(color=RED)
first Rectangle(color=RED)
```

```txt
Sequence:

map Round(color=GREEN)
first Round(color=RED)
map Rectangle(color=BLUE)
first Rectangle(color=RED)
```

可见，*Sequence*完美的解决了上面提出的两个问题。
前面我们提到，*Sequence*只要在执行*终端操作*的时候才会执行*中间操作*，那哪些是*终端操作*呢？其实可以触发`Iterator`执行的操作都是*终端操作*，如`toList`，`forEach`，`sumBy`，`count`等等。

#### 结论

* 对于数量级比较小的集合，并且只有一到两个操作时，这两种容器并没有明显的性能差异。
* 对于数量级大的集合，中间操作的执行和中间集合的创建都是非常昂贵的，推荐使用*Sequence*。

#### Dart语言中的集合

 由于Flutter需要高性能的语言支持，Dart中的内置集合操作虽然没有Kotlin这么丰富，但是它的实现和*Sequence*的实现是同理的。作者基于Google的[dart-quiver](https://pub.dev/packages/quiver)发布了一个新的Package-[wedzera](https://pub.dev/packages/wedzera)，这个库借助Dart extension，为集合拓展了更加丰富，更加常用的操作，都是使用*Sequence*的设计思想，有性能保证。

#### Kotlin中的惰性序列和Dart中的Synchronous generator

两者是很相通的东西，即使实现原理不一样，前者是利用*协程（Coroutine）*。 以下实现一个获取无限自然数的序列

```kotlin
sequence<Int> {  
  var i = 0;  
  while (true) {  
      yield(i++);  
  }  
}.take(100).forEach(::print)
```

```dart
Iterable<int> generator() sync* {  
  var i = 0;  
  while (true) {  
    yield i++;  
  }  
}

void main(List<String> arguments) {  
  generator().take(100).forEach(print);  
}
```

其实Dart中的*Stream* 更像Kotlin中的*Flow*，将来有机会在讨论。
