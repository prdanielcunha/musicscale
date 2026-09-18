import type {
  Capability,
  CommandResult,
  LiveCommand,
  ProviderAdapter,
  ProviderDescriptor,
  ProviderState
} from '@musicscale-live/domain';
import type { HolyricsApi } from './HolyricsHttpClient';

interface TokenInfo {
  version?: string;
  permissions?: string;
}

interface CurrentPresentation {
  id?: string;
  type?: string;
  name?: string;
  song_id?: string;
  slide_number?: number;
  total_slides?: number;
  slide_type?: string;
  slides?: unknown[];
  [key: string]: unknown;
}

const ACTIONS_BY_CAPABILITY: Partial<Record<Capability, string[]>> = {
  'presentation.slides.read': ['GetCurrentPresentation'],
  'presentation.navigation': ['ActionNext', 'ActionPrevious', 'ActionGoToIndex'],
  'presentation.preview': ['GetCurrentPresentation'],
  'presentation.clear': ['CloseCurrentPresentation'],
  'presentation.screen.mode': ['SetF8', 'SetF9', 'SetF10'],
  'bible.search': ['IdentifyVerseReferences'],
  'bible.present': ['ShowVerse'],
  'songs.search': ['SearchLyrics'],
  'songs.present': ['ShowLyrics'],
  'playlist.write': ['AddLyricsToPlaylist'],
  'playlist.sync': ['GetLyricsPlaylist', 'RemoveFromLyricsPlaylist', 'AddLyricsToPlaylist'],
  'media.search': ['GetAudios', 'GetVideos', 'GetImages'],
  'media.open': ['PlayAudio', 'PlayVideo', 'ShowImage'],
  'preview.snapshot': ['GetCurrentPresentation'],
  'stage.message': ['SetTextCommunicationPanel']
};

function permissionsToSet(value?: string): Set<string> {
  return new Set(
    String(value || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
  );
}

function requiredActionsAllowed(
  granted: Set<string>,
  actions: string[]
): boolean {
  return actions.every(action => granted.has(action));
}

export interface HolyricsAdapterOptions {
  id: string;
  nodeId: string;
  displayName?: string;
  api: HolyricsApi;
}

export class HolyricsAdapter implements ProviderAdapter {
  readonly descriptor: ProviderDescriptor;
  private readonly api: HolyricsApi;
  private readonly supported = new Set<Capability>();
  private lastState: ProviderState = {
    health: 'offline',
    updatedAt: new Date(0).toISOString(),
    observed: {}
  };

  constructor(options: HolyricsAdapterOptions) {
    this.api = options.api;
    this.descriptor = {
      id: options.id,
      nodeId: options.nodeId,
      kind: 'presentation',
      displayName: options.displayName || 'Holyrics',
      providerKey: 'holyrics'
    };
  }

  async probe() {
    try {
      const tokenInfo = await this.api.request<TokenInfo>('GetTokenInfo');
      const permissions = permissionsToSet(tokenInfo.permissions);
      this.supported.clear();

      for (const [capability, actions] of Object.entries(ACTIONS_BY_CAPABILITY) as Array<[Capability, string[]]>) {
        if (requiredActionsAllowed(permissions, actions)) {
          this.supported.add(capability);
        }
      }

      this.descriptor.version = tokenInfo.version;
      this.lastState = {
        health: 'online',
        updatedAt: new Date().toISOString(),
        observed: {
          version: tokenInfo.version,
          permissionCount: permissions.size
        }
      };

      return {
        reachable: true,
        version: tokenInfo.version,
        capabilities: [...this.supported]
      };
    } catch (error) {
      this.supported.clear();
      this.lastState = {
        health: 'offline',
        updatedAt: new Date().toISOString(),
        observed: {
          error: error instanceof Error ? error.message : 'holyrics_probe_failed'
        }
      };
      return {
        reachable: false,
        capabilities: [] as Capability[],
        reason: error instanceof Error ? error.message : 'holyrics_probe_failed'
      };
    }
  }

  capabilities(): ReadonlySet<Capability> {
    return this.supported;
  }

  peekState(): ProviderState {
    return {
      health: this.lastState.health,
      updatedAt: this.lastState.updatedAt,
      observed: { ...this.lastState.observed }
    };
  }

  async getState(): Promise<ProviderState> {
    if (!this.supported.has('presentation.slides.read')) {
      return this.lastState;
    }

    try {
      const presentation = await this.api.request<CurrentPresentation | null>(
        'GetCurrentPresentation'
      );
      this.lastState = {
        health: 'online',
        updatedAt: new Date().toISOString(),
        observed: {
          ...this.lastState.observed,
          currentPresentation: presentation
        }
      };
    } catch (error) {
      this.lastState = {
        health: 'degraded',
        updatedAt: new Date().toISOString(),
        observed: {
          ...this.lastState.observed,
          error: error instanceof Error ? error.message : 'holyrics_state_failed'
        }
      };
    }
    return this.lastState;
  }

  async execute(command: LiveCommand): Promise<CommandResult> {
    const started = performance.now();
    try {
      if (!this.supported.has(command.capability)) {
        return this.result(command, started, false, 'capability_not_supported', true);
      }

      const observedState = await this.executeCapability(command);
      return {
        commandId: command.id,
        providerInstanceId: this.descriptor.id,
        accepted: true,
        latencyMs: Math.max(0, Math.round(performance.now() - started)),
        observedState
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'holyrics_command_failed';
      const recoverable =
        message.includes('timeout') ||
        message.includes('session') ||
        message.includes('http_');
      return this.result(
        command,
        started,
        false,
        recoverable ? 'provider_timeout' : 'provider_permission_denied',
        recoverable
      );
    }
  }

  private async executeCapability(
    command: LiveCommand
  ): Promise<Record<string, unknown> | undefined> {
    const payload = command.payload as Record<string, any>;

    switch (command.capability) {
      case 'presentation.slides.read':
      case 'presentation.preview':
      case 'preview.snapshot': {
        const currentPresentation = await this.api.request<CurrentPresentation | null>(
          'GetCurrentPresentation',
          {
            include_slides: true,
            include_slide_comment: true,
            include_slide_preview: command.capability === 'preview.snapshot',
            slide_preview_size: command.capability === 'preview.snapshot'
              ? String(payload.previewSize || '320x180')
              : undefined
          }
        );
        return { currentPresentation };
      }

      case 'presentation.navigation': {
        const action = String(payload.action || '');
        if (action === 'next') await this.api.request('ActionNext');
        else if (action === 'previous') await this.api.request('ActionPrevious');
        else if (action === 'goto') {
          if (!Number.isInteger(payload.index) || payload.index < 0) {
            throw new Error('invalid_slide_index');
          }
          await this.api.request('ActionGoToIndex', { index: payload.index });
        } else {
          throw new Error('invalid_navigation_action');
        }
        const currentPresentation = await this.api.request<CurrentPresentation | null>(
          'GetCurrentPresentation',
          { include_slides: true, include_slide_comment: true }
        );
        return { currentPresentation };
      }

      case 'presentation.clear':
        await this.api.request('CloseCurrentPresentation');
        return { currentPresentation: null };

      case 'presentation.screen.mode': {
        const mode = String(payload.mode || 'normal');
        if (!['normal', 'wallpaper', 'blank', 'black'].includes(mode)) {
          throw new Error('invalid_screen_mode');
        }

        await this.api.request('SetF8', { enable: mode === 'wallpaper' });
        await this.api.request('SetF9', { enable: mode === 'blank' });
        await this.api.request('SetF10', { enable: mode === 'black' });

        this.lastState = {
          health: 'online',
          updatedAt: new Date().toISOString(),
          observed: {
            ...this.lastState.observed,
            screenMode: mode
          }
        };
        return { screenMode: mode };
      }

      case 'bible.search': {
        const text = String(payload.text || payload.reference || '');
        if (!text.trim()) throw new Error('bible_search_text_required');
        const matches = await this.api.request<unknown>('IdentifyVerseReferences', {
          value: text,
          language_id: payload.languageId ? String(payload.languageId) : undefined
        });
        return { matches };
      }

      case 'songs.search': {
        const results = await this.api.request<unknown[]>('SearchLyrics', {
          text: String(payload.text || ''),
          title: payload.title !== false,
          artist: payload.artist !== false,
          note: Boolean(payload.note),
          lyrics: Boolean(payload.lyrics),
          fields: String(payload.fields || 'id,title,artist,author,key,bpm')
        });
        return { results };
      }

      case 'songs.present': {
        const id = String(payload.id || '');
        if (!id) throw new Error('song_id_required');
        await this.api.request('ShowLyrics', {
          id,
          initial_index: Number.isInteger(payload.initialIndex)
            ? payload.initialIndex
            : 0
        });
        const currentPresentation = this.supported.has('presentation.slides.read')
          ? await this.api.request<CurrentPresentation | null>('GetCurrentPresentation')
          : null;
        return { songId: id, currentPresentation };
      }

      case 'playlist.sync': {
        const ids = Array.isArray(payload.ids)
          ? payload.ids.map(String).filter(Boolean)
          : [];
        if (!ids.length) throw new Error('playlist_ids_required');

        const existing = await this.api.request<Array<{ id?: string }>>('GetLyricsPlaylist');
        const existingIds = existing.map(item => String(item.id || '')).filter(Boolean);
        const alreadyEqual =
          existingIds.length === ids.length &&
          existingIds.every((id, index) => id === ids[index]);

        if (!alreadyEqual) {
          if (existing.length > 0) {
            await this.api.request('RemoveFromLyricsPlaylist', {
              indexes: existing.map((_, index) => index)
            });
          }
          await this.api.request('AddLyricsToPlaylist', {
            ids,
            index: -1,
            media_playlist: false
          });
        }

        return {
          playlistSongIds: ids,
          replacedSongIds: existingIds,
          changed: !alreadyEqual
        };
      }

      case 'playlist.write': {
        const ids = Array.isArray(payload.ids)
          ? payload.ids.map(String).filter(Boolean)
          : payload.id ? [String(payload.id)] : [];
        if (!ids.length) throw new Error('playlist_ids_required');
        await this.api.request('AddLyricsToPlaylist', {
          ids,
          index: Number.isInteger(payload.index) ? payload.index : -1,
          media_playlist: Boolean(payload.mediaPlaylist),
          event_id: payload.eventId ? String(payload.eventId) : undefined
        });
        return { addedSongIds: ids };
      }

      case 'bible.present': {
        const input: Record<string, unknown> = {};
        if (payload.id) input.id = String(payload.id);
        if (Array.isArray(payload.ids)) input.ids = payload.ids.map(String);
        if (payload.reference) input.references = String(payload.reference);
        if (payload.references) input.references = String(payload.references);
        if (payload.version) input.version = String(payload.version);
        if (payload.quickPresentation !== undefined) {
          input.quick_presentation = Boolean(payload.quickPresentation);
        }
        if (!input.id && !input.ids && !input.references) {
          throw new Error('bible_reference_required');
        }
        await this.api.request('ShowVerse', input);
        return { biblePresentationRequested: input };
      }

      case 'media.search': {
        const kind = String(payload.kind || 'video');
        const action =
          kind === 'audio' ? 'GetAudios' :
          kind === 'image' ? 'GetImages' :
          kind === 'video' ? 'GetVideos' :
          null;
        if (!action) throw new Error('unsupported_media_kind');

        const results = await this.api.request<unknown[]>(action, {
          folder: payload.folder ? String(payload.folder) : undefined,
          filter: payload.filter ? String(payload.filter) : undefined,
          include_metadata: payload.includeMetadata !== false,
          include_thumbnail: Boolean(payload.includeThumbnail)
        });
        return { mediaType: kind, results };
      }

      case 'media.open': {
        const kind = String(payload.kind || '');
        const file = String(payload.file || '');
        if (!file) throw new Error('media_file_required');

        if (kind === 'audio') {
          await this.api.request('PlayAudio', {
            file,
            settings: payload.settings && typeof payload.settings === 'object'
              ? payload.settings
              : undefined
          });
        } else if (kind === 'video') {
          await this.api.request('PlayVideo', {
            file,
            settings: payload.settings && typeof payload.settings === 'object'
              ? payload.settings
              : undefined
          });
        } else if (kind === 'image') {
          await this.api.request('ShowImage', {
            file,
            automatic: payload.automatic && typeof payload.automatic === 'object'
              ? payload.automatic
              : undefined
          });
        } else {
          throw new Error('unsupported_media_kind');
        }

        return { mediaType: kind, file, opened: true };
      }

      case 'stage.message':
        await this.api.request('SetTextCommunicationPanel', {
          text: String(payload.text || ''),
          show: payload.show !== false,
          display_ahead: payload.displayAhead !== false,
          theme: payload.theme && typeof payload.theme === 'object'
            ? payload.theme
            : undefined
        });
        return { stageMessageVisible: payload.show !== false };

      default:
        throw new Error('capability_not_supported');
    }
  }

  private result(
    command: LiveCommand,
    started: number,
    accepted: boolean,
    errorCode: string,
    recoverable: boolean
  ): CommandResult {
    return {
      commandId: command.id,
      providerInstanceId: this.descriptor.id,
      accepted,
      latencyMs: Math.max(0, Math.round(performance.now() - started)),
      errorCode,
      recoverable
    };
  }
}
