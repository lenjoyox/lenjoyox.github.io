+++
authors = ["Lenox"]
title = "在Flutter中平滑的展示图片"
date = "2022-08-01"
description = ""
tags = [
    "Image",
    "Placeholder"
]
categories = [
    "Flutter",
]
series = []
disableComments = true
draft = false
+++

想在 Flutter 加载并展示一张网络图片，我们可以使用 `NetworkImage` 这个 Widget, 但由于网路延时可能会导致加载过程中图片展示非常的突兀，给用户带来很不好的效果。

Flutter 框架提供了 `FadeInImage` 来帮助我们解决这个问题，我们需要给这个 Widget 传递一个占位图 `placeholder`, 网络图片加载过程中会先给用户展示这个占位图， 当图片加载完毕后，会展示真正的图片，并附带渐变效果。但这个 `placeholder` 必须是个 `ImageProvider`, 这个 Widget 也同时提供了两个命名构造器, 指示 `placeholder` 的两种来源:
 - `FadeInImage.assetNetwork`: Asset占位图
 - `FadeInImage.memoryNetwork`: 内存占位图

 如果我们只想占位图是透明的，然后让真正的图片淡出，那其实让 Widget 作为占位图是最好的，这样我们也不需要提供一张额外的图片，显然 `FadeInImage` 无法满足这种情况，这时候我们可以自定义一个 Widget 实现这个功能

 ```dart
class ImageWidgeetPlaceholder extends StatelessWidget {
  final ImageProvider image;
  final Widget placeholder;

  const ImageWidgeetPlaceholder({
    super.key,
    required this.image,
    required this.placeholder,
  });

  @override
  Widget build(BuildContext context) {
    return Image(
      image: image,
      frameBuilder: (context, child, frame, wasSynchronouslyLoaded) {
        if (wasSynchronouslyLoaded) {
          return child;
        } else {
          return AnimatedSwitcher(
            duration: const Duration(milliseconds: 500),
            child: frame == null ? placeholder : child,
          );
        }
      },
    );
  }
}
```

`frameBuilder` 可以让我们细颗粒的控制图片帧的加载和展示过程， 这个 builder 函数在图片加载过程中可能会回调多次，也可能会回调一次。`child` 表示最终加载到图片 Widget, 当 `frame` 不为 `null` 的时候， 表示图片帧加载完毕， 此时我们就可以把 `child` 显示给用户， 否则，表示图片正在加载中，我们可以给用户现展示一个默认的 `placeholder`, `frame` 的值从0开始，图片的第一帧为0, 如果加载的图片是 Gif， 这他的值将会从0开始叠加，取决于 Gif 图里的静态图数目。 `AnimatedSwitcher` 可以让 `placeholder` 到真正图片的展示过程更加平滑(A widget that by default does a cross-fade between a new widget and the widget previously set on the [AnimatedSwitcher] as a child.); `wasSynchronouslyLoaded` 表示图片是否可以被同步加载，还句话说，当 Widget 渲染的时候，图片就可以正常加载，无需等待，这种加载速度最快，当我们向 `ImageWidgeetPlaceholder` 的 `image` 传递 `AssetImage`, 或已经加载过的网络图片，这个参数将为true, 因此这种情况下，我们直接将起显示出来就行了，无需动画。

![img](/images/smooth_show_image_done.gif)