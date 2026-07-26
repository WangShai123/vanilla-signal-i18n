import { createSignal, type Accessor, type Setter } from 'vanilla-signal';

const DEFAULT_LOCALE = 'en';
const DEFAULT_FALLBACK_LOCALE = 'en';
const MESSAGE_TOKEN_RE = /\{([A-Za-z0-9_.-]+)\}/g;

type MessageParams = Record<string, any>;
type MessageRecord = Record<string, any>;
type LocaleMessages = Record<string, MessageRecord>;

interface MessageContext {
  key?: string;
  locale?: string;
  i18n?: I18n | null;
  [key: string]: any;
}

type MissingHandler = (payload: {
  key: string;
  params: MessageParams;
  options: TranslateOptions;
  locale: string;
  i18n: I18n;
}) => string;

interface I18nOptions {
  locale?: string;
  fallbackLocale?: string;
  messages?: LocaleMessages;
  languages?: LocaleMessages;
  missing?: MissingHandler;
  warnMissing?: boolean;
  [key: string]: any;
}

interface SetMessagesOptions {
  merge?: boolean;
  [key: string]: any;
}

interface TranslateOptions {
  locale?: string;
  fallbackLocale?: string;
  [key: string]: any;
}

interface ResolveResult {
  found: boolean;
  key: string;
  locale: string;
  value: any;
}

interface I18nEvent {
  type: string;
  locale?: string;
  previousLocale?: string;
  messages?: MessageRecord | LocaleMessages;
  [key: string]: any;
}

type I18nListener = (event: I18nEvent) => void;
type Translator = (
  key: string,
  params?: MessageParams,
  options?: TranslateOptions | string
) => string;

function isPlainObject(value: unknown): value is MessageRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function cloneMessages(messages: unknown = {}): MessageRecord {
  if (!isPlainObject(messages)) return {};

  const result: MessageRecord = {};
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

function mergeMessages(target: unknown, source: unknown): MessageRecord {
  const result = cloneMessages(target);

  for (const [key, value] of Object.entries(
    (source || {}) as Record<string, any>
  )) {
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = mergeMessages(result[key], value);
    } else {
      result[key] = isPlainObject(value) ? cloneMessages(value) : value;
    }
  }

  return result;
}

function normalizeMessages(messages: unknown = {}): LocaleMessages {
  const result: LocaleMessages = {};

  if (!isPlainObject(messages)) return result;

  for (const [locale, localeMessages] of Object.entries(messages)) {
    result[normalizeLocale(locale)] = cloneMessages(localeMessages);
  }

  return result;
}

function normalizeLocale(locale: unknown, fallback = DEFAULT_LOCALE): string {
  if (typeof locale !== 'string') return fallback;

  const value = locale.trim().replace(/_/g, '-').toLowerCase();
  return value || fallback;
}

function getLocaleBase(locale: string): string {
  return String(locale || '').split('-')[0];
}

function uniq(list: string[]): string[] {
  return Array.from(new Set(list.filter(Boolean)));
}

function createLocaleChain(locale: unknown, fallbackLocale: string): string[] {
  const current = normalizeLocale(locale, fallbackLocale);
  const fallback = normalizeLocale(fallbackLocale, DEFAULT_FALLBACK_LOCALE);

  return uniq([
    current,
    getLocaleBase(current),
    fallback,
    getLocaleBase(fallback),
  ]);
}

function getPathValue(source: any, path: string): any {
  if (!source || typeof path !== 'string') return undefined;
  if (Object.prototype.hasOwnProperty.call(source, path)) return source[path];

  return path.split('.').reduce((value, segment) => {
    if (value == null) return undefined;
    return value[segment];
  }, source);
}

function formatMessage(
  value: any,
  params: MessageParams = {},
  context: MessageContext = {}
): string {
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

function resolveBrowserLocale(fallback = DEFAULT_LOCALE): string {
  if (typeof navigator === 'undefined') return fallback;

  const languages = Array.isArray(navigator.languages)
    ? navigator.languages
    : [];
  const locale = languages[0] || navigator.language || fallback;

  return normalizeLocale(locale, fallback);
}

function resolveDocumentLocale(): string | null {
  if (typeof document === 'undefined') return null;

  const langAttr = document.documentElement?.getAttribute('lang');
  return langAttr ? normalizeLocale(langAttr) : null;
}

function resolveInitialLocale(options: I18nOptions = {}): string {
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

function looksLikeMessagesMap(value: unknown): value is LocaleMessages {
  if (!isPlainObject(value)) return false;

  return Object.values(value).some((item) => {
    return isPlainObject(item) || typeof item === 'function';
  });
}

function translateFromMessages(
  key: string,
  messages: unknown,
  locale: unknown,
  fallbackLocale = 'en'
): string {
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

function getLegacyBrowserLang(): 'en' | 'zh' {
  if (typeof navigator === 'undefined') return 'en';
  return navigator.language.toLowerCase().startsWith('en') ? 'en' : 'zh';
}

function getLegacyDocumentLocale(): 'en' | 'zh' {
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
  declare private _locale: Accessor<string>;
  declare private _setLocaleSignal: Setter<string>;
  declare private _fallbackLocale: Accessor<string>;
  declare private _setFallbackSignal: Setter<string>;
  declare private _version: Accessor<number>;
  declare private _setVersion: Setter<number>;
  declare private _messages: LocaleMessages;
  declare private _listeners: Set<I18nListener>;
  declare private _missing: MissingHandler | null;
  declare private _warnMissing: boolean;

  constructor(options: I18nOptions = {}) {
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

  getLocaleSignal(): Accessor<string> {
    return this._locale;
  }

  getLocale(): string {
    return this._locale();
  }

  setLocale(locale: string): this {
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

  getFallbackLocale(): string {
    return this._fallbackLocale();
  }

  setFallbackLocale(locale: string): this {
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

  setMessages(
    messages: LocaleMessages,
    options: SetMessagesOptions = {}
  ): this {
    const nextMessages = normalizeMessages(messages);
    this._messages = options.merge
      ? mergeMessages(this._messages, nextMessages)
      : nextMessages;
    this._touch();
    this._notify({ type: 'messages', messages: this._messages });
    return this;
  }

  setLanguages(messages: LocaleMessages): this {
    return this.setMessages(messages);
  }

  addMessages(
    locale: string,
    messages: MessageRecord,
    options: SetMessagesOptions = {}
  ): this {
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

  getMessages(): LocaleMessages;
  getMessages(locale: string): MessageRecord;
  getMessages(locale?: string): LocaleMessages | MessageRecord {
    this._version();

    if (!locale) return this._messages;

    const lang = normalizeLocale(locale, this.getFallbackLocale());
    return this._messages[lang] || {};
  }

  getLanguages(): LocaleMessages {
    return this.getMessages();
  }

  has(key: string, options: TranslateOptions = {}): boolean {
    return this.resolve(key, options).found;
  }

  resolve(key: string, options: TranslateOptions = {}): ResolveResult {
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

  t(
    key: string,
    params: MessageParams = {},
    options: TranslateOptions | string = {}
  ): string {
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

  createTranslator(
    namespace: string,
    defaults: TranslateOptions = {}
  ): Translator {
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

  subscribe(listener: I18nListener): () => void {
    if (typeof listener !== 'function') {
      throw new Error('I18n.subscribe(): listener expects a function.');
    }

    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  destroy(): void {
    this._listeners.clear();
    this._messages = {};
    this._touch();
  }

  private _touch(): void {
    this._setVersion((value) => value + 1);
  }

  private _notify(event: I18nEvent): void {
    for (const listener of Array.from(this._listeners)) {
      listener(event);
    }
  }

  private _handleMissing(
    key: string,
    params: MessageParams,
    options: TranslateOptions,
    result: ResolveResult
  ): string {
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

export function createI18n(options: I18nOptions = {}): I18n {
  return new I18n(options);
}

export const defaultI18n = createI18n({
  locale: getLegacyDocumentLocale(),
  fallbackLocale: DEFAULT_FALLBACK_LOCALE,
});

export function setLanguages(obj: LocaleMessages): void {
  defaultI18n.setLanguages(obj);
}

export function getLanguages(): LocaleMessages {
  return defaultI18n.getLanguages();
}

export function getLocale(): string {
  return defaultI18n.getLocale();
}

export function getLang(): 'en' | 'zh' {
  return getLegacyBrowserLang();
}

export function t(
  key: string,
  paramsOrLanguages: MessageParams | LocaleMessages = {},
  optionsOrLang: TranslateOptions | string | null = null
): string {
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
