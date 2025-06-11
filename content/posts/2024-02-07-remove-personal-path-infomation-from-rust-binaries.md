+++
authors = ["Lenox"]
title = "移除Rust构建的二进制中的个人敏感信息"
date = "2024-02-07"
description = ""
tags = [
    "Rust",
    "binaries",
]
categories = [
    "Rust",
]
series = []
disableComments = true
draft = false
+++

当我们使用命令行: 

`$ cargo build --release --target aarch64-linux-android` 

或使用 [org.mozilla.rust-android-gradle.rust-android](https://github.com/mozilla/rust-android-gradle) gradle plugin: 

```groovy
plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    id "org.mozilla.rust-android-gradle.rust-android"
}

android.libraryVariants.configureEach { LibraryVariant variant ->
    tasks.named("merge${variant.name.capitalize()}JniLibFolders").get().dependsOn 'cargoBuild'
}

cargo {
    module  = "src/rust/hansome"       // Or whatever directory contains your Cargo.toml
    libname = "hansome"          // Or whatever matches Cargo.toml's [package] name.
    targets = ["arm", "arm64"]  // See bellow for a longer list of options
    profile = "release"
}

tasks.named("clean", Delete) {
    delete(project.layout.buildDirectory)
    delete(project.file(cargo.module + "/target"))
}
```

构建一个可以在 Android 平台上运行的动态链接库后，我们可以使用任何的二进制查看工具查看生成的 so, 会有很多明文的字符串, 例如：

```txt
error: entered unreachable code/Users/enjoy/.cargo/registry/src/index.crates.io-6f17d22bba15001f/serde_json-1.0.138/src/de.rsstruct 
```

关键的问题是里面会包含我们的设备用户名: `/Users/enjoy`, 具体的内容我们可以在终端里输入: `$ echo $HOME` 获取.
这是不可接受的，在一些安全的领域，这会泄漏我们的敏感信息，如何解决呢:

```diff
 cargo {
     module  = "src/rust/hive"       // Or whatever directory contains your Cargo.toml
     libname = "hive"          // Or whatever matches Cargo.toml's [package] name.
     targets = ["arm", "arm64"]  // See bellow for a longer list of options
     profile = "release"
+    exec { spec, toolchain ->
+        def modulePath = project.file(cargo.module)
+        def home = System.getProperty("user.home")
+        spec.environment("CARGO_BUILD_RUSTFLAGS", "--remap-path-prefix=$home=/ArcticFox --remap-path-prefix=${modulePath}=/BlueWhale")
+    }
 }
```

如上所示，我们可以通过 `--remap-path-prefix` 解决， 通过上面的配置，`/Users/enjoy` 会被替换成 `/ArcticFox`, 从而移除敏感信息。

#### Link
-[buildrustflags](https://doc.rust-lang.org/cargo/reference/config.html#buildrustflags)
