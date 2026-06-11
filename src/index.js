import { createSignal } from 'vanilla-signal';

const DEFAULT_LOCALE = 'en';
const DEFAULT_FALLBACK_LOCALE = 'en';
const MESSAGE_TOKEN_RE = /\{([A-Za-z0-9_.-]+)\}/g;

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function cloneMessages(messages = {}) {
  if (!isPlainObject(messages)) return {};

  const result = {};
  for (const [key, value] of Object.entries(messages)) {
    if (isPlainObject(value)) {
      result[key] = cloneMessages(value);
    } else if (Array.isArray(value)) {
      result[key] = value.slice();
    } else {
      result[key] = value;
    }
  }

  return result;
}

function mergeMessages(target, source) {
  const result = cloneMessages(target);

  for (const [key, value] of Object.entries(source || {})) {
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = mergeMessages(result[key], value);
    } else {
      result[key] = isPlainObject(value) ? cloneMessages(value) : value;
    }
  }

  return result;
}

function normalizeMessages(messages = {}) {
  const result = {};

  if (!isPlainObject(messages)) return result;

  for (const [locale, localeMessages] of Object.entries(messages)) {
    result[normalizeLocale(locale)] = cloneMessages(localeMessages);
  }

  return result;
}

function normalizeLocale(locale, fallback = DEFAULT_LOCALE) {
  if (typeof locale !== 'string') return fallback;

  const value = locale.trim().replace(/_/g, '-').toLowerCase();
  return value || fallback;
}

function getLocaleBase(locale) {
  return String(locale || '').split('-')[0];
}

function uniq(list) {
  return Array.from(new Set(list.filter(Boolean)));
}

function createLocaleChain(locale, fallbackLocale) {
  const current = normalizeLocale(locale, fallbackLocale);
  const fallback = normalizeLocale(fallbackLocale, DEFAULT_FALLBACK_LOCALE);

  return uniq([
    current,
    getLocaleBase(current),
    fallback,
    getLocaleBase(fallback),
  ]);
}

function getPathValue(source, path) {
  if (!source || typeof path !== 'string') return undefined;
  if (Object.prototype.hasOwnProperty.call(source, path)) return source[path];

  return path.split('.').reduce((value, segment) => {
    if (value == null) return undefined;
    return value[segment];
  }, source);
}

function formatMessage(value, params = {}, context = {}) {
  const resolved =
    typeof value === 'function' ? value(params || {}, context) : value;

  if (resolved == null) return '';
  if (typeof resolved !== 'string') return String(resolved);
  if (!params || typeof params !== 'object') return resolved;

  return resolved.replace(MESSAGE_TOKEN_RE, (match, path) => {
    const param = getPathValue(params, path);
    return param == null ? match : String(param);
  });
}

function resolveBrowserLocale(fallback = DEFAULT_LOCALE) {
  if (typeof navigator === 'undefined') return fallback;

  const languages = Array.isArray(navigator.languages)
    ? navigator.languages
    : [];
  const locale = languages[0] || navigator.language || fallback;

  return normalizeLocale(locale, fallback);
}

function resolveDocumentLocale() {
  if (typeof document === 'undefined') return null;

  const langAttr = document.documentElement?.getAttribute('lang');
  return langAttr ? normalizeLocale(langAttr) : null;
}

function resolveInitialLocale(options = {}) {
  const fallbackLocale = normalizeLocale(
    options.fallbackLocale,
    DEFAULT_FALLBACK_LOCALE
  );

  if (options.locale) {
    return normalizeLocale(options.locale, fallbackLocale);
  }

  const detected =
    resolveDocumentLocale() || resolveBrowserLocale(fallbackLocale);
  return normalizeLocale(detected, fallbackLocale);
}

function looksLikeMessagesMap(value) {
  if (!isPlainObject(value)) return false;

  return Object.values(value).some((item) => {
    return isPlainObject(item) || typeof item === 'function';
  });
}

function translateFromMessages(key, messages, locale, fallbackLocale = 'en') {
  const normalizedMessages = normalizeMessages(messages);
  const chain = createLocaleChain(locale, fallbackLocale);

  for (const lang of chain) {
    const value = getPathValue(normalizedMessages[lang], key);
    if (value !== undefined) {
      return formatMessage(value, {}, { key, locale: lang, i18n: null });
    }
  }

  return key;
}

function getLegacyBrowserLang() {
  if (typeof navigator === 'undefined') return 'en';
  return navigator.language.toLowerCase().startsWith('en') ? 'en' : 'zh';
}

function getLegacyDocumentLocale() {
  if (typeof document === 'undefined') return getLegacyBrowserLang();

  const langAttr = document.documentElement.getAttribute('lang');

  if (langAttr) {
    const langPrefix = langAttr.substring(0, 2).toLowerCase();

    switch (langPrefix) {
      case 'en':
        return 'en';
      case 'zh':
        return 'zh';
      default:
        return 'en';
    }
  }

  return getLegacyBrowserLang();
}

/**
 * 响应式国际化管理器。
 *
 * 翻译方法会读取内部 signal；在 vanilla-signal 的 reactive context 中调用时，
 * locale 或 messages 变化会触发依赖重新计算。
 */
export class I18n {
  /**
   * @param {object} [options={}] 国际化配置。
   * @param {string} [options.locale] 初始语言。
   * @param {string} [options.fallbackLocale="en"] 回退语言。
   * @param {Record<string, Record<string, any>>} [options.messages] 语言包。
   * @param {Record<string, Record<string, any>>} [options.languages] 语言包别名。
   * @param {(payload: object)=>string} [options.missing] 缺失翻译时的处理函数。
   * @param {boolean} [options.warnMissing=false] 缺失翻译时是否输出 warning。
   */
  constructor(options = {}) {
    const fallbackLocale = normalizeLocale(
      options.fallbackLocale,
      DEFAULT_FALLBACK_LOCALE
    );
    const messages = normalizeMessages(
      options.messages || options.languages || {}
    );
    const initialLocale = resolveInitialLocale({
      locale: options.locale,
      fallbackLocale,
    });

    const [locale, setLocaleSignal] = createSignal(initialLocale);
    const [fallback, setFallbackSignal] = createSignal(fallbackLocale);
    const [version, setVersion] = createSignal(0, { equals: false });

    this._locale = locale;
    this._setLocaleSignal = setLocaleSignal;
    this._fallbackLocale = fallback;
    this._setFallbackSignal = setFallbackSignal;
    this._version = version;
    this._setVersion = setVersion;
    this._messages = messages;
    this._listeners = new Set();
    this._missing =
      typeof options.missing === 'function' ? options.missing : null;
    this._warnMissing = options.warnMissing === true;
  }

  /**
   * 获取 locale signal accessor。
   * @returns {Function}
   */
  getLocaleSignal() {
    return this._locale;
  }

  /**
   * 获取当前语言。
   * @returns {string}
   */
  getLocale() {
    return this._locale();
  }

  /**
   * 设置当前语言。
   * @param {string} locale 语言代码。
   * @returns {I18n}
   */
  setLocale(locale) {
    const previousLocale = this._locale.peek
      ? this._locale.peek()
      : this._locale();
    const nextLocale = normalizeLocale(locale, this.getFallbackLocale());

    if (previousLocale === nextLocale) return this;

    this._setLocaleSignal(nextLocale);
    this._notify({
      type: 'locale',
      locale: nextLocale,
      previousLocale,
    });

    return this;
  }

  /**
   * 获取回退语言。
   * @returns {string}
   */
  getFallbackLocale() {
    return this._fallbackLocale();
  }

  /**
   * 设置回退语言。
   * @param {string} locale 语言代码。
   * @returns {I18n}
   */
  setFallbackLocale(locale) {
    const previousLocale = this._fallbackLocale.peek
      ? this._fallbackLocale.peek()
      : this._fallbackLocale();
    const nextLocale = normalizeLocale(locale, DEFAULT_FALLBACK_LOCALE);

    if (previousLocale === nextLocale) return this;

    this._setFallbackSignal(nextLocale);
    this._notify({
      type: 'fallback-locale',
      locale: nextLocale,
      previousLocale,
    });

    return this;
  }

  /**
   * 设置完整语言包。
   * @param {Record<string, Record<string, any>>} messages 语言包。
   * @param {object} [options={}] 设置选项。
   * @param {boolean} [options.merge=false] 是否与现有语言包深度合并。
   * @returns {I18n}
   */
  setMessages(messages, options = {}) {
    const nextMessages = normalizeMessages(messages);
    this._messages = options.merge
      ? mergeMessages(this._messages, nextMessages)
      : nextMessages;
    this._touch();
    this._notify({ type: 'messages', messages: this._messages });
    return this;
  }

  /**
   * 设置完整语言包，兼容旧 utilities API。
   * @param {Record<string, Record<string, any>>} messages 语言包。
   * @returns {I18n}
   */
  setLanguages(messages) {
    return this.setMessages(messages);
  }

  /**
   * 为指定语言追加语言包。
   * @param {string} locale 语言代码。
   * @param {Record<string, any>} messages 语言文案。
   * @param {object} [options={}] 设置选项。
   * @param {boolean} [options.merge=true] 是否与现有语言包深度合并。
   * @returns {I18n}
   */
  addMessages(locale, messages, options = {}) {
    const lang = normalizeLocale(locale, this.getFallbackLocale());
    const merge = options.merge !== false;
    const current = this._messages[lang] || {};

    this._messages = {
      ...this._messages,
      [lang]: merge
        ? mergeMessages(current, messages)
        : cloneMessages(messages),
    };
    this._touch();
    this._notify({
      type: 'messages',
      locale: lang,
      messages: this._messages[lang],
    });

    return this;
  }

  /**
   * 获取语言包。
   * @param {string} [locale] 指定语言，为空时返回完整语言包。
   * @returns {Record<string, any>}
   */
  getMessages(locale) {
    this._version();

    if (!locale) return this._messages;

    const lang = normalizeLocale(locale, this.getFallbackLocale());
    return this._messages[lang] || {};
  }

  /**
   * 获取完整语言包，兼容旧 utilities API。
   * @returns {Record<string, Record<string, any>>}
   */
  getLanguages() {
    return this.getMessages();
  }

  /**
   * 判断指定 key 是否有翻译。
   * @param {string} key 文案 key，支持点路径。
   * @param {object} [options={}] 翻译选项。
   * @param {string} [options.locale] 指定语言。
   * @param {string} [options.fallbackLocale] 指定回退语言。
   * @returns {boolean}
   */
  has(key, options = {}) {
    return this.resolve(key, options).found;
  }

  /**
   * 解析翻译，不进行插值。
   * @param {string} key 文案 key，支持点路径。
   * @param {object} [options={}] 翻译选项。
   * @param {string} [options.locale] 指定语言。
   * @param {string} [options.fallbackLocale] 指定回退语言。
   * @returns {{found:boolean,key:string,locale:string,value:any}}
   */
  resolve(key, options = {}) {
    this._version();

    const locale = normalizeLocale(
      options.locale || this.getLocale(),
      this.getFallbackLocale()
    );
    const fallbackLocale = normalizeLocale(
      options.fallbackLocale || this.getFallbackLocale(),
      DEFAULT_FALLBACK_LOCALE
    );
    const chain = createLocaleChain(locale, fallbackLocale);

    for (const lang of chain) {
      const value = getPathValue(this._messages[lang], key);
      if (value !== undefined) {
        return {
          found: true,
          key,
          locale: lang,
          value,
        };
      }
    }

    return {
      found: false,
      key,
      locale,
      value: key,
    };
  }

  /**
   * 获取翻译文案。
   * @param {string} key 文案 key，支持点路径。
   * @param {Record<string, any>} [params={}] 插值参数。
   * @param {object|string} [options={}] 翻译选项或 locale 字符串。
   * @returns {string}
   */
  t(key, params = {}, options = {}) {
    const translateOptions =
      typeof options === 'string' ? { locale: options } : options || {};
    const result = this.resolve(key, translateOptions);

    if (!result.found) {
      return this._handleMissing(key, params, translateOptions, result);
    }

    return formatMessage(result.value, params, {
      key,
      locale: result.locale,
      i18n: this,
    });
  }

  /**
   * 创建带命名空间的翻译函数。
   * @param {string} namespace 文案命名空间。
   * @param {object} [defaults={}] 默认翻译选项。
   * @returns {(key:string, params?:Record<string, any>, options?:object|string)=>string}
   */
  createTranslator(namespace, defaults = {}) {
    const prefix = namespace ? `${namespace}.` : '';

    return (key, params = {}, options = {}) => {
      const nextOptions =
        typeof options === 'string' ? { locale: options } : options || {};

      return this.t(`${prefix}${key}`, params, {
        ...defaults,
        ...nextOptions,
      });
    };
  }

  /**
   * 订阅 i18n 状态变化。
   * @param {(event: object)=>void} listener 监听函数。
   * @returns {Function} 取消订阅函数。
   */
  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('I18n.subscribe(): listener expects a function.');
    }

    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  /**
   * 销毁当前 i18n 实例。
   * @returns {void}
   */
  destroy() {
    this._listeners.clear();
    this._messages = {};
    this._touch();
  }

  _touch() {
    this._setVersion((value) => value + 1);
  }

  _notify(event) {
    for (const listener of Array.from(this._listeners)) {
      listener(event);
    }
  }

  _handleMissing(key, params, options, result) {
    if (this._missing) {
      return this._missing({
        key,
        params,
        options,
        locale: result.locale,
        i18n: this,
      });
    }

    if (this._warnMissing) {
      console.warn(`I18n: missing translation for "${key}".`);
    }

    return key;
  }
}

/**
 * 创建响应式 i18n 实例。
 * @param {object} [options={}] 国际化配置。
 * @returns {I18n}
 */
export function createI18n(options = {}) {
  return new I18n(options);
}

export const defaultI18n = createI18n({
  locale: getLegacyDocumentLocale(),
  fallbackLocale: DEFAULT_FALLBACK_LOCALE,
});

/**
 * 设置默认 i18n 实例的语言包。
 * @param {Record<string, Record<string, any>>} obj 语言包对象。
 * @returns {void}
 */
export function setLanguages(obj) {
  defaultI18n.setLanguages(obj);
}

/**
 * 获取默认 i18n 实例的语言包。
 * @returns {Record<string, Record<string, any>>}
 */
export function getLanguages() {
  return defaultI18n.getLanguages();
}

/**
 * 获取当前默认语言。
 * @returns {string}
 */
export function getLocale() {
  return defaultI18n.getLocale();
}

/**
 * 根据浏览器语言判断当前语言，兼容旧 utilities API。
 * @returns {"en"|"zh"}
 */
export function getLang() {
  return getLegacyBrowserLang();
}

/**
 * 获取指定 key 的本地化文案。
 *
 * 兼容旧签名 `t(key, languages, lang)`，也支持新签名
 * `t(key, params, options)`。
 * @param {string} key 文案 key。
 * @param {Record<string, any>|Record<string, Record<string, any>>} [paramsOrLanguages={}] 插值参数或语言包。
 * @param {object|string|null} [optionsOrLang=null] 翻译选项或语言代码。
 * @returns {string}
 */
export function t(key, paramsOrLanguages = {}, optionsOrLang = null) {
  if (looksLikeMessagesMap(paramsOrLanguages)) {
    return translateFromMessages(
      key,
      paramsOrLanguages,
      optionsOrLang || getLocale(),
      defaultI18n.getFallbackLocale()
    );
  }

  return defaultI18n.t(key, paramsOrLanguages, optionsOrLang || {});
}

export default I18n;
