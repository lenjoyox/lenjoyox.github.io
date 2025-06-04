+++
authors = ["Lenox"]
title = "如何加载并使用Dex？"
date = "2021-05-22"
description = ""
tags = [
    "Dex"
]
categories = [
    "Android",
]
series = []
disableComments = true
draft = false
+++

之前的一篇 [Post](https://nikeo.cn/posts/2021-05-02-dx-d8-r8/) 解释了一下如何使用 DX/D8/R8 去生产 Dex, 这里我们讨论下如何在运行中加载并使用 Dex

我们先简单梳理下 Android 的类加载机制，类加载遵循 **双亲委托机制**, 在加载一个类的时候，类加载器首先检查这个类是否已经被自身加载，如果没有，则委托给 `parent` 父加载器加载而不是让自身去加载，接着`parent` 父加载器同样也会检查是否以及加载过这个类，如果加载过，则返回，否则继续委托给更上一级的`parent` 父加载器去加载，直到达到链路的顶端，顶端的加载器如果加载失败的话，则逐级向下交给子加载器去加载，以此类推，直到最后才会交给自己去查找。

向上是 `loadClass` 的过程， 向下是 `findClass` 的过程

这样设计的好处有以下几点

- 避免重复加载，如果一个类已经被加载过一次，则不需要重复加载，直接读取加载过的 `Class` 即可
- 确保任意一个类在虚拟机的唯一性，由加载它的类加载器和这个类的全类名一同确立其在虚拟机中的唯一性。不同的类加载器加载同一个class文件得到的不是同一个class对象
- 安全，保证系统类不能被篡改。通过委托方式可以保证系统类的加载逻辑不会被篡改。假如我们自定义一个`String` 类来替代系统的 `String` 类，就会造成安全隐患，但是使用双亲委托就会使得系统的 `String` 类在虚拟机启动时就被加载，也就无法通过自定义 `String` 类来替代系统的 `String` 类
- 只有当两个类名完全一致并且被同一个类加载器所加载的类，虚拟机才会认为它们是同一个类

Android 中的类加载器包含 **系统加载器** 和 **自定义加载器**, 系统加载器包含`BootClassLoader`, `PathClassLoader`, `DexClassLoader`

- `BootClassLoader`: 最顶层的类加载器，由 Android 系统加载 Framework 中的 Class
- `PathClassLoader`: 继承自 `BaseDexClassLoader`, Android 系统用它来记载自己的系统类和应用程序中的类，通常用来加载已安装的 apk 的 dex 文件，实际上外部存储的 dex 文件也能加载。
- `DexClassLoader`: 继承自 `BaseDexClassLoader`, 可以加载 dex 文件以及包含 dex 的压缩文件（apk，dex，jar，zip），不管加载哪种文件，最终都要加载 dex 文件。Android8.0 之后和 `PathClassLoader` 无异。

```java
/**
 * Base class for common functionality between various dex-based
 * {@link ClassLoader} implementations.
 */
public class BaseDexClassLoader extends ClassLoader {

    /**
     * Hook for customizing how dex files loads are reported.
     *
     * This enables the framework to monitor the use of dex files. The
     * goal is to simplify the mechanism for optimizing foreign dex files and
     * enable further optimizations of secondary dex files.
     *
     * The reporting happens only when new instances of BaseDexClassLoader
     * are constructed and will be active only after this field is set with
     * {@link BaseDexClassLoader#setReporter}.
     */
    /* @NonNull */ private static volatile Reporter reporter = null;

    @UnsupportedAppUsage
    private final DexPathList pathList;

    /**
     * Constructs an instance.
     * Note that all the *.jar and *.apk files from {@code dexPath} might be
     * first extracted in-memory before the code is loaded. This can be avoided
     * by passing raw dex files (*.dex) in the {@code dexPath}.
     *
     * @param dexPath the list of jar/apk files containing classes and
     * resources, delimited by {@code File.pathSeparator}, which
     * defaults to {@code ":"} on Android.
     * @param optimizedDirectory this parameter is deprecated and has no effect since API level 26.
     * @param librarySearchPath the list of directories containing native
     * libraries, delimited by {@code File.pathSeparator}; may be
     * {@code null}
     * @param parent the parent class loader
     */
    public BaseDexClassLoader(String dexPath, File optimizedDirectory,
            String librarySearchPath, ClassLoader parent) {
        this(dexPath, librarySearchPath, parent, null, null, false);
    }

    @Override
    protected Class<?> findClass(String name) throws ClassNotFoundException {
        // First, check whether the class is present in our shared libraries.
        if (sharedLibraryLoaders != null) {
            for (ClassLoader loader : sharedLibraryLoaders) {
                try {
                    return loader.loadClass(name);
                } catch (ClassNotFoundException ignored) {
                }
            }
        }
        // Check whether the class in question is present in the dexPath that
        // this classloader operates on.
        List<Throwable> suppressedExceptions = new ArrayList<Throwable>();
        Class c = pathList.findClass(name, suppressedExceptions);
        if (c != null) {
            return c;
        }
        // Now, check whether the class is present in the "after" shared libraries.
        if (sharedLibraryLoadersAfter != null) {
            for (ClassLoader loader : sharedLibraryLoadersAfter) {
                try {
                    return loader.loadClass(name);
                } catch (ClassNotFoundException ignored) {
                }
            }
        }
        if (c == null) {
            ClassNotFoundException cnfe = new ClassNotFoundException(
                    "Didn't find class \"" + name + "\" on path: " + pathList);
            for (Throwable t : suppressedExceptions) {
                cnfe.addSuppressed(t);
            }
            throw cnfe;
        }
        return c;
    }
}
```

- `dexPath`： Dex 文件以及包含 Dex 的 apk 文件或者 jar 文件的路径集合，多个路径用文件分隔符分隔，默认文件分隔符为“:”。
- `optimizedDerectory`: Android系统将 Dex 文件进行优化后所生成的 ODEX 文件的存放路径，该路径必须是一个内部存储路径。在一般情况下，使用当前应用程序的私有路径： `data/data/< Package Name> /...。`
- `librarySearchPath`: 所使用到的 C/C++ 库存放的路径
- `parent`: 父加载器

`optimizedDirectory` 参数就是 dexopt 的产出目录(odex)。那 `PathClassLoader` 创建时，这个目录为 `null`，就意味着不进行 dexopt？并不是，`optimizedDirectory` 为 `null` 时的默认路径为：/data/dalvik-cache。`optimizedDirectory` 这个参数在 API26 的时候被谷歌废弃掉了，可以看到 `DexClassLoader` 中即使传递了这个参数，在 `super` 调用中，传递的值也是 `null`，而且查看 `PathClassLoader` 和 `DexClassLoader` 的 `super` 调用，会发现代码是一样的，那么也就是说在Android8.0之后，这两个 ClassLoader 是没有区别的。

**dex** 和 **odex** 区别：
一个APK是一个程序压缩包，里面有个执行程序包含 dex 文件，ODEX优化就是把包里面的执行程序提取出来，就变成ODEX文件。因为你提取出来了，系统第一次启动的时候就不用去解压程序压缩包，少了一个解压的过程。这样的话系统启动就加快了。为什么说是第一次呢？是因为DEX版本的也只有第一次会解压执行程序到/data/dalvik-cache（针对 `PathClassLoader`）或者 `optimizedDirectory` (针对`DexClassLoader` ）目录，之后也是直接读取目录下的的dex文件，所以第二次启动就和正常的差不多了。当然这只是简单的理解，实际生成的 ODEX 还有一定的优化作用。ClassLoader 只能加载内部存储路径中的dex文件，所以这个路径必须为内部路径。

我们希望使用默认的类加载器(`PathClassLoader`)就可以加载到外部Dex中类，那我们就需要把我们的Dex路径直接添加到默认类加载器(`PathClassLoader`)的搜寻路径中。`PathClassLoader` 继承自 `BaseDexClassLoader`, 按照上述的双亲委托机制，实际的类加载过程在 `findClass` 方法里, 内部又是通过 `pathList.findClass` 查找类， `pathList` 的类型为 `DexPathList`

```java
public final class DexPathList {

    /**
     * List of dex/resource (class path) elements.
     * Should be called pathElements, but the Facebook app uses reflection
     * to modify 'dexElements' (http://b/7726934).
     */
    @UnsupportedAppUsage
    private Element[] dexElements;


    /**
     * Finds the named class in one of the dex files pointed at by
     * this instance. This will find the one in the earliest listed
     * path element. If the class is found but has not yet been
     * defined, then this method will define it in the defining
     * context that this instance was constructed with.
     *
     * @param name of class to find
     * @param suppressed exceptions encountered whilst finding the class
     * @return the named class or {@code null} if the class is not
     * found in any of the dex files
     */
    public Class<?> findClass(String name, List<Throwable> suppressed) {
        for (Element element : dexElements) {
            Class<?> clazz = element.findClass(name, definingContext, suppressed);
            if (clazz != null) {
                return clazz;
            }
        }

        if (dexElementsSuppressedExceptions != null) {
            suppressed.addAll(Arrays.asList(dexElementsSuppressedExceptions));
        }
        return null;
    }

    private static Element[] makeDexElements(List<File> files, File optimizedDirectory,
            List<IOException> suppressedExceptions, ClassLoader loader, boolean isTrusted) {
      Element[] elements = new Element[files.size()];
      int elementsPos = 0;
      /*
       * Open all files and load the (direct or contained) dex files up front.
       */
      for (File file : files) {
          if (file.isDirectory()) {
              // We support directories for looking up resources. Looking up resources in
              // directories is useful for running libcore tests.
              elements[elementsPos++] = new Element(file);
          } else if (file.isFile()) {
              String name = file.getName();

              DexFile dex = null;
              if (name.endsWith(DEX_SUFFIX)) {
                  // Raw dex file (not inside a zip/jar).
                  try {
                      dex = loadDexFile(file, optimizedDirectory, loader, elements);
                      if (dex != null) {
                          elements[elementsPos++] = new Element(dex, null);
                      }
                  } catch (IOException suppressed) {
                      System.logE("Unable to load dex file: " + file, suppressed);
                      suppressedExceptions.add(suppressed);
                  }
              } else {
                  try {
                      dex = loadDexFile(file, optimizedDirectory, loader, elements);
                  } catch (IOException suppressed) {
                      /*
                       * IOException might get thrown "legitimately" by the DexFile constructor if
                       * the zip file turns out to be resource-only (that is, no classes.dex file
                       * in it).
                       * Let dex == null and hang on to the exception to add to the tea-leaves for
                       * when findClass returns null.
                       */
                      suppressedExceptions.add(suppressed);
                  }

                  if (dex == null) {
                      elements[elementsPos++] = new Element(file);
                  } else {
                      elements[elementsPos++] = new Element(dex, file);
                  }
              }
              if (dex != null && isTrusted) {
                dex.setTrusted();
              }
          } else {
              System.logW("ClassLoader referenced unknown path: " + file);
          }
      }
      if (elementsPos != elements.length) {
          elements = Arrays.copyOf(elements, elementsPos);
      }
      return elements;
    }
}
```

内部又实际是通过遍历 `dexElements`, 在每个 `Element` 是否查询到指定类， 我们修改的就是这个数组，我们使用 `makeDexElements` 方法创建一个包含我们自己 Dex 的数组，然后将原来的数组和新的数组合并，覆盖 `dexElements`

```kotlin
// 反射获取 PathClassLoader 父类 BaseDexClassLoader 里的 pathList， 类型是 DexPathList
val pathListField = BaseDexClassLoader::class.java.getDeclaredField("pathList")
pathListField.isAccessible = true
val pathList = pathListField.get(classLoader)

// 反射获取 DexPathList 的 dexElements， 类型是 Element[]
val dexElementsField = pathList.javaClass.getDeclaredField("dexElements")
dexElementsField.isAccessible = true
val dexElements = dexElementsField.get(pathList) as Array<*>

// 创建一个包含我们自己 Dex 的数组Element[]
val makeDexElementsMethod = pathList.javaClass.getDeclaredMet("makeDexElements", List::class.java, File::class.java, List::clajava, ClassLoader::class.java)
makeDexElementsMethod.isAccessible = true
val myDexElements = makeDexElementsMethod.invoke(null, listOf(dex), opt, ArrayList<IOException>(), classLoader) as Array<*>

// 创建新的数组
val mergedArray = Array.newInstance(
    dexElements.javaClass.componentType,
    dexElements.size + myDexElements.size
)

// 合并
System.arraycopy(myDexElements, 0, mergedArray, 0, myDexElements.size)
System.arraycopy(dexElements, 0, mergedArray, myDexElements.size, dexElements.size)

// 覆盖原有的
dexElementsField.set(pathList, mergedArray)
```

最后我们就可以通过反射的方式使用 Dex 中的类，例如:

```java
Class.forName("class.of,dex")
```