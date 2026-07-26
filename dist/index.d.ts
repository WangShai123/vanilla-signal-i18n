import { Accessor } from "vanilla-signal";
//#region src/index.d.ts
type MessageParams = Record<string, any>;
type MessageRecord = Record<string, any>;
type LocaleMessages = Record<string, MessageRecord>;
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
type Translator = (key: string, params?: MessageParams, options?: TranslateOptions | string) => string;
/**
 * 响应式国际化管理器。
 *
 * 翻译方法会读取内部 signal；在 vanilla-signal 的 reactive context 中调用时，
 * locale 或 messages 变化会触发依赖重新计算。
 */
declare class I18n {
  private _locale;
  private _setLocaleSignal;
  private _fallbackLocale;
  private _setFallbackSignal;
  private _version;
  private _setVersion;
  private _messages;
  private _listeners;
  private _missing;
  private _warnMissing;
  constructor(options?: I18nOptions);
  getLocaleSignal(): Accessor<string>;
  getLocale(): string;
  setLocale(locale: string): this;
  getFallbackLocale(): string;
  setFallbackLocale(locale: string): this;
  setMessages(messages: LocaleMessages, options?: SetMessagesOptions): this;
  setLanguages(messages: LocaleMessages): this;
  addMessages(locale: string, messages: MessageRecord, options?: SetMessagesOptions): this;
  getMessages(): LocaleMessages;
  getMessages(locale: string): MessageRecord;
  getLanguages(): LocaleMessages;
  has(key: string, options?: TranslateOptions): boolean;
  resolve(key: string, options?: TranslateOptions): ResolveResult;
  t(key: string, params?: MessageParams, options?: TranslateOptions | string): string;
  createTranslator(namespace: string, defaults?: TranslateOptions): Translator;
  subscribe(listener: I18nListener): () => void;
  destroy(): void;
  private _touch;
  private _notify;
  private _handleMissing;
}
declare function createI18n(options?: I18nOptions): I18n;
declare const defaultI18n: I18n;
declare function setLanguages(obj: LocaleMessages): void;
declare function getLanguages(): LocaleMessages;
declare function getLocale(): string;
declare function getLang(): 'en' | 'zh';
declare function t(key: string, paramsOrLanguages?: MessageParams | LocaleMessages, optionsOrLang?: TranslateOptions | string | null): string;
//#endregion
export { I18n, I18n as default, createI18n, defaultI18n, getLang, getLanguages, getLocale, setLanguages, t };