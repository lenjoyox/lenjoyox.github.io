+++
authors = ["Lenox"]
title = "C语言中的静态库和共享库"
date = "2024-01-25"
description = ""
tags = [
    "静态库",
    "共享库",
]
categories = [
    "C",
]
series = []
disableComments = true
draft = false
+++

```bash
.
├── main
│   └── main.c
└── shapes
    ├── include
    │   └── shapes.h
    └── shapes.c

4 directories, 3 files
```

**shapes** 文件夹是一个平面图形计算库，可计算矩形，圆形的面积和周长。

```c
// include/shapes.h

#ifndef SHAPES_H
#define SHAPES_H

// 定义矩形结构体
typedef struct {
    double length;
    double width;
} Rectangle;

// 定义圆形结构体
typedef struct {
    double radius;
} Circle;

// 计算矩形的面积
double calculateRectangleArea(Rectangle rectangle);

// 计算矩形的周长
double calculateRectanglePerimeter(Rectangle rectangle);

// 计算圆形的面积
double calculateCircleArea(Circle circle);

// 计算圆形的周长
double calculateCirclePerimeter(Circle circle);

#endif
```

```c
// shapes.c

#include "shapes.h"
#include <math.h>

// 计算矩形的面积
double calculateRectangleArea(Rectangle rectangle) {
    return rectangle.length * rectangle.width;
}

// 计算矩形的周长
double calculateRectanglePerimeter(Rectangle rectangle) {
    return 2 * (rectangle.length + rectangle.width);
}

// 计算圆形的面积
double calculateCircleArea(Circle circle) {
    
    return M_PI * circle.radius * circle.radius;
}

// 计算圆形的周长
double calculateCirclePerimeter(Circle circle) {
    return 2 * M_PI * circle.radius;
}
```

**main** 文件夹是一个二进制可执行库，用于测试平面图形计算库

```c
// main.c

#include <stdio.h>
#include "shapes.h"

int main() {
    Rectangle rectangle = {5.0, 3.0};
    Circle circle = {4.0};

    printf("Rectangle Area: %lf\n", calculateRectangleArea(rectangle));
    printf("Rectangle Perimeter: %lf\n", calculateRectanglePerimeter(rectangle));

    printf("Circle Area: %lf\n", calculateCircleArea(circle));
    printf("Circle Perimeter: %lf\n", calculateCirclePerimeter(circle));

    return 0;
}
```

## 创建平面图形计算库的静态链接库

进入平面图形计算库根路径

```bash
cd shapes/
```

```diff
.
├── include
│   └── shapes.h
└── shapes.c

2 directories, 2 files
```

生成目标文件（shapes.o）：

```bash
gcc -c -o shapes.o shapes.c -I include/
```

```diff
 .
 ├── include
 │   └── shapes.h
 ├── shapes.c
+└── shapes.o

 2 directories, 3 files
```

生成静态链接库（libshapes.a）：

```bash
ar rcs libshapes.a shapes.o
```

```diff
 .
 ├── include
 │   └── shapes.h
+├── libshapes.a
 ├── shapes.c
 └── shapes.o

 2 directories, 4 files
```

## 创建平面图形计算库的动态链接库

进入平面图形计算库根路径

```bash
cd shapes/
```

```diff
.
├── include
│   └── shapes.h
└── shapes.c

2 directories, 2 files
```

生成动态链接库（libshapes.so）：

```bash
gcc -shared -o libshapes.so -fPIC shapes.c -I include/
```

```diff
 .
 ├── include
 │   └── shapes.h
+├── libshapes.so
 └── shapes.c

 2 directories, 3 files
```

## 使用静态链接库

进入二进制可执行库根路径

```bash
cd main/
```

```diff
.
└── main.c

1 directory, 1 file
```

编译可执行文件并链接静态库

```bash
gcc -o main main.c -L ../shapes/ -l shapes -I ../shapes/include/
```

```diff
 .
+├── main
 └── main.c

 1 directory, 2 files
```

运行可执行文件

```bash
$ ./main 
Rectangle Area: 15.000000
Rectangle Perimeter: 16.000000
Circle Area: 50.265482
Circle Perimeter: 25.132741
```

查看可执行文件的动态链接库依赖关系以及它们的搜索路径

```bash
$ ldd ./main
    linux-vdso.so.1 (0x00007ffe598e8000)
    libc.so.6 => /lib64/libc.so.6 (0x00007f3cb171b000)
    /lib64/ld-linux-x86-64.so.2 (0x00007f3cb1914000)
```

## 使用动态链接库

进入二进制可执行库根路径

```bash
cd main/
```

```diff
.
└── main.c

1 directory, 1 file
```

编译可执行文件并链接动态库

```bash
gcc -o main main.c -L ../shapes/ -l shapes -I ../shapes/include/
```

```diff
 .
+├── main
 └── main.c

 1 directory, 2 files
```

添加动态链接库的搜索路径

```bash
export LD_LIBRARY_PATH=../shapes/
```

{{< notice info >}}
也可以在编译可执行文件的时候通过 `-Wl,-rpath` 参数直接指定运行库路径，这样就不需要额外添加动态链接库的搜索路径

```bash
gcc -o main main.c -I ../shapes/include/ -Wl,-rpath, ../shapes/libshapes.so
```

查看可执行文件的动态链接库依赖关系以及它们的搜索路径

```diff
 $ ldd ./main
     linux-vdso.so.1 (0x00007ffd778ab000)
+    ../shapes/libshapes.so (0x00007f1526be8000)
     libc.so.6 => /lib64/libc.so.6 (0x00007f15269f1000)
     /lib64/ld-linux-x86-64.so.2 (0x00007f1526bef000)
```

{{< /notice >}}

运行可执行文件

```bash
$ ./main 
Rectangle Area: 15.000000
Rectangle Perimeter: 16.000000
Circle Area: 50.265482
Circle Perimeter: 25.132741
```

查看可执行文件的动态链接库依赖关系以及它们的搜索路径

```diff
 $ ldd ./main
     linux-vdso.so.1 (0x00007ffc98260000)
+    libshapes.so => ../shapes/libshapes.so (0x00007f4f8efeb000)
     libc.so.6 => /lib64/libc.so.6 (0x00007f4f8edf4000)
     /lib64/ld-linux-x86-64.so.2 (0x00007f4f8eff2000)
```

运行可执行文件的同时打印动态链接库的搜索信息

```bash
$ LD_DEBUG=libs ./main 
    151250:     find library=libshapes.so [0]; searching
    151250:      search path=../shapes/glibc-hwcaps/x86-64-v3:../shapes/glibc-hwcaps/x86-64-v2:../shapes                (LD_LIBRARY_PATH)
    151250:       trying file=../shapes/glibc-hwcaps/x86-64-v3/libshapes.so
    151250:       trying file=../shapes/glibc-hwcaps/x86-64-v2/libshapes.so
    151250:       trying file=../shapes/libshapes.so
    151250:
    151250:     find library=libc.so.6 [0]; searching
    151250:      search path=../shapes/glibc-hwcaps/x86-64-v3:../shapes/glibc-hwcaps/x86-64-v2:../shapes                (LD_LIBRARY_PATH)
    151250:       trying file=../shapes/glibc-hwcaps/x86-64-v3/libc.so.6
    151250:       trying file=../shapes/glibc-hwcaps/x86-64-v2/libc.so.6
    151250:       trying file=../shapes/libc.so.6
    151250:      search cache=/etc/ld.so.cache
    151250:       trying file=/lib64/libc.so.6
    151250:
    151250:
    151250:     calling init: /lib64/ld-linux-x86-64.so.2
    151250:
    151250:
    151250:     calling init: /lib64/libc.so.6
    151250:
    151250:
    151250:     calling init: ../shapes/libshapes.so
    151250:
    151250:
    151250:     initialize program: ./main
    151250:
    151250:
    151250:     transferring control: ./main
    151250:
Rectangle Area: 15.000000
Rectangle Perimeter: 16.000000
Circle Area: 50.265482
Circle Perimeter: 25.132741
    151250:
    151250:     calling fini:  [0]
    151250:
    151250:
    151250:     calling fini: ../shapes/libshapes.so [0]
    151250:
    151250:
    151250:     calling fini: /lib64/libc.so.6 [0]
    151250:
    151250:
    151250:     calling fini: /lib64/ld-linux-x86-64.so.2 [0]
    151250:
```

{{< notice question >}}
当同名的动态链接库和静态连接库在同一目录时，会优先链接哪个？
{{< /notice >}}

进入平面图形计算库根路径

```bash
cd shapes/
```

```diff
 .
 ├── include
 │   └── shapes.h
+├── libshapes.a
+├── libshapes.so
 ├── shapes.c
 └── shapes.o

 2 directories, 5 files
```

进入二进制可执行库根路径

```bash
cd main/
```

```diff
.
└── main.c

1 directory, 1 file
```

链接平面图形计算库

```bash
gcc -o main main.c -L ../shapes/ -l shapes -I ../shapes/include/
```

```diff
 .
+├── main
 └── main.c

 1 directory, 2 files
```

查看可执行文件的动态链接库依赖关系以及它们的搜索路径

```diff
 $ ldd main
     linux-vdso.so.1 (0x00007ffc24b27000)
+    libshapes.so => ../shapes/libshapes.so (0x00007f7350c14000)
     libc.so.6 => /lib64/libc.so.6 (0x00007f7350a1d000)
     /lib64/ld-linux-x86-64.so.2 (0x00007f7350c1b000)
```

{{< notice note >}}
优先链接动态链接库
{{< /notice >}}
