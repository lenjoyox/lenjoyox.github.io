+++
authors = ["Lenox"]
title = "Mysql Account privileges"
date = "2020-08-16"
description = ""
tags = []
categories = [
    "Database",
]
series = []
disableComments = true
draft = false
+++

#### 创建用户

```mysql
mysql> CREATE USER 'your_username'@'host_ip_addr' IDENTIFIED BY 'your_pwd';
```

`host_ip_addr` 是你要从其连接到MySQL 服务器的计算机的主机名或IP地址

* 如果要从任何计算机连接，也可以将`％`用作host_ip_addr；
* 如果要从IP范围192.168.2.1 – 192.168.2.254的计算机进行连接，也可以是192.168.2.％之类的内容;

#### 分配权限

```mysql
mysql> GRANT ALL PRIVILEGES ON db_name.tab_name TO 'your_username'@'host_ip_addr' WITH GRANT OPTION;
```

`db_name` 是允许访问的数据库名称，`*` 表示任意数据库。
`tab_name` 是允许访问的表名称，`*` 表示任意表。
`ALL PRIVILEGES` 代表全局或者全数据库对象级别的所有权限。

#### 刷新权限

```mysql
mysql> FLUSH PRIVILEGES;
```

#### 查询用户

```mysql
mysql> USE mysql;
mysql> SELECT host, user, plugin FROM user;
+------------+------------------+-----------------------+
| host       | user             | plugin                |
+------------+------------------+-----------------------+
| %          | ghost            | caching_sha2_password |
| 172.17.0.% | root             | caching_sha2_password |
| localhost  | mysql.infoschema | caching_sha2_password |
| localhost  | mysql.session    | caching_sha2_password |
| localhost  | mysql.sys        | caching_sha2_password |
| localhost  | root             | caching_sha2_password |
+------------+------------------+-----------------------+
6 rows in set (0.00 sec)
```

#### 如何允许远程访问MYSQL Community ( OS：Fedora )

##### 添加新的规则到防火墙 ( Firewalld)

```shell
sudo firewall-cmd --permanent --zone=public --add-service=mysql
OR
sudo firewall-cmd --permanent --zone=public --add-port=3306/tcp
```

##### 重启 firewalld.service

```shell
sudo systemctl restart firewalld.service
```

##### 编辑 MYSQL Community 配置文件

编辑 `/etc/my.cnf.d/community-mysql-server.cnf`， 导航到以`bind-address`指令开头的行。将此指令设置为通配符IP地址`*`,`::`或`0.0.0.0`：

```txt
bind-address            = 0.0.0.0
```

保存重启MYSQL服务

```shell
sudo systemctl restart mysqld
```
