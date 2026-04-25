'use client';
import { useState, useEffect, useCallback } from 'react';

export type Lang = 'de' | 'en' | 'jp';

const dict: Record<string, Record<Lang, string>> = {
  'status.active':              { de: 'AKTIV',            en: 'ACTIVE',          jp: 'アクティブ' },
  'status.online':              { de: 'Online',            en: 'Online',          jp: 'オンライン' },
  'guest.validUntil':           { de: 'Gültig bis 28. Apr. 2026', en: 'Valid until 28 Apr 2026', jp: '2026年4月28日まで有効' },
  'guest.available':            { de: 'verfügbar',         en: 'available',       jp: '利用可能' },
  'guest.payHold':              { de: 'Zum Bezahlen Gerät an Terminal halten', en: 'Hold device near terminal to pay', jp: '端末にデバイスをかざして支払う' },
  'guest.topup':                { de: 'Aufladen',          en: 'Top up',          jp: 'チャージ' },
  'guest.transactions':         { de: 'Letzte Ausgaben',   en: 'Recent activity', jp: '最近の支払い' },
  'guest.showAll':              { de: 'Alle anzeigen →',   en: 'Show all →',      jp: 'すべて表示 →' },
  'guest.showLess':             { de: 'Weniger anzeigen',  en: 'Show less',       jp: '閉じる' },
  'guest.benefits':             { de: 'Deine Vorteile',    en: 'Your benefits',   jp: '特典' },
  'guest.tab.active':           { de: 'Aktiv',             en: 'Active',          jp: 'アクティブ' },
  'guest.tab.alwayson':         { de: 'Always-on',         en: 'Always-on',       jp: '常時' },
  'guest.tab.redeemed':         { de: 'Eingelöst',         en: 'Redeemed',        jp: '使用済み' },
  'guest.redeem':               { de: 'Einlösen',          en: 'Redeem',          jp: '引き換え' },
  'guest.once':                 { de: 'Einmalig',          en: 'One-time',        jp: '一回限り' },
  'guest.showQr':               { de: 'Zeige diesen QR dem Partner', en: 'Show this QR to the partner', jp: 'このQRをパートナーに見せてください' },
  'guest.nearby':               { de: 'Partner in deiner Nähe', en: 'Partners nearby', jp: '近くのパートナー' },
  'guest.nearbyCount':          { de: '23 Partner · innerhalb 15 km', en: '23 partners · within 15 km', jp: '23パートナー · 15km以内' },
  'guest.sustainability':       { de: 'Nachhaltigkeit',    en: 'Sustainability',  jp: '持続可能性' },
  'guest.sustainTip':           { de: 'Nimm den Zug zum Jungfraujoch statt der Bergbahn — verdient dir 30 Punkte.', en: 'Take the train to Jungfraujoch instead of the cable car — earns you 30 points.', jp: 'ロープウェイの代わりに電車でユングフラウヨッホへ — 30ポイント獲得。' },
  'guest.sustainPoints':        { de: 'Punkte',            en: 'points',          jp: 'ポイント' },
  'pay.apple.confirm':          { de: '✓ Apple Pay aktiviert. Bei der nächsten Zahlung wirst du automatisch belastet.', en: '✓ Apple Pay activated. You will be charged automatically on the next payment.', jp: '✓ Apple Pay が有効になりました。次回の支払いは自動的に処理されます。' },
  'pay.google.confirm':         { de: '✓ Google Pay aktiviert. Bei der nächsten Zahlung wirst du automatisch belastet.', en: '✓ Google Pay activated. You will be charged automatically on the next payment.', jp: '✓ Google Pay が有効になりました。次回の支払いは自動的に処理されます。' },
  'partner.loggedAs':           { de: 'Partner-Dashboard · Eingeloggt als Maria Brunner', en: 'Partner Dashboard · Logged in as Maria Brunner', jp: 'パートナーダッシュボード · Maria Brunnerとしてログイン' },
  'partner.todayRedeemed':      { de: 'Heute eingelöst',   en: 'Redeemed today',  jp: '本日の引き換え' },
  'partner.todayRevenue':       { de: 'Umsatz heute',      en: 'Revenue today',   jp: '本日の収益' },
  'partner.feesSaved':          { de: 'Gebühren gespart',  en: 'Fees saved',      jp: '節約した手数料' },
  'partner.thisMonth':          { de: 'dieses Monat',      en: 'this month',      jp: '今月' },
  'partner.vsYesterday':        { de: '↑ vs. gestern',     en: '↑ vs. yesterday', jp: '↑ 昨日比' },
  'partner.scanQr':             { de: 'QR-Code scannen',   en: 'Scan QR code',    jp: 'QRコードをスキャン' },
  'partner.startCamera':        { de: 'Kamera starten',    en: 'Start camera',    jp: 'カメラを起動' },
  'partner.stopCamera':         { de: 'Kamera stoppen',    en: 'Stop camera',     jp: 'カメラを停止' },
  'partner.enterCode':          { de: 'Code manuell eingeben', en: 'Enter code manually', jp: 'コードを手動入力' },
  'partner.confirm':            { de: 'Bestätigen',        en: 'Confirm',         jp: '確認' },
  'partner.redeemed':           { de: 'Eingelöst',         en: 'Redeemed',        jp: '引き換え済み' },
  'partner.scanHint':           { de: 'QR-Code in den Rahmen halten', en: 'Hold QR code inside the frame', jp: 'QRコードをフレーム内に合わせてください' },
  'partner.once':               { de: 'Einmalig · nach Scan verbraucht', en: 'One-time · consumed after scan', jp: '一回限り · スキャン後に消費' },
  'partner.enterToken':         { de: 'Token manuell eingeben…', en: 'Enter token manually…', jp: 'トークンを手動で入力…' },
  'partner.recentRedemptions':  { de: 'Letzte Einlösungen', en: 'Recent redemptions', jp: '最近の引き換え' },
  'partner.chart':              { de: 'Einlösungen letzte 7 Tage', en: 'Redemptions last 7 days', jp: '過去7日間の引き換え' },
  'admin.title':                { de: 'Jungfrau Region · Admin', en: 'Jungfrau Region · Admin', jp: 'ユングフラウ地域 · 管理者' },
  'admin.region':               { de: 'Region: Interlaken ▾', en: 'Region: Interlaken ▾', jp: '地域: インターラーケン ▾' },
  'admin.comingSoon':           { de: 'Bald verfügbar',    en: 'Coming soon',     jp: '近日公開' },
  'admin.activePasses':         { de: 'Aktive Pässe',      en: 'Active passes',   jp: 'アクティブなパス' },
  'admin.weeklyRedemptions':    { de: 'Einlösungen / Woche', en: 'Redemptions / week', jp: '週間引き換え数' },
  'admin.activePartners':       { de: 'Aktive Partner',    en: 'Active partners', jp: 'アクティブなパートナー' },
  'admin.feesSaved':            { de: 'Gebühren gespart',  en: 'Fees saved',      jp: '節約した手数料' },
  'admin.moM':                  { de: '↑ 15% MoM',         en: '↑ 15% MoM',       jp: '↑ 15% 前月比' },
  'admin.woW':                  { de: '↑ 9% WoW',          en: '↑ 9% WoW',        jp: '↑ 9% 前週比' },
  'admin.newThisWeek':          { de: '+ 4 diese Woche',   en: '+ 4 this week',   jp: '+ 4 今週' },
  'admin.ytd':                  { de: 'YTD 2026',          en: 'YTD 2026',        jp: '2026年累計' },
  'admin.chart':                { de: 'Einlösungen — letzte 30 Tage', en: 'Redemptions — last 30 days', jp: '過去30日間の引き換え' },
  'admin.allCategories':        { de: 'Alle Kategorien',   en: 'All categories',  jp: 'すべてのカテゴリ' },
  'admin.bergbahnen':           { de: 'Bergbahnen',        en: 'Cable cars',      jp: '山岳鉄道' },
  'admin.restaurants':          { de: 'Restaurants',       en: 'Restaurants',     jp: 'レストラン' },
  'admin.activities':           { de: 'Aktivitäten',       en: 'Activities',      jp: 'アクティビティ' },
  'admin.transport':            { de: 'Transport',         en: 'Transport',       jp: '交通' },
  'admin.tab.benefits':         { de: 'Benefits',          en: 'Benefits',        jp: '特典' },
  'admin.tab.partners':         { de: 'Partner',           en: 'Partners',        jp: 'パートナー' },
  'admin.tab.push':             { de: 'Push-Benachrichtigungen', en: 'Push Notifications', jp: 'プッシュ通知' },
  'admin.tab.settlement':       { de: 'Abrechnung',        en: 'Settlement',      jp: '精算' },
  'admin.tab.users':            { de: 'Benutzer',          en: 'Users',           jp: 'ユーザー' },
  'admin.newBenefit':           { de: '+ Neuer Vorteil',   en: '+ New benefit',   jp: '+ 新しい特典' },
  'admin.col.title':            { de: 'Titel',             en: 'Title',           jp: 'タイトル' },
  'admin.col.partner':          { de: 'Partner',           en: 'Partner',         jp: 'パートナー' },
  'admin.col.status':           { de: 'Status',            en: 'Status',          jp: 'ステータス' },
  'admin.col.redemptions':      { de: 'Einlösungen (Monat)', en: 'Redemptions (month)', jp: '引き換え（月）' },
  'admin.col.actions':          { de: 'Aktionen',          en: 'Actions',         jp: 'アクション' },
  'admin.col.category':         { de: 'Kategorie',         en: 'Category',        jp: 'カテゴリ' },
  'admin.col.onboarded':        { de: 'Onboarded',         en: 'Onboarded',       jp: 'オンボード' },
  'admin.col.thisMonth':        { de: 'Dieser Monat',      en: 'This month',      jp: '今月' },
  'admin.edit':                 { de: 'Bearbeiten',        en: 'Edit',            jp: '編集' },
  'admin.toggle':               { de: 'Toggle',            en: 'Toggle',          jp: 'トグル' },
  'admin.push.recipients':      { de: 'Empfänger',         en: 'Recipients',      jp: '受信者' },
  'admin.push.allPasses':       { de: "Alle aktiven Pässe (1'247)", en: "All active passes (1'247)", jp: "すべてのアクティブなパス (1'247)" },
  'admin.push.checkinToday':    { de: 'Pässe mit Check-in heute (43)', en: 'Passes with check-in today (43)', jp: '本日チェックインのパス (43)' },
  'admin.push.expiring':        { de: 'Pässe ablaufend in 24h (12)', en: 'Passes expiring in 24h (12)', jp: '24時間以内に期限切れのパス (12)' },
  'admin.push.title':           { de: 'Titel (max 50 Zeichen)', en: 'Title (max 50 chars)', jp: 'タイトル (最大50文字)' },
  'admin.push.body':            { de: 'Nachricht (max 200 Zeichen)', en: 'Message (max 200 chars)', jp: 'メッセージ (最大200文字)' },
  'admin.push.preview':         { de: 'Vorschau',          en: 'Preview',         jp: 'プレビュー' },
  'admin.send':                 { de: 'Senden',            en: 'Send',            jp: '送信' },
  'admin.saveDraft':            { de: 'Als Entwurf speichern', en: 'Save as draft', jp: '下書きとして保存' },
  'admin.sendSuccess':          { de: "✓ Benachrichtigung an 1'247 Pässe gesendet.", en: "✓ Notification sent to 1'247 passes.", jp: "✓ 1'247件のパスに通知を送信しました。" },
  'admin.partnerMap':           { de: 'Partner in der Region', en: 'Partners in the region', jp: '地域内のパートナー' },
  'admin.mapLegend.small':      { de: '< 50 Einlösungen',  en: '< 50 redemptions', jp: '50件未満' },
  'admin.mapLegend.medium':     { de: '50–200 Einlösungen', en: '50–200 redemptions', jp: '50–200件' },
  'admin.mapLegend.large':      { de: '> 200 Einlösungen', en: '> 200 redemptions', jp: '200件超' },
  'common.close':               { de: 'Schliessen',        en: 'Close',           jp: '閉じる' },
  'common.logout':              { de: 'Abmelden',          en: 'Sign out',        jp: 'ログアウト' },
};

export function useT() {
  const [lang, setLangState] = useState<Lang>('de');

  useEffect(() => {
    const saved = localStorage.getItem('jfp-lang') as Lang | null;
    if (saved && (['de', 'en', 'jp'] as Lang[]).includes(saved)) setLangState(saved);
  }, []);

  const setLanguage = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem('jfp-lang', l);
  }, []);

  const t = useCallback((key: string): string => dict[key]?.[lang] ?? key, [lang]);

  return { t, lang, setLanguage };
}
