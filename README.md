# I18n

I18n is a reactive internationalization manager based on `vanilla-signal`, with source code located in `src/i18n.js`. It can create independent instances via `new I18n(options)` or `createI18n(options)`. It also retains legacy utility functions like `setLanguages/getLanguages/getLocale/getLang/t` for compatibility with older projects.

It is recommended to use independent instances in new code to avoid sharing global language state across multiple pages or components.

## Installation

npm:

```bash
npm install vanilla-signal-i18n
```

script:

```html
<script src="https://unpkg.com/vanilla-signal-i18n/dist/index.umd.js"></script>
```

## Import

```js
// esm
import { I18n, createI18n, defaultI18n, t } from 'vanilla-signal-i18n';

// umd: Global variable `vanillaSignalI18n`
const { I18n, createI18n, defaultI18n, t } = vanillaSignalI18n;
```

## Basic Usage

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
i18n.t('common.hello', { name: 'World' }); // 你好 World
```

Keys support dot notation paths. When a translation is not found in the current language, it falls back in the order of `zh-cn -> zh -> en`. If still not found, the original key is returned.

## Reactive Translation

`i18n.t()` reads internal signals. When called within a `vanilla-signal` reactive context, changes to `locale` or `messages` will automatically trigger re-computation.

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

If you only need to read the locale signal, you can also use `getLocaleSignal()`:

```js
const locale = i18n.getLocaleSignal();

createEffect(() => {
  console.log(locale());
});
```

## Appending Language Packs

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

`addMessages(locale, messages)` deeply merges with existing language packs by default. To replace the language pack for a specific locale:

```js
i18n.addMessages('zh', { ok: '确定' }, { merge: false });
```

To replace or merge complete language packs:

```js
i18n.setMessages(
  {
    en: { save: 'Save' },
    zh: { save: '保存' },
  },
  { merge: true }
);
```

## Namespaces

`createTranslator(namespace)` creates a translation function with a prefix, suitable for use within components.

```js
const modalT = i18n.createTranslator('modal');

modalT('title'); // Equivalent to i18n.t('modal.title')
modalT('confirm');
```

## Missing Translations

By default, missing translations return the original key. You can output warnings via `warnMissing` or customize the return value via `missing`.

```js
const i18n = createI18n({
  locale: 'zh',
  fallbackLocale: 'en',
  warnMissing: true,
  missing: ({ key }) => `[missing:${key}]`,
});
```

## Subscribing to Changes

`subscribe(handler)` listens for changes in locale, fallback locale, and messages, suitable for integration with non-signal code.

```js
const unsubscribe = i18n.subscribe((event) => {
  console.log(event.type, event.locale);
});

i18n.setLocale('zh');
unsubscribe();
```

Event types:

| Type              | Triggered When                     |
| ----------------- | ---------------------------------- |
| `locale`          | Current language changes           |
| `fallback-locale` | Fallback language changes          |
| `messages`        | Language packs are set or appended |

## Default Instance

`defaultI18n` is the built-in default instance of the library. Legacy utility functions delegate to it:

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

t('ok'); // Returns text based on current default locale
getLanguages();
getLocale();
getLang();
```

`t()` is also compatible with the old signature:

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

For new code requiring interpolation, dynamic language switching, or isolated language states for different components, it is recommended to use the `i18n.t()` method of an independent `I18n` instance.

## Options

| Parameter        | Type                                  | Default | Description                                           |
| ---------------- | ------------------------------------- | ------- | ----------------------------------------------------- |
| `locale`         | `string`                              | Auto    | Initial language; reads html lang or browser if empty |
| `fallbackLocale` | `string`                              | `'en'`  | Fallback language                                     |
| `messages`       | `Record<string, Record<string, any>>` | `{}`    | Language packs                                        |
| `languages`      | `Record<string, Record<string, any>>` | `{}`    | Alias for `messages`, for backward compatibility      |
| `missing`        | `(payload: object) => string`         | `null`  | Handler function for missing translations             |
| `warnMissing`    | `boolean`                             | `false` | Whether to output warning for missing translations    |

## Instance Properties

The state of I18n is accessed via instance methods; no public properties are exposed for direct modification. `messages` are shallow/deep cloned upon writing to prevent direct reuse of external object references.

## Instance Methods

| Method                                   | Description                                                                |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| `getLocaleSignal()`                      | Get the signal accessor for the current locale                             |
| `getLocale()`                            | Get the current locale                                                     |
| `setLocale(locale)`                      | Set the current locale                                                     |
| `getFallbackLocale()`                    | Get the fallback locale                                                    |
| `setFallbackLocale(locale)`              | Set the fallback locale                                                    |
| `setMessages(messages, options)`         | Set complete language packs                                                |
| `setLanguages(messages)`                 | Compatible alias for `setMessages()`                                       |
| `addMessages(locale, messages, options)` | Append or replace language pack for a specific locale                      |
| `getMessages(locale)`                    | Get language pack for a specific locale; returns all if no locale provided |
| `getLanguages()`                         | Compatible alias for `getMessages()`                                       |
| `has(key, options)`                      | Check if a key has an available translation                                |
| `resolve(key, options)`                  | Resolve translation, returning matched locale and original value           |
| `t(key, params, options)`                | Get translated text and perform interpolation                              |
| `createTranslator(namespace, defaults)`  | Create a namespaced translation function                                   |
| `subscribe(handler)`                     | Subscribe to i18n state changes, returns unsubscribe function              |
| `destroy()`                              | Clean up listeners and language packs                                      |

## Translation Value Types

Translation values can be strings, numbers, booleans, or functions.

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

Functions receive two parameters:

| Parameter | Description                                        |
| --------- | -------------------------------------------------- |
| `params`  | Interpolation parameters passed when calling `t()` |
| `context` | `{ key, locale, i18n }`                            |

## Locale Rules

Locales are normalized to lowercase, and `_` is converted to `-`:

```js
i18n.setLocale('zh_CN');
i18n.getLocale(); // zh-cn
```

When looking up translations, it falls back in the order of full locale, base language, fallback locale, and fallback base language. For example, if the current locale is `zh-CN` and the fallback locale is `en-US`, the lookup order is:

```txt
zh-cn -> zh -> en-us -> en
```

## Translation

- [中文](README_zh.md)
