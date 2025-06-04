+++
authors = ["Lenox"]
title = "TimeConsumingPageBuilder"
date = "2020-09-02"
description = ""
tags = [
    "Widget",
]
categories = [
    "Flutter",
]
series = []
disableComments = true
draft = false
+++

无论使用哪种操作系统，无论使用哪种UI工具包，对于耗时加载的页面的处理，我们通常分为以下几种情况：

- 加载中
- 异常
- 有效数据
- 空数据

其中，`有效数据`和`空数据`都处于加载成功阶段的两个分支，具体的分支流向可根据不同的业务逻辑独立实现。
在整个加载过程中，如果`异常`发生，可选的向用户说明异常原因，另外一个好的用户体验是，提供给用户重新加载的机会。

### timeconsuming_page_builder

这是一个`Flutter Package`，支持 Flutter 全平台，极大的降低了耗时页面中代码逻辑的复杂度，提高代码的可读性。为了方便使用者测试（当然，如果不介意，也可以用于生产环境中），该库也提供了额外三个`Widget`：

- `BuiltInWaitingWidget`：这是一个显示了友好的加载中动画的页面。
- `BuiltInErrorWidget`：这是一个添加了`重试`按钮的异常页面。
- `BuiltInEmptyWidget`：这是一个向用户说明没有可用的内容的页面。

#### TimeConsumingPageBuilder

这是耗时页面的核心`Widget`，它包含四个标记了`@required`的  *Named Parameters*：

- `futureBuilder`：这是耗时页面的数据源，`Widget`从这个构建器中异步请求数据，返回一个`Future`。
- `waitingWidgetBuilder`：这是一个用于构建加载中控件的构建器，返回一个`Widget`。值得注意的是，这个构建器提供了一个名叫`RetryCaller`的可执行函数对象，可通过`caller()`进行重新加载。
- `errorWidgetBuilder`：这是一个用于构建异常控件的构建器，返回一个`Widget`。
- `dataWidgetBuilder`：这是一个用于构建数据或空内容控件的构建器，返回一个`Widget`。

### 代码实例

这是一个使用[dartrofit](https://pub.dev/packages/dartrofit)作为网络引擎从服务端请求markdown资源并使用[Flutter Markdown](https://pub.dev/packages/flutter_markdown)将其显示在`Flutter Widget`上的例子。

```dart
import 'package:timeconsuming_page_builder/timeconsuming_page_builder.dart';

@override  
Widget build(BuildContext context) {  
  final post = ModalRoute.of(context).settings.arguments as Post;  
  return Scaffold(  
    appBar: AppBar(...),
    body: TimeConsumingPageBuilder<ResponseBody>(  
        futureBuilder: () => Api(dartrofit).getContent(post.path),
        waitingWidgetBuilder: (BuildContext context) => ...,
        errorWidgetBuilder: (BuildContext context, RetryCaller caller) => ...,
        dataWidgetBuilder: (BuildContext context, ResponseBody body) {  
          if (body.string.orEmpty().isEmpty) {  
            return BuiltInEmptyWidget();
          }  
          return SafeArea(child: Markdown(controller: controller,
                      selectable: true,
                      data: body.string)
          );
        }
    ),
  ); 
}
```

#### [Github](https://github.com/nikeorever/timeconsuming_page_builder)

#### [Pub.dev](https://pub.dev/packages/timeconsuming_page_builder)
