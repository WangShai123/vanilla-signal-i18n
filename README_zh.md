# I18n

I18n 是基于 `vanilla-signal` 的响应式国际化管理器，源码位于 `src/i18n.js`。它既可以通过 `new I18n(options)` 创建独立实例，也可以用 `createI18n(options)` 创建；同时保留 `setLanguages/getLanguages/getLocale/getLang/t` 这些历史工具函数，兼容旧项目。

推荐新代码优先使用独立实例，避免多个页面或组件共享同一个全局语言状态。

## 安装

npm:

```bash
npm install vanilla-signal-i18n
```

script:

```html
<script src="https://unpkg.com/vanilla-signal-i18n/dist/index.umd.js"></script>
```

## 导入

```js
// esm
import { I18n, createI18n, defaultI18n, t } from 'vanilla-signal-i18n';

// umd: 全局变量 `vanillaSignalI18n`
const { I18n, createI18n, defaultI18n, t } = vanillaSignalI18n;
```

## 基础使用

```js
const i18n = createI18n({
  locale: 'zh-CN',
  fallbackLocale: 'en',
  messages: {
    en: {
      common: {
        confirm: 'Confirm',
        hello: 'Hello {name}',
      },
    },
    zh: {
      common: {
        confirm: '确定',
        hello: '你好 {name}',
      },
    },
  },
});

i18n.t('common.confirm'); // 确定
i18n.t('common.hello', { name: 'World' }); // 你好 世界
```

`key` 支持点路径。找不到当前语言的文案时，会按 `zh-cn -> zh -> en` 这样的顺序回退；仍找不到时返回原始 key。

## 响应式翻译

`i18n.t()` 会读取内部 signal。在 `vanilla-signal` 的响应式上下文中调用时，`locale` 或 `messages` 变化会自动触发重新计算。

```js
import { createEffect } from 'vanilla-signal';

const i18n = new I18n({
  locale: 'en',
  messages: {
    en: { title: 'Settings' },
    zh: { title: '设置' },
  },
});

createEffect(() => {
  document.title = i18n.t('title');
});

i18n.setLocale('zh');
```

如果只需要读取 locale signal，也可以使用 `getLocaleSignal()`：

```js
const locale = i18n.getLocaleSignal();

createEffect(() => {
  console.log(locale());
});
```

## 追加语言包

```js
i18n.addMessages('zh', {
  modal: {
    title: '提示',
    cancel: '取消',
  },
});

i18n.addMessages('en', {
  modal: {
    title: 'Tip',
    cancel: 'Cancel',
  },
});
```

`addMessages(locale, messages)` 默认会和已有语言包深度合并。需要替换指定语言的语言包时：

```js
i18n.addMessages('zh', { ok: '确定' }, { merge: false });
```

需要替换或合并完整语言包时：

```js
i18n.setMessages(
  {
    en: { save: 'Save' },
    zh: { save: '保存' },
  },
  { merge: true }
);
```

## 命名空间

`createTranslator(namespace)` 可以创建带前缀的翻译函数，适合组件内部使用。

```js
const modalT = i18n.createTranslator('modal');

modalT('title'); // 等价于 i18n.t('modal.title')
modalT('confirm');
```

## 缺失翻译

默认情况下，缺失翻译会返回原始 key。可以通过 `warnMissing` 输出 warning，或通过 `missing` 自定义返回值。

```js
const i18n = createI18n({
  locale: 'zh',
  fallbackLocale: 'en',
  warnMissing: true,
  missing: ({ key }) => `[missing:${key}]`,
});
```

## 订阅变化

`subscribe(handler)` 可监听 locale、fallback locale 和 messages 变化，适合和非 signal 代码集成。

```js
const unsubscribe = i18n.subscribe((event) => {
  console.log(event.type, event.locale);
});

i18n.setLocale('zh');
unsubscribe();
```

事件类型：

| 类型              | 触发时机           |
| ----------------- | ------------------ |
| `locale`          | 当前语言变化       |
| `fallback-locale` | 回退语言变化       |
| `messages`        | 语言包被设置或追加 |

## 默认实例

`defaultI18n` 是库内置的默认实例。历史工具函数都委托给它：

```js
import {
  setLanguages,
  getLanguages,
  getLocale,
  getLang,
  t,
} from 'vanilla-signal-i18n';

setLanguages({
  en: { ok: 'OK' },
  zh: { ok: '确定' },
});

t('ok'); // 根据当前默认 locale 返回文案
getLanguages();
getLocale();
getLang();
```

`t()` 同时兼容旧签名：

```js
t(
  'ok',
  {
    en: { ok: 'OK' },
    zh: { ok: '确定' },
  },
  'zh'
); // 确定
```

新代码如果需要插值、动态切换语言或隔离不同组件的语言状态，建议使用独立 `I18n` 实例的 `i18n.t()`。

## Options

| 参数             | 类型                                  | 默认值  | 说明                                    |
| ---------------- | ------------------------------------- | ------- | --------------------------------------- |
| `locale`         | `string`                              | 自动    | 初始语言；为空时读取 html lang 或浏览器 |
| `fallbackLocale` | `string`                              | `'en'`  | 回退语言                                |
| `messages`       | `Record<string, Record<string, any>>` | `{}`    | 语言包                                  |
| `languages`      | `Record<string, Record<string, any>>` | `{}`    | `messages` 的别名，兼容旧命名           |
| `missing`        | `(payload: object) => string`         | `null`  | 缺失翻译时的返回处理函数                |
| `warnMissing`    | `boolean`                             | `false` | 缺失翻译时是否输出 warning              |

## 实例属性

I18n 的状态通过实例方法读取，不暴露可直接修改的公共属性。`messages` 会在写入时做浅层/深层克隆，避免外部对象引用被直接复用。

## 实例方法

| 方法                                     | 说明                                 |
| ---------------------------------------- | ------------------------------------ |
| `getLocaleSignal()`                      | 获取当前语言的 signal accessor       |
| `getLocale()`                            | 获取当前语言                         |
| `setLocale(locale)`                      | 设置当前语言                         |
| `getFallbackLocale()`                    | 获取回退语言                         |
| `setFallbackLocale(locale)`              | 设置回退语言                         |
| `setMessages(messages, options)`         | 设置完整语言包                       |
| `setLanguages(messages)`                 | `setMessages()` 的兼容别名           |
| `addMessages(locale, messages, options)` | 追加或替换指定语言的语言包           |
| `getMessages(locale)`                    | 获取指定语言包；不传 locale 返回全部 |
| `getLanguages()`                         | `getMessages()` 的兼容别名           |
| `has(key, options)`                      | 判断 key 是否有可用翻译              |
| `resolve(key, options)`                  | 解析翻译，返回命中语言和原始值       |
| `t(key, params, options)`                | 获取翻译文案并执行插值               |
| `createTranslator(namespace, defaults)`  | 创建带命名空间的翻译函数             |
| `subscribe(handler)`                     | 订阅 i18n 状态变化，返回取消订阅函数 |
| `destroy()`                              | 清理监听器和语言包                   |

## 翻译值类型

翻译值可以是字符串、数字、布尔值，或函数。

```js
const i18n = createI18n({
  locale: 'en',
  messages: {
    en: {
      count: ({ value }) => `${value} items`,
    },
  },
});

i18n.t('count', { value: 3 }); // 3 items
```

函数会收到两个参数：

| 参数      | 说明                        |
| --------- | --------------------------- |
| `params`  | 调用 `t()` 时传入的插值参数 |
| `context` | `{ key, locale, i18n }`     |

## Locale 规则

locale 会被规范化为小写，并把 `_` 转为 `-`：

```js
i18n.setLocale('zh_CN');
i18n.getLocale(); // zh-cn
```

查找文案时会按完整 locale、基础语言、fallback locale、fallback 基础语言的顺序回退。例如当前语言为 `zh-CN`、回退语言为 `en-US` 时，查找顺序为：

```txt
zh-cn -> zh -> en-us -> en
```

## 翻译

- [English](README.md)
