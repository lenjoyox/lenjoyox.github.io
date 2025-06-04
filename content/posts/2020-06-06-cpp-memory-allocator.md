+++
authors = ["Lenox"]
title = "Memory allocation"
date = "2020-06-06"
description = ""
tags = []
categories = [
    "C++",
]
series = []
disableComments = true
draft = false
+++

>这篇文章讨论一下c++中的内存分配技术

当我们想要在堆（heap）中分配一块内存区域并初始化一个对象的时候，我们会想到使用*new 表达式*，比如：

```c++
std::string *sp = new string("Bob");
```

这里我们分析一下这句*new 表达式*执行了哪几个步骤

 1. 首先*new 表达式*会调用一个名为`operator new`的标准库函数，这个函数声明在*new*头文件下，这个函数会分配一块足够大，原始，未命名的内存空间用来存储特定类型的对象，这里指`string`对象。
 2. 接着，编译器会执行相应的构造函数以构造这些对象，并传入初始值。
 3. 最后，将第2步中创建的对象分配到第1步中分配的内存空间中，然后返回一个指向该对象的指针。

 对应的，为了防止内存被消耗殆尽，当不再需要这个动态对象时，我们需要显示的销毁它，并释放与之关联的内存，我们会想到使用*delete 表达式*，比如：

 ```c++
delete sp;
```

同样，我们分析以下这句*delete 表达式*执行了哪几个步骤

 1. 对`sp`所指向的对象执行对应的*析构函数*，以销毁这个动态对象。
 2. 编译器调用名为`operator delete`的标准库函数释放内存空间，这个函数声明在*new*头文件下。

 这里我们猜想这两个标准库函数可能是是这样实现的：

 ```c++
 void *operator new(std::size_t size) {  
    if (void *mem = std::malloc(size))  
        return mem;  
    else  
 throw std::bad_alloc();  
}

void operator delete(void *mem) noexcept {  
    std::free(mem);  
}
 ```

 现在*new 表达式*是将内存分配和初始化结合到一起，*delete 表达式*是将对象销毁和释放内存结合到一起。但是有些场景下我们需要分开处理，那怎么办呢？我们以一个例子来说明：
 在这个例子中我们需要分配两块连续的内存区域存储`std::uint8_t`类型的数据，这种类型占8bit（1B）：

### 使用std::allocator（allocator类是标准库的一部分）

首先分配两块内存区域，大小为`2 * sizeof(std::uint8_t)`，也就是2个字节；

```c++
auto allocator = std::allocator<std::uint8_t>();  
std::uint8_t *ptr = allocator.allocate(2);
 ```

`ptr`指向第一块内存区域，地址为0x0000000000a912c0，内存图如下表示：

```txt
0x0000000000a912c0  00 00 00 00   00 00 00 00   00 00 00 00   00 00 00 00
0x0000000000a912d0  00 00 00 00   00 00 00 00   00 00 00 00   00 00 00 00
```

现在我们向两块内存区域分配对象，第一块内存存储值为`0xFF`的`uint8_t`对象，第二块内存存储值为`0xEE`的`uint8_t`对象。

```c++
allocator.construct(ptr, 0xFF);  
allocator.construct(ptr + 1, 0xEE);
```

 现在，内存图如下表示：

 ```txt
0x0000000000a912c0  ff ee 00 00   00 00 00 00   00 00 00 00   00 00 00 00
0x0000000000a912d0  00 00 00 00   00 00 00 00   00 00 00 00   00 00 00 00
 ```

可见对象在内存中构造成功。
其实，除了这种方式构造动态对象外，还可以使用*定位 new ( placement new))*形式构造对象

```c++
new(ptr) std::uint8_t(0xFF);  
new(ptr + 1) std::uint8_t(0xEE);
```

或者使用*解引用符**

```c++
*ptr = std::uint8_t(0xFF);  
*(ptr + 1) = std::uint8_t(0xEE);
```

当我们想销毁某个内存空间上的对象时，可以这样子

```c++
allocator.destroy(ptr);
or
ptr->~uint8_t();
```

这样就可以清除给定的对象但是不会释放该对象所在的空间。如果需要的话，我们可以重新使用该空间。
最后当我们不再需要这些动态对象的时候，我们除了销毁他们，还需要释放其所在的内存空间，这是很重要的。

```c++
allocator.deallocate(ptr, 2);
```

### std::allocator的最终原理？

allocator其实就是借助标准库的`operator new`和`operator delete`函数来完成内存分配和销毁的。

```c++
      // NB: __n is permitted to be 0.  The C++ standard says nothing  
 // about what the return value is when __n == 0.  _GLIBCXX_NODISCARD _Tp*  
      allocate(size_type __n, const void* = static_cast<const void*>(0))  
      {  
   if (__n > this->_M_max_size())  
     std::__throw_bad_alloc();  
  
#if __cpp_aligned_new  
   if (alignof(_Tp) > __STDCPP_DEFAULT_NEW_ALIGNMENT__)  
 { std::align_val_t __al = std::align_val_t(alignof(_Tp)); return static_cast<_Tp*>(::operator new(__n * sizeof(_Tp), __al)); }#endif  
  return static_cast<_Tp*>(::operator new(__n * sizeof(_Tp)));  
      }
 ```

```c++
      // __p is not permitted to be a null pointer.  
  void  
  deallocate(_Tp* __p, size_type __t)  
      {  
#if __cpp_aligned_new  
   if (alignof(_Tp) > __STDCPP_DEFAULT_NEW_ALIGNMENT__)  
 { ::operator delete(__p,# if __cpp_sized_deallocation  
 __t * sizeof(_Tp),# endif  
 std::align_val_t(alignof(_Tp))); return; }#endif  
  ::operator delete(__p  
#if __cpp_sized_deallocation  
  , __t * sizeof(_Tp)  
#endif  
  );  
      }
```

至于销毁对象的`destory`方法，其本质也是调用该对象的*析构函数*完成的。

```c++
     template<typename _Up>  
void  
destroy(_Up* __p)  
noexcept(std::is_nothrow_destructible<_Up>::value)  
{ __p->~_Up(); }
```

调用*析构函数*会销毁对象，但是不会释放内存。
<!--stackedit_data:
eyJoaXN0b3J5IjpbLTE2NjM2ODM5MTEsLTg1NTIyMDk4MCwtMj
A4NDM0MDc1XX0=
-->