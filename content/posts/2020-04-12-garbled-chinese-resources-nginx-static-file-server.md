+++
authors = ["Lenox"]
title = "访问Nginx静态文件服务器中文资源遇到的乱码问题"
date = "2020-04-12"
description = ""
tags = [
    "Nginx",
]
categories = [
    "Server",
]
series = []
disableComments = true
draft = false
+++

>这篇文章属于Nginx系列，主要涉及到：1.Nginx编译流程；2.如何编译Nginx动态模块（这里指[[headers-more-nginx-module](https://github.com/openresty/headers-more-nginx-module)]）；3.Flutter/Dart [http](https://pub.dev/packages/http)网络框架；4.HTTP response header。

众所周知，Nginx相比Apache，具有负载均衡，优秀的高并发处理能力，轻量级，高效的的静态资源处理等优点。利用Nginx的反向代理能力，将动态内容的请求转发给其他更合适的动态服务器处理，将静态资源的请求交给自己处理，达到优势互补的目的。这里聊一下访问Nginx静态文件服务器中文资源遇到的乱码的问题，并如何解决。

### 起因

在Flutter开发中，需要使用[dartrofit](https://pub.dev/packages/dartrofit)(底层是基于[http](https://pub.dev/packages/http)框架)作为网络引擎去获取远程Nginx静态资源服务器上的指定内容，由于起初服务器上的资源都是英文资源，所以并没有发现什么问题，但是当加入了一些中文资源后，发现获取到的内容都是乱码，通过Debug，发现框架解析后的数据确实是乱码，所以首先查看`http`框架源码的实现逻辑：

```dart
response.dart

/// The body of the response as a string.  
///  
/// This is converted from [bodyBytes] using the `charset` parameter of the  
/// `Content-Type` header field, if available. If it's unavailable or if the  
/// encoding name is unknown, [latin1] is used by default, as per  
/// [RFC 2616][].  
///  
/// [RFC 2616]: http://www.w3.org/Protocols/rfc2616/rfc2616-sec3.html  
String get body => _encodingForHeaders(headers).decode(bodyBytes);
```

很显然，这里是 `bodyBytes` =>`String`的解析过程，并且从注释可以了解到，解析所使用的`charset`来自于Response Headers中的Content-Type字段，如果字段中没有charset，则使用`latin1`编码方式，如果通过这种编码中文，则必然会乱码，为了正确解析，需要使用`UTF-8`编码。

```dart
response.dart

/// Returns the encoding to use for a response with the given headers.  
///  
/// Defaults to [latin1] if the headers don't specify a charset or if that  
/// charset is unknown.  
Encoding _encodingForHeaders(Map<String, String> headers) =>  
    encodingForCharset(_contentTypeForHeaders(headers).parameters['charset']);

/// Returns the [MediaType] object for the given headers's content-type.  
///  
/// Defaults to `application/octet-stream`.  
MediaType _contentTypeForHeaders(Map<String, String> headers) {  
  var contentType = headers['content-type'];  
 if (contentType != null) return MediaType.parse(contentType);  
 return MediaType('application', 'octet-stream');  
}
```

当然，一种解决方案是，在不更改服务器代码的情况下，可以在客户端手动解析，编码方式采用`UTF-8`:

```dart
import 'dart:convert';

utf8.decode(body.bytes);
```

这种硬编码的解决方式并不提倡，Content-Type的作用就是用来告诉访问者文件的类型,编码，如`text/html`， `text/markdown; charset=utf-8`，等。所以为了根治这个问题，需要从源头入手：在Response Headers中的Content-Type中加入charset字段。

### 踩坑

由于起初对Nginx的了解不深入，通过以下Nginx代码添加Header：

```txt
nginx.conf

server {
 ...
 location ^~ /static/posts/ {
  ...
  if ($request_uri ~ . *\.(md)$) {
   add_header 'Content-Type: text/markdown; charset=utf-8';
  }
 }
 ...
}
```

执行`nginx -t`进行语法检查通过后执行`nginx -s reload`重新部署。测试连接，发现上述语法确实生效，但是，出现了两个Content-Type：一个没有charset字段，一个有charset字段。这时候通过多年编程经验意识到，这里应该是**set**而非**add**，但是Nginx并没有提供**set**功能，经过查阅资料，发现有一个开源的Nginx Module-[headers-more-nginx-module](https://github.com/openresty/headers-more-nginx-module)，根据文档介绍，这个库就是用来 *Set and clear input and output headers...more than "add"!*，但是**This module is not distributed with the Nginx source.**，所以就需要重新编译Nginx，替换现有的。

### 编译Nginx(with headers-more-nginx-module)

编译环境：

- OS: Fedora 31,
- Nginx Version: 1.16.0([兼容性](https://github.com/openresty/headers-more-nginx-module#compatibility))
- Module version: 0.33

下载Nginx，headers-more-nginx-module源码，解压Nginx并cd到解压目录执行

```shell
./configure --prefix=path/to/nginx/ --add-module=/path/to/headers-more-nginx-module --with-http_v2_module --with-http_ssl_module
```

注意后面的两个--with*是让Nginx支持http2和https，可选，在configure过程中可能需要安装以下缺少的依赖，如PCRE Library，zlib等，需要自己手动安装。配置完成后执行

```shell
make
make install
```

编译完成。
查询正在运行的Nginx服务并Kill，重新配置**nginx.conf**

```txt
nginx.conf

...
load_module /path/to/nginx/modules/ngx_http_headers_more_filter_module.so;
...

server {
 ...
 location ^~ /static/posts/ {
  ...
  if ($request_uri ~ . *\.(md)$) {
   more_set_headers 'Content-Type: text/markdown; charset=utf-8';
  }
 }
 ...
}
```

1. 显示的通过`load_module`指令加载[headers-more-nginx-module](https://github.com/openresty/headers-more-nginx-module)。
2. 使用`more_set_headers`指令替换`add_header`指令。

重新部署后，问题得以解决
