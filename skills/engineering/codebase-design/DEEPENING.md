# Deepening（深化）

给定依赖，如何安全地深化一组 shallow module。假定你熟悉 [SKILL.md](SKILL.md) 中的词汇：**module**、**interface**、**seam**、**adapter**。

## 依赖类别

评估一个深化 candidate 时，对其依赖进行分类。类别决定了深化后的 module 如何跨越其 seam 被测试。

### 1. 进程内（In-process）

纯计算、内存状态、无 I/O。总是可以深化：合并 module 并直接通过新 interface 测试。不需要 adapter。

### 2. 本地可替代（Local-substitutable）

有本地测试替身的依赖（Postgres 用 PGLite、内存文件系统）。如果替身存在就可以深化。深化后的 module 通过测试套件中运行的替身来测试。seam 是内部的；module 的外部 interface 处没有 port。

### 3. 远程但自有（Ports & Adapters）

跨越网络 boundary 的你自己的服务（microservices、internal APIs）。在 seam 处定义一个 **port**（interface）。deep module 拥有逻辑；transport 被注入为 **adapter**。测试使用 in-memory adapter。生产使用 HTTP/gRPC/queue adapter。

推荐句式：*"在 seam 处定义一个 port，为生产实现 HTTP adapter、为测试实现 in-memory adapter，这样即使部署在网络两端，逻辑也坐落在一个 deep module 中。"*

### 4. 真正的外部（Mock）

你不控制的第三方服务（Stripe、Twilio 等）。深化后的 module 把外部依赖作为一个注入的 port；测试提供 mock adapter。

## Seam 纪律

- **一个 adapter 意味着假设的 seam。两个 adapter 意味着真实的 seam。** 除非至少两个 adapter 站得住脚（通常是生产 + 测试），否则不要引入 port。单 adapter 的 seam 只是间接层。
- **内部 seam 与外部 seam。** deep module 可以有内部 seams（对其 implementation 私有，由自己的测试使用）以及在其 interface 处的外部 seam。不要仅仅因为测试用到内部 seams 就把它通过 interface 暴露出去。

## 测试策略：替换，不要分层

- 一旦深化后的 module 的 interface 处存在测试，shallow module 上旧的单元测试就变成浪费；删掉它们。
- 在深化后的 module 的 interface 处编写新测试。**interface 就是测试面。**
- 测试断言的是通过 interface 可观察的结果，而不是内部状态。
- 测试应该能在内部重构中存活，因为它们描述的是行为，不是 implementation。如果 implementation 改变时测试必须改变，它就是在越过 interface 测试。
