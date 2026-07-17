import { EcosystemContextPayload, EcosystemEvent, EcosystemRoleType, EcosystemProtocolOptions } from './types';
import { logger } from '../../lib/logger';

const MODULE_PROTOCOL_VERSION = '1.0.0';
const MODULE_SDK_VERSION = '1.1.0';
const REQUIRED_HOST_PROTOCOL_VERSION = '1.0.0'; // Minimum supported protocol
const MODULE_CAPABILITIES = ['routing', 'telemetry', 'session_sync'];

const TRUSTED_DOMAINS = [
  /^https:\/\/(www\.)?millionsnest\.com$/,
  /^https:\/\/[a-zA-Z0-9-]+\.millionsnest\.com$/,
  /^http:\/\/localhost:\d+$/
];

class EcosystemBridge {
  private static instance: EcosystemBridge;
  private currentContext: EcosystemContextPayload | null = null;
  private isInitialized = false;
  private isHandshakeCompleted = false;
  private hostOrigin: string | null = null;
  private initializationPromise: Promise<EcosystemContextPayload> | null = null;
  private watchdogInterval: NodeJS.Timeout | null = null;
  private lastHeartbeat: number = Date.now();
  private failedPings: number = 0;

  private constructor() {
    this.listenForHostMessages();
    this.startWatchdog();
  }

  public static getInstance(): EcosystemBridge {
    if (!EcosystemBridge.instance) {
      EcosystemBridge.instance = new EcosystemBridge();
    }
    return EcosystemBridge.instance;
  }

  private startWatchdog() {
    if (typeof window === 'undefined') return;
    this.watchdogInterval = setInterval(() => {
      if (this.currentContext && !this.currentContext.isStandalone) {
         if (this.failedPings >= 3) {
            logger.warn('[EcosystemBridge] Host seems unresponsive. Falling back to safe degraded mode.');
            window.dispatchEvent(new CustomEvent('ecosystem:degraded_mode'));
            this.failedPings = 0; // Reset to avoid event spam
         }
         
         const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeat;
         if (timeSinceLastHeartbeat > 30000) { // 30s timeout without any host message
             this.publishEvent({ type: 'telemetry', payload: { action: 'ping' }, timestamp: Date.now() });
             this.failedPings++;
         }
      }
    }, 10000);
  }

  private isOriginTrusted(origin: string): boolean {

    return TRUSTED_DOMAINS.some(regex => regex.test(origin));
  }

  private isProtocolCompatible(hostVersion: string): boolean {
    // Basic semver check: just comparing major versions for this example
    const hostMajor = parseInt(hostVersion.split('.')[0], 10);
    const requiredMajor = parseInt(REQUIRED_HOST_PROTOCOL_VERSION.split('.')[0], 10);
    return !isNaN(hostMajor) && hostMajor >= requiredMajor;
  }

  /**
   * Initializes the bridge and waits for the initial context from the host.
   * If not embedded or host is invalid, falls back to a development context (or standalone).
   */
  public async initialize(): Promise<EcosystemContextPayload> {
    if (this.isInitialized && this.currentContext) {
      return this.currentContext;
    }
    
    if (this.initializationPromise) {
       return this.initializationPromise;
    }

    if (typeof window !== 'undefined' && window.parent === window) {
       this.currentContext = this.getFallbackContext();
       this.isInitialized = true;
       this.isHandshakeCompleted = true;
       this.initializationPromise = Promise.resolve(this.currentContext);
       return this.initializationPromise;
    }

    this.initializationPromise = new Promise((resolve) => {
      // Setup a timeout for graceful degradation to standalone safe mode
      const timeout = setTimeout(() => {
        logger.debug('[EcosystemBridge] Host handshake timeout. Entering standalone safe mode.');
        this.currentContext = this.getFallbackContext();
        this.isInitialized = true;
        this.isHandshakeCompleted = true;
        resolve(this.currentContext);
      }, 1000); // 1 second timeout

      const handler = (event: MessageEvent) => {
        if (event.data?.type === 'MILLIONSNEST_INIT' && event.data?.payload) {
          
          if (!this.isOriginTrusted(event.origin)) {
             logger.error(`[EcosystemBridge] Untrusted origin blocked: ${event.origin}`);
             return; // Ignore and let it timeout to standalone mode
          }

          const payload = event.data.payload as EcosystemContextPayload;
          
          // Compatibility Engine
          if (payload.protocol) {
             if (!this.isProtocolCompatible(payload.protocol.protocolVersion)) {
                logger.error(`[EcosystemBridge] Protocol mismatch. Host: ${payload.protocol.protocolVersion}, Required: ${REQUIRED_HOST_PROTOCOL_VERSION}`);
                // Proceed with caution, or we could fallback. For now, we fallback.
                clearTimeout(timeout);
                window.removeEventListener('message', handler);
                this.currentContext = this.getFallbackContext();
                this.isInitialized = true;
                this.isHandshakeCompleted = true;
                resolve(this.currentContext);
                return;
             }
          }

          clearTimeout(timeout);
          window.removeEventListener('message', handler);
          
          this.hostOrigin = event.origin;
          this.currentContext = { ...payload, isStandalone: false };
          this.isInitialized = true;
          this.isHandshakeCompleted = true;
          logger.info('[EcosystemBridge] Host handshake successful. Protocol validated.', { 
             orgId: this.currentContext.currentOrganizationId,
             protocolVersion: payload.protocol?.protocolVersion
          });
          resolve(this.currentContext);
        }
      };

      window.addEventListener('message', handler);
      
      // Notify host we are ready, passing our SDK details
      if (window.parent && window.parent !== window) {
        // Find if document.referrer is a trusted origin to avoid '*' targetOrigin where possible
        let targetOrigin = '*';
        try {
          if (document.referrer) {
            const refOrigin = new URL(document.referrer).origin;
            if (this.isOriginTrusted(refOrigin)) {
              targetOrigin = refOrigin;
            }
          }
        } catch (err) {
          logger.warn('[EcosystemBridge] Failed to parse referrer origin', err);
        }

        window.parent.postMessage({ 
          type: 'MILLIONSNEST_MODULE_READY', 
          payload: { 
             appId: 'musicscale',
             protocolVersion: MODULE_PROTOCOL_VERSION,
             sdkVersion: MODULE_SDK_VERSION,
             capabilities: MODULE_CAPABILITIES
          }, 
          timestamp: Date.now() 
        }, targetOrigin);
      }
    });

    return this.initializationPromise;
  }

  public getHostOrigin(): string | null {
    return this.hostOrigin;
  }

  public getContext(): EcosystemContextPayload {
    if (!this.currentContext) {
      throw new Error("EcosystemBridge has not been initialized. Call initialize() first.");
    }
    return this.currentContext;
  }

  public publishEvent(event: EcosystemEvent) {
    if (this.currentContext?.isStandalone) return;
    
    logger.debug('[EcosystemBridge] Publishing event:', event.type);
    if (window.parent && window.parent !== window && this.hostOrigin) {
      window.parent.postMessage({ type: 'MILLIONSNEST_MODULE_EVENT', ...event, appId: 'musicscale' }, this.hostOrigin);
    }
  }

  public navigateToEcosystem(path: string = '/') {
    if (this.currentContext?.isStandalone) {
         window.location.href = `https://millionsnest.com${path}`;
         return;
    }

    this.publishEvent({
      type: 'navigation',
      payload: { action: 'navigate_root', path },
      timestamp: Date.now()
    });
  }

  private getFallbackContext(): EcosystemContextPayload {
    return {
      token: '',
      uid: '',
      userDisplayName: 'Guest',
      userEmail: '',
      ecosystemRole: 'none',
      currentOrganizationId: '',
      currentOrganizationName: 'Sem Organização',
      currentOrganizationSlug: '',
      organizationsAvailable: [],
      roleInCurrentOrganization: 'none',
      plan: 'starter',
      subscriptionStatus: 'inactive',
      entitlements: {},
      capabilities: [],
      permissions: {
        canManageOrganization: false,
        canManageMembers: false,
        canManageScales: false,
        canManageRepertoire: false
      },
      needsRepair: false,
      repairReasons: [],
      locale: 'pt-BR',
      appId: 'musicscale',
      isStandalone: true
    };
  }

  private listenForHostMessages() {
    if (typeof window === 'undefined') return;
    window.addEventListener('message', (event) => {
      // Validate origin strictly for all subsequent messages
      if (this.hostOrigin && event.origin !== this.hostOrigin) return;

      // Ignore operational messages before handshake is completed
      if (!this.isHandshakeCompleted) {
        return;
      }

      this.lastHeartbeat = Date.now();
      this.failedPings = 0;

      // Handle dynamic org change, token refresh, or sign out commands from OS
      if (event.data?.type === 'MILLIONSNEST_SYNC_ORG') {
        logger.info('[EcosystemBridge] Received organization sync from host.');
        this.currentContext = {
          ...(this.currentContext as EcosystemContextPayload),
          ...event.data.payload
        };
        // Trigger a custom event to let React context know it should re-render
        window.dispatchEvent(new CustomEvent('ecosystem:sync_org', { detail: this.currentContext }));
      }
      
      if (event.data?.type === 'MILLIONSNEST_INVALIDATE_SESSION') {
         logger.warn('[EcosystemBridge] Host requested session invalidation.');
         window.dispatchEvent(new CustomEvent('ecosystem:invalidate_session'));
      }
    });
  }
}

export const ecosystemBridge = EcosystemBridge.getInstance();
