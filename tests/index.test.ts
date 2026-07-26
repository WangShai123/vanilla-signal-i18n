import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  I18n,
  createI18n,
  defaultI18n,
  getLanguages,
  getLocale,
  setLanguages,
  t,
} from '../src/index';

describe('I18n', () => {
  it('translates nested keys with locale normalization, interpolation, and fallback chain', () => {
    const i18n = createI18n({
      locale: 'zh_CN',
      fallbackLocale: 'en-US',
      messages: {
        en: {
          common: {
            save: 'Save',
            count: ({ value }: { value: number }) => `${value} items`,
          },
        },
        'en-US': {
          common: {
            save: 'Save US',
          },
        },
        zh: {
          common: {
            hello: '你好 {user.name}',
          },
        },
      },
    });

    expect(i18n.getLocale()).toBe('zh-cn');
    expect(i18n.t('common.hello', { user: { name: 'Ada' } })).toBe('你好 Ada');
    expect(i18n.t('common.save')).toBe('Save US');
    expect(i18n.t('common.count', { value: 2 })).toBe('2 items');
    expect(i18n.t('missing.key')).toBe('missing.key');
  });

  it('updates messages without reusing external object references', () => {
    const messages = {
      en: {
        nested: {
          title: 'Title',
        },
      },
    };
    const i18n = new I18n({ locale: 'en', messages });

    messages.en.nested.title = 'Changed outside';

    expect(i18n.t('nested.title')).toBe('Title');

    i18n.addMessages('en', {
      nested: {
        body: 'Body',
      },
    });

    expect(i18n.t('nested.title')).toBe('Title');
    expect(i18n.t('nested.body')).toBe('Body');

    i18n.addMessages('en', { nested: { title: 'Replaced' } }, { merge: false });

    expect(i18n.t('nested.title')).toBe('Replaced');
    expect(i18n.t('nested.body')).toBe('nested.body');
  });

  it('resolves keys and emits subscription events for locale and message changes', () => {
    const i18n = createI18n({
      locale: 'en',
      messages: {
        en: { ok: 'OK' },
        zh: { ok: '确定' },
      },
    });
    const listener = vi.fn();
    const unsubscribe = i18n.subscribe(listener);

    expect(i18n.has('ok')).toBe(true);
    expect(i18n.resolve('ok')).toEqual({
      found: true,
      key: 'ok',
      locale: 'en',
      value: 'OK',
    });

    expect(i18n.setLocale('zh')).toBe(i18n);
    expect(i18n.t('ok')).toBe('确定');

    i18n.setFallbackLocale('zh');
    i18n.setMessages({ zh: { ok: '好' } }, { merge: true });
    unsubscribe();
    i18n.setLocale('en');

    expect(listener).toHaveBeenCalledTimes(3);
    expect(listener.mock.calls[0][0]).toEqual({
      type: 'locale',
      locale: 'zh',
      previousLocale: 'en',
    });
    expect(listener.mock.calls[1][0]).toEqual({
      type: 'fallback-locale',
      locale: 'zh',
      previousLocale: 'en',
    });
    expect(listener.mock.calls[2][0]).toMatchObject({
      type: 'messages',
      messages: {
        en: { ok: 'OK' },
        zh: { ok: '好' },
      },
    });
  });

  it('supports namespaced translators and missing handlers', () => {
    const missing = vi.fn(({ key }) => `[missing:${key}]`);
    const i18n = createI18n({
      locale: 'en',
      messages: {
        en: {
          modal: {
            title: 'Dialog',
          },
        },
        zh: {
          modal: {
            title: '弹窗',
          },
        },
      },
      missing,
    });
    const modalT = i18n.createTranslator('modal', { locale: 'zh' });

    expect(modalT('title')).toBe('弹窗');
    expect(modalT('title', {}, 'en')).toBe('Dialog');
    expect(modalT('missing')).toBe('[missing:modal.missing]');
    expect(missing).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'modal.missing',
        locale: 'zh',
        i18n,
      })
    );
  });

  it('destroys listeners and messages', () => {
    const i18n = createI18n({
      locale: 'en',
      messages: {
        en: { ok: 'OK' },
      },
    });
    const listener = vi.fn();
    i18n.subscribe(listener);

    i18n.destroy();
    i18n.setLocale('zh');

    expect(i18n.t('ok')).toBe('ok');
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('legacy utility API', () => {
  beforeEach(() => {
    defaultI18n.setLocale('en');
    defaultI18n.setFallbackLocale('en');
    defaultI18n.setMessages({});
  });

  it('delegates setLanguages, getLanguages, getLocale, and t to the default instance', () => {
    setLanguages({
      en: { ok: 'OK', hello: 'Hello {name}' },
      zh: { ok: '确定' },
    });

    expect(getLocale()).toBe('en');
    expect(getLanguages()).toEqual({
      en: { ok: 'OK', hello: 'Hello {name}' },
      zh: { ok: '确定' },
    });
    expect(t('hello', { name: 'Ada' })).toBe('Hello Ada');
  });

  it('keeps the old t(key, languages, lang) signature', () => {
    expect(
      t(
        'ok',
        {
          en: { ok: 'OK' },
          zh: { ok: '确定' },
        },
        'zh'
      )
    ).toBe('确定');
  });
});
