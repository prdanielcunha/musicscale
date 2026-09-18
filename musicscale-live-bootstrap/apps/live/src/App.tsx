import { useEffect, useMemo, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import { auth } from './firebase';
import { LiveNodeSetup } from './LiveNodeSetup';
import { liveFeatureFlags } from './featureFlags';
import { loadNextScale, loadSharedContext, type SharedContext, type SharedScale } from './musicScaleBridge';
import { markLiveMetric } from './telemetry';
import { useLiveNode } from './useLiveNode';

type Surface = 'live' | 'studio' | 'pastor' | 'conductor';

export function App() {
  const { t, i18n } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [context, setContext] = useState<SharedContext | null>(null);
  const [scale, setScale] = useState<SharedScale | null>(null);
  const [loading, setLoading] = useState(true);
  const [surface, setSurface] = useState<Surface>('studio');
  const liveNode = useLiveNode();

  useEffect(() => {
    markLiveMetric('shell-mounted');
    return onAuthStateChanged(auth, async currentUser => {
      setUser(currentUser);
      setContext(null);
      setScale(null);

      if (!currentUser) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const nextContext = await loadSharedContext(currentUser);
        setContext(nextContext);
        if (nextContext) setScale(await loadNextScale(nextContext.organizationId));
      } finally {
        setLoading(false);
        markLiveMetric('shared-context-ready');
      }
    });
  }, []);

  const nodeStatus = useMemo(() => {
    if (liveNode.state === 'connected') return t('connected');
    if (liveNode.state === 'probing' || liveNode.state === 'pairing') return t('nodeStatus.connecting');
    if (liveNode.state === 'degraded' || liveNode.state === 'reconnecting') return t('nodeStatus.reconnecting');
    if (liveNode.state === 'offline' || liveNode.state === 'blocked') return t('nodeStatus.offline');
    return t('pending');
  }, [liveNode.state, t]);

  const login = () => signInWithPopup(auth, new GoogleAuthProvider());
  const logout = () => signOut(auth);

  if (loading) {
    return <main className="center"><div className="boot-orb" /><p>{t('loading')}</p></main>;
  }

  if (!user) {
    return (
      <main className="login-shell">
        <section className="login-panel">
          <div className="brand-kicker">MUSICSCALE / LIVE</div>
          <h1>MusicScale <strong>LIVE</strong></h1>
          <p>{t('sameEcosystem')}</p>
          <button className="primary" onClick={login}>{t('signIn')}</button>
        </section>
      </main>
    );
  }

  const nodeConnected = liveNode.state === 'connected';
  const providersConnected = (liveNode.health?.providers ?? 0) > 0;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand-kicker">MUSICSCALE / LIVE</div>
          <strong>{t('brand')}</strong>
        </div>
        <div className="top-actions">
          <select value={i18n.resolvedLanguage || 'pt'} onChange={e => i18n.changeLanguage(e.target.value)}>
            <option value="pt">PT</option><option value="en">EN</option><option value="es">ES</option>
          </select>
          <button className="ghost" onClick={logout}>{t('signOut')}</button>
        </div>
      </header>

      <aside className="sidebar">
        {(['studio','live','pastor','conductor'] as Surface[]).map(item => (
          <button key={item} onClick={() => setSurface(item)} className={surface === item ? 'active' : ''}>
            {t(item)}
          </button>
        ))}
      </aside>

      <main className="workspace">
        <section className="hero">
          <div>
            <span className="eyebrow">{t('foundation')} · 0.1.0-alpha.1</span>
            <h1>{surface === 'studio' ? 'Live Studio' : t(surface)}</h1>
            <p>{context?.organizationName || t('organization')}</p>
          </div>
          <div className="pill-row">
            <span>{t('lanFirst')}</span><span>{t('providerAgnostic')}</span><span>{t('offlineReady')}</span>
          </div>
        </section>

        <section className="health-grid">
          <article><span className="status ok" /><div><small>{t('cloud')}</small><strong>{t('connected')}</strong></div></article>
          <article>
            <span className={`status ${nodeConnected ? 'ok' : liveNode.state === 'offline' || liveNode.state === 'blocked' ? 'danger' : 'warn'}`} />
            <div><small>{t('node')}</small><strong>{nodeStatus}</strong></div>
          </article>
          <article>
            <span className={`status ${providersConnected ? 'ok' : 'warn'}`} />
            <div><small>{t('providers')}</small><strong>{providersConnected ? String(liveNode.health?.providers) : t('pending')}</strong></div>
          </article>
        </section>

        {surface === 'studio' && context && liveFeatureFlags.liveNodeTransport && (
          <LiveNodeSetup controller={liveNode} organizationId={context.organizationId} />
        )}

        <section className="content-grid">
          <article className="panel next-service">
            <div className="panel-head"><span>{t('nextService')}</span><small>{t('readOnlyBridge')}</small></div>
            {scale ? (
              <>
                <div className="service-title">
                  <div>
                    <strong>{scale.eventName || 'Culto'}</strong>
                    <span>{scale.date}{scale.time ? ` · ${scale.time}` : ''}{scale.locationName ? ` · ${scale.locationName}` : ''}</span>
                  </div>
                  <em>{scale.songs.length} {t('songs')}</em>
                </div>
                <div className="song-list">
                  {scale.songs.map((song, index) => <div key={song.id}><b>{String(index + 1).padStart(2,'0')}</b><span>{song.title}<small>{song.artist || ''}</small></span></div>)}
                </div>
              </>
            ) : <p className="muted">{t('noService')}</p>}
          </article>

          <article className="panel live-preview">
            <div className="preview-screen">
              <span>PROGRAM</span>
              <strong>{surface === 'live' ? t('now') : 'LIVE GRAPH'}</strong>
              <small>{surface === 'studio' ? 'Nodes · Providers · Routes · Outputs' : 'Preview / Program / Take'}</small>
            </div>
            <nav className="quick-nav">
              <button>{t('now')}</button><button>{t('timeline')}</button><button>{t('bible')}</button><button>{t('media')}</button><button>{t('requests')}</button>
            </nav>
          </article>
        </section>
      </main>
    </div>
  );
}
