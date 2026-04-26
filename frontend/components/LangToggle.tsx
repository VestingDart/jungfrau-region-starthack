'use client';

import { useLanguage } from '@/lib/language';

export default function LangToggle({ dark = false }: { dark?: boolean }) {
  const { lang, setLang } = useLanguage();

  const base: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 2,
    background: dark ? 'rgba(255,255,255,.08)' : 'var(--sand)',
    border: dark ? '1px solid rgba(255,255,255,.12)' : '1px solid var(--line)',
    borderRadius: 8, padding: '3px 4px',
    fontFamily: 'inherit',
  };

  function btn(code: 'de' | 'en'): React.CSSProperties {
    const active = lang === code;
    return {
      padding: '.22rem .52rem', border: 'none', borderRadius: 5, cursor: 'pointer',
      fontSize: '.72rem', fontWeight: 700, letterSpacing: '.04em',
      fontFamily: 'inherit', transition: 'all .15s',
      background: active ? (dark ? '#fff' : 'var(--navy)') : 'transparent',
      color:      active ? (dark ? 'var(--navy)' : '#fff') : (dark ? 'rgba(255,255,255,.45)' : 'var(--sub)'),
    };
  }

  return (
    <div style={base}>
      <button style={btn('de')} onClick={() => setLang('de')}>DE</button>
      <button style={btn('en')} onClick={() => setLang('en')}>EN</button>
    </div>
  );
}
