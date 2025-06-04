+++
authors = ["Lenox"]
title = "Flutter State Management"
date = "2020-05-03"
description = ""
tags = [
    "State Management",
]
categories = [
    "Flutter",
]
series = []
disableComments = true
draft = false
+++

>这篇文章是Flutter state management系列的一部分。讨论的是在Flutter中是如何原生支持状态管理，当然，这部分API可能比较low-level，但是pub.dev上一些受欢迎的状态管理库(比如 provider)的底层都是基于此，所以了解其实现原理相当重要，这也是这篇文章的重点。

### 前言

作者原来从事Android开发，习惯了使用`findViewById`这种在命令式UI编程（imperative style of UI programming）环境下数据共享（Flutter中称作共享状态*shared state*）的方式，但Flutter采用的是声明式UI编程（declarative style of UI programming），没有习惯的 `findViewById` 或者 `Text.setText()`，所以转换原来的思维，用新的思想去考虑这种编程范式，寻找合适的状态管理模式。

### 状态

*UI = f( state )*，这个有趣的公式的解释了为什么Flutter是声明式的，描述了 *state* 和 *ui* 之间的关系，这表示Flutter会构建其用户界面以反映应用的当前状态。Flutter将状态分为两类：暂时状态（Ephemeral state）和 App状态（App state），前者往往只存在与单一控件中，随控件的销毁而回收，不需要与其他控件共享其状态，这不需要使用状态管理技术；后者与前者相反，其往往可能需要在应用的多个部分之间共享，观察（订阅）/通知更新是常见的操作，比如说电商应用的购物车，在购物页面可以将需要购买的商品放入购物车中，在购物车页面可以进行删除商品，在支付页面需要计算购物车中的所有商品的价格，这都需要利用状态管理技术才能优雅的实现。

### 简单用法

在这里，我们举一个比较简单例子来说明`InheritedModel`是如何使用的，然后从用法了解其底层实现原理。我们将利用Flutter 默认的Application项目，但是我们修改其`AppBar`中 `title`的来源：从原来的从构造器传入修改为从父控件（这里指 `InheritedModel`）中获取，因为`InheritedModel`间接继承于`Widget`，所以它其实就是一个`Widet`，可以用来构建UI tree中的一个`Element`。这里，我们将`title`存入新创建的`InheritedModel`的子类`MyModel`中，这样所有的`children`都可以获取到这个`title`，在这里，这个`title`只用于`AppBar`。

```dart
class MyModel extends InheritedModel<String> {  
  const MyModel(this.title, {Key key, Widget child})  
      : super(key: key, child: child);  
  
  /// AppBar title  
  final String title;  
  
 static MyModel of(BuildContext context) {  
    return InheritedModel.inheritFrom<MyModel>(context, aspect: null);  
  }  
  
  @override  
  bool updateShouldNotify(InheritedWidget oldWidget) {  
    return true;  
  }  
  
  @override  
  bool updateShouldNotifyDependent(  
      InheritedModel<String> oldWidget, Set<String> dependencies) {  
    return true;  
  }  
}

class MyApp extends StatelessWidget {  
  // This widget is the root of your application.  
  @override  
  Widget build(BuildContext context) {  
    return MaterialApp(  
      title: 'Flutter Demo',  
      theme: ThemeData(...),  
      home: MyModel('Flutter Demo Home Page', child: MyHomePage()),  
    );  
  }  
}  
  
class MyHomePage extends StatefulWidget {  
  MyHomePage({Key key}) : super(key: key);  
  
  @override  
  _MyHomePageState createState() => _MyHomePageState();  
}  
  
class _MyHomePageState extends State<MyHomePage> {  
  ... 
  @override  
  Widget build(BuildContext context) {  
    return Scaffold(  
      appBar: AppBar(  
        title: Text(MyModel.of(context).title),  
   )
   ...
     );  
  }  
}
```

#### 如何从 Child Widget 获取到 指定 Parent Widget?

要使你需要共享的 *Parent Widget*能够被它的`Children`发现，你的 *Parent Widget*需要继承自`InheritedWidget`（当然，`InheritedModel` 也是继承自`InheritedWidget`），`InheritedWidget`的官方解释是*Base class for widgets that efficiently propagate information down the tree.*，那它是如何传播信息的呢？正向的思路不太容易知道，但是我们可以反向来，我们研究从子控件是如何获取上层控件反推，就可以发现其所以然。
在子控件中是通过`MyModel.of(context)`这样一个 *model-specific  static of method* 获取`MyModel`的，看到这种方法定义，想必每个Flutter开发者都很面熟，的确，这种状态管理技术已经广泛的应用到Flutter framework中，例如`Theme.of(context)`，`MediaQuery.of(context)`，这应该算作是一种规范，应该是所有Flutter开发者都应该遵守的。

```dart
static MyModel of(BuildContext context) {  
  return InheritedMdel.inheritFrom<MyModel>(context, aspect: null);  
}
```

这个静态方法内部调用了`InheritedModel`的泛型静态方法`inheritFrom`，我们先忽略第二个参数。

```dart
static T inheritFrom<T extends InheritedModel<Object>>(BuildContext context, { Object aspect }) {  
    if (aspect == null)  
      return context.dependOnInheritedWidgetOfExactType<T>();  
    ...   
}
```

当`aspect`为`null`的时候，它又调用了`BuildContext`的成员方法`dependOnInheritedWidgetOfExactType`，继续进入这个方法，发现它定义在`Element`中，在这里我们其实可以猜测一个其他的东西，我们所用到的`BuildContext`其实都是`Element`的实现，通过下面的源码证实了这一点：

```dart
class: State

/// The location in the tree where this widget builds.  
///  
/// The framework associates [State] objects with a [BuildContext] after  
/// creating them with [StatefulWidget.createState] and before calling  
/// [initState]. The association is permanent: the [State] object will never  
/// change its [BuildContext]. However, the [BuildContext] itself can be moved  
/// around the tree.  
///  
/// After calling [dispose], the framework severs the [State] object's  
/// connection with the [BuildContext].  
BuildContext get context => _element;  
StatefulElement _element;
```

```dart
class: StatefulElement

@override  
Widget build() => _state.build(this);
```

这不是这篇文章的重点，我们继续查看`dependOnInheritedWidgetOfExactType`的实现，方法的第二行是说要从`_inheritedWidgets`这个`Map`中根据`Key`去获取对于的`InheritedElement`，注意，这里至关重要，这是我们反推的开始点，我们在继续查看下面的逻辑，如果找到，则相互添加自己为依赖，最后，从查到的这个`InheritedElement`中获取`Widget`并作强制类型转换返回。

```dart
class: Element

@override  
T dependOnInheritedWidgetOfExactType<T extends InheritedWidget>({Object aspect}) {  
  assert(_debugCheckStateIsActiveForAncestorLookup());  
 final InheritedElement ancestor = _inheritedWidgets == null ? null : _inheritedWidgets[T];  
 if (ancestor != null) {  
    assert(ancestor is InheritedElement);  
 return dependOnInheritedElement(ancestor, aspect: aspect) as T;  
  }  
  _hadUnsatisfiedDependencies = true;  
 return null;}
```

现在我们开始从上述提到的关键点开始反推，往`_inheritedWidgets`这个`Map`中设置数据是开始点，在整个*Element*类中只有一个方法是用来给`_inheritedWidgets`设置数据的：

```dart
class: Element

void _updateInheritance() {  
  assert(_active);  
  _inheritedWidgets = _parent?._inheritedWidgets;  
}
```

这个方法调用出在`mount`方法

```dart
@mustCallSuper  
void mount(Element parent, dynamic newSlot) {  
  assert(_debugLifecycleState == _ElementLifecycle.initial);  
 assert(widget != null);  
 assert(_parent == null);  
 assert(parent == null || parent._debugLifecycleState == _ElementLifecycle.active);  
 assert(slot == null);  
 assert(depth == null);  
 assert(!_active);  
  _parent = parent;  
  _slot = newSlot;  
  _depth = _parent != null ? _parent.depth + 1 : 1;  
  _active = true;  
 if (parent != null) // Only assign ownership if the parent is non-null  
  _owner = parent.owner;  
 final Key key = widget.key;  
 if (key is GlobalKey) {  
    key._register(this);  
  }  
  _updateInheritance();  
 assert(() {  
    _debugLifecycleState = _ElementLifecycle.active;  
 return true;  }());  
}
```

熟悉Flutter UI构建流程的人都知道，这是`Element`被添加到Tree的入口方法，所以，我们可以清楚的认识到，`_inheritedWidgets`是在UI Tree构建过程中逐步的从父节点继承下来的，由于我们的`MyModel`控件是一个`InheritedWidget`，所以，`InheritedElement`使用`MyModel`的来配置，由于`InheritedElement`是继承自`Element`，所以它也具有`_updateInheritance()`，由于它是`InheritedElement`唯一可提供者，所以它需要override这个方法，提供`_inheritedWidgets`，供下层节点使用。

```dart
@override  
void _updateInheritance() {  
  assert(_active);  
 final Map<Type, InheritedElement> incomingWidgets = _parent?._inheritedWidgets;  
 if (incomingWidgets != null)  
    _inheritedWidgets = HashMap<Type, InheritedElement>.from(incomingWidgets);  
 else  
  _inheritedWidgets = HashMap<Type, InheritedElement>();  
  _inheritedWidgets[widget.runtimeType] = this;  
}
```

这样，`MyModel`下的所有`Children`都可以获取到`MyModel`这个*Ancestor*，貌似有点`findViewById`的味道。

状态管理参考[Flutter 官方文档](https://flutter.dev/docs/development/data-and-backend/state-mgmt/intro)
