'use client';
import {useMemo, useState} from 'react';
import {Download} from 'lucide-react';
import {createRawExport, rawExportOptions, selectRawMatches} from '../lib/club-export';
import type {RawArchivedMatch, RawExportScope, RawExportSelection} from '../lib/club-export';

const scopes: {value: RawExportScope; label: string}[] = [
  {value: 'all-time', label: 'All time · Tüm kayıtlar'},
  {value: 'session', label: 'Session · Maç günü'},
  {value: 'match', label: 'Match · Tek maç'},
  {value: 'week', label: 'Week · Takvim haftası'},
  {value: 'month', label: 'Month · Takvim ayı'},
];

export default function RawDataExport({matches}: {matches: readonly RawArchivedMatch[]}) {
  const [scope, setScope] = useState<RawExportScope>('all-time');
  const [keys, setKeys] = useState<Partial<Record<RawExportScope, string>>>({});
  const [error, setError] = useState('');
  const options = useMemo(() => rawExportOptions(matches, scope), [matches, scope]);
  const key = options.find(option => option.key === keys[scope])?.key ?? options[0]?.key ?? '';
  const selectionLabel = scope === 'session' ? 'Maç günü' : scope === 'match' ? 'Maç' : scope === 'week' ? 'Hafta' : 'Ay';
  const selection: RawExportSelection = scope === 'all-time' ? {scope} : {scope, key};
  const count = selectRawMatches(matches, selection).length;

  function download() {
    if (!count) return;
    setError('');
    let url: string | undefined;
    let link: HTMLAnchorElement | undefined;
    try {
      const file = createRawExport(matches, selection, new Date().toISOString());
      url = URL.createObjectURL(new Blob([file.json], {type: 'application/json;charset=utf-8'}));
      link = document.createElement('a');
      link.href = url;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
    } catch {
      setError('Dosya indirilemedi. Tekrar deneyebilirsin.');
    } finally {
      link?.remove();
      // Let the browser consume the download before releasing its object URL.
      if (url) {
        const downloadUrl = url;
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      }
    }
  }

  return <section className="panel rawExport" aria-labelledby="raw-export-title">
    <div className="sectionHead"><div><p className="eyebrow">HAM ARŞİV · JSON</p><h3 id="raw-export-title">Raw Data Export</h3></div><Download size={22} aria-hidden="true"/></div>
    <p className="bodyText">Hesaplanmış özetler yerine seçili maçların tam ham kayıtlarını indir. İki takımın mevcut oyuncu alanları ve olay sayaçları korunur.</p>
    <div className="rawExportControls">
      <label>Kapsam<select aria-label="Kapsam" value={scope} onChange={event => {
        const next = scopes.find(option => option.value === event.target.value);
        if (next) setScope(next.value);
        setError('');
      }}>{scopes.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      {scope !== 'all-time' && <label>{selectionLabel}<select aria-label={selectionLabel} value={key} disabled={!options.length} onChange={event => {
        setKeys(current => ({...current, [scope]: event.target.value}));
        setError('');
      }}>{!options.length && <option value="">Kayıt yok</option>}{options.map(option => <option key={option.key} value={option.key}>{option.label} · {option.matchCount} maç</option>)}</select></label>}
      <button className="primaryButton" type="button" disabled={!count} onClick={download}><Download size={16} aria-hidden="true"/>Raw Data Export · JSON indir</button>
    </div>
    <p className="rawExportCount" role="status">{count} maç dışa aktarılacak{!count ? ' · Bu seçimde kayıt yok.' : '.'}</p>
    <p className="footnote">Yalnız mevcut kayıtlardır; eksiksiz sezon arşivi değildir. Oturum, Europe/Amsterdam saatine göre bir takvim günüdür. Haftalar pazartesi başlayan ISO takvim haftalarıdır; aylar aynı saat dilimini kullanır. Bu kapsamlar yukarıdaki analiz filtresinden bağımsızdır.</p>
    {error && <p className="errorText" role="alert">{error}</p>}
  </section>;
}
