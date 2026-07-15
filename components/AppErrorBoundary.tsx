import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  incidentId: string;
}


function safeSessionStorageGet(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSessionStorageSet(key: string, value: string): boolean {
  try {
    window.sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export class AppErrorBoundary extends React.Component<Props, State> {
  props: Props;
  state: State;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null,
      incidentId: ''
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, incidentId: Math.random().toString(36).substring(2, 9) };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in AppErrorBoundary:', error, errorInfo);
    
    const errorMessage = error.message || error.toString();
    if (
      errorMessage.includes('Failed to fetch dynamically imported module') ||
      errorMessage.includes('ChunkLoadError') ||
      errorMessage.includes('Importing a module script failed') ||
      errorMessage.includes('dynamically imported module')
    ) {
      const RELOAD_FLAG = 'musicscale_chunk_reloaded';
      const lastReload = safeSessionStorageGet(RELOAD_FLAG);
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload) > 10000) {
        const saved = safeSessionStorageSet(RELOAD_FLAG, now.toString());
        if (saved) {
          console.warn('AppErrorBoundary: Chunk load failed, forcing reload once...');
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('v', now.toString());
          window.location.href = newUrl.toString();
        }
      }
    }
  }

  handleRetry = () => {
    window.location.reload();
  };

  handleRefresh = () => {
    window.location.reload();
  };

  handleSignOut = () => {
    window.location.href = '/'; 
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      const lang = navigator.language.startsWith('pt') ? 'pt' : navigator.language.startsWith('es') ? 'es' : 'en';
      
      const dict: Record<string, any> = {
        pt: {
          title: 'Não foi possível abrir o MusicScale',
          text: 'O aplicativo encontrou um problema ao iniciar. Seus dados continuam seguros.',
          retry: 'Tentar novamente',
          refresh: 'Atualizar aplicativo',
          signin: 'Entrar novamente',
          code: 'Código do erro'
        },
        en: {
          title: 'MusicScale couldn’t be opened',
          text: 'The app encountered a problem while starting. Your data is still safe.',
          retry: 'Try again',
          refresh: 'Refresh app',
          signin: 'Sign in again',
          code: 'Error code'
        },
        es: {
          title: 'No fue posible abrir MusicScale',
          text: 'La aplicación encontró un problema al iniciar. Tus datos siguen seguros.',
          retry: 'Intentar de nuevo',
          refresh: 'Actualizar aplicación',
          signin: 'Iniciar sesión nuevamente',
          code: 'Código del error'
        }
      };
      const content = dict[lang] || dict.en;

      return (
        <div style={{
          display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw',
          justifyContent: 'center', alignItems: 'center', backgroundColor: '#F2F2F7',
          padding: '24px', boxSizing: 'border-box', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
        }}>
          <div style={{
             maxWidth: '400px', width: '100%', backgroundColor: '#FFFFFF', borderRadius: '24px', padding: '32px 24px',
             boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', textAlign: 'center'
          }}>
            <h2 style={{ margin: '0 0 12px 0', fontSize: '20px', fontWeight: '700', color: '#111827' }}>{content.title}</h2>
            <p style={{ margin: '0 0 32px 0', fontSize: '14px', color: '#4B5563', lineHeight: '1.5' }}>{content.text}</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
               <button onClick={this.handleRetry} style={{ padding: '14px', borderRadius: '12px', border: 'none', background: '#007AFF', color: 'white', fontWeight: '600', fontSize: '15px', cursor: 'pointer' }}>
                 {content.retry}
               </button>
               <button onClick={this.handleRefresh} style={{ padding: '14px', borderRadius: '12px', border: '1px solid #E5E7EB', background: '#FFFFFF', color: '#111827', fontWeight: '600', fontSize: '15px', cursor: 'pointer' }}>
                 {content.refresh}
               </button>
               <button onClick={this.handleSignOut} style={{ padding: '14px', borderRadius: '12px', border: 'none', background: 'transparent', color: '#4B5563', fontWeight: '500', fontSize: '14px', cursor: 'pointer' }}>
                 {content.signin}
               </button>
            </div>
            
            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #F3F4F6' }}>
               <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{content.code}: {this.state.incidentId}</span>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
