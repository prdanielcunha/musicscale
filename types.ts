
import type { User as FirebaseUser } from 'firebase/auth';

export type User = FirebaseUser;

export interface CreatedBy {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  name?: string | null;
}

export interface Permissions {
  canManageUsers: boolean;
  canManageRoles: boolean;
  canManageRepertoire: boolean;
  canManageScales: boolean;
  canViewContent: boolean;
  canManageChords: boolean;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permissions;
  organizationId?: string | null;
  createdBy?: CreatedBy | null;
  createdAt?: string | null;
  lastModifiedBy?: CreatedBy | null;
  lastModifiedAt?: string | null;
}

export type InstrumentCategory = 'Ministro' | 'Voz' | 'Instrumento';

export interface Instrument {
  id: string;
  name: string;
  category: InstrumentCategory;
  createdBy?: CreatedBy | null;
  createdAt?: string | null;
  lastModifiedBy?: CreatedBy | null;
  lastModifiedAt?: string | null;
}

export interface ChordViewerSettings {
  fontSize: number;
  fontFamily: string;
  lyricsColor?: string; // Legacy
  chordsColor?: string; // Legacy
  lyricsColorIndex?: number;
  chordsColorIndex?: number;
}

export interface LyricsViewerSettings {
  fontSize: number;
  fontFamily: string;
  textColor?: string; // Legacy
  textColorIndex?: number;
}

export interface OrganizationSettings {
  allowMemberInvites: boolean;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  city?: string | null;
  state?: string | null;
  ownerUserId: string;
  subscriptionStatus?: 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete_expired' | 'incomplete' | 'trialing' | 'free';
  subscriptionPlan?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  trialEndsAt?: number | null;
  currentPeriodEnd?: number | null;
  accessUpdatedAt?: any;
  plan?: 'free' | 'pro' | string;
  addons?: string[];
  createdAt: string;
  featureFlags?: Record<string, boolean>;
  features?: Record<string, boolean>;
}

export interface OrganizationMember {
  id: string; // usually `${orgId}_${userId}`
  organizationId: string;
  userId: string;
  role: 'owner' | 'admin' | 'leader' | 'member';
  status: 'active' | 'invited' | 'disabled';
  createdAt: string;
}

export interface SubscriptionFeatures {
  globalLibrary: boolean;
  globalImports: boolean;
  [key: string]: boolean;
}

export interface Subscription {
  id: string; // Typically organizationId
  organizationId: string;
  plan: 'starter' | 'pro' | 'free' | string;
  status: 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete_expired' | 'incomplete' | 'trialing' | 'free';
  trialEndsAt?: number;
  subscriptionEndsAt?: number;
  features?: SubscriptionFeatures;
  // Legacy
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  productId?: string;
  currentPeriodEnd?: number; // Unix timestamp
  cancelAtPeriodEnd?: boolean;
}

export interface Invite {
  id: string;
  organizationId: string;
  organizationName: string;
  email?: string; // If invited by email specifically
  roleId: string;
  status: 'pending' | 'accepted' | 'revoked';
  token: string; // unique link token
  createdBy: CreatedBy;
  createdAt: string;
  expiresAt: string;
}

export interface UserProfile {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    organizationId?: string | null; // Multi-tenant ID
    activeOrganizationId?: string | null;
    primaryOrganizationId?: string | null;
    organizations?: string[];
    roleId: string;
    role?: string; // Legacy
    systemRole?: string;
    organizationRole?: string;
    appRole?: string;
    musicscaleRole?: string;
    ministryFunction?: string | string[];
    products?: string[];
    stripeCustomerId?: string | null;
    specialtyIds?: string[];
    createdAt?: string | null;
    lastModifiedAt?: string | null;
    apps?: {
       [key: string]: {
           access: boolean;
           status: string;
           plan: string;
           [key: string]: any;
       }
    };
    address?: {
        street: string;
        city: string;
        state: string;
        zip: string;
    };
    chordViewerSettings?: ChordViewerSettings;
    lyricsViewerSettings?: LyricsViewerSettings;
}

export type FreshnessStatus = 'new' | 'old' | 'default';
export type FreshnessSource = 'auto' | 'manual';

export interface FreshnessMetadata {
  status: FreshnessStatus;
  source: FreshnessSource;
  manualResetAt?: string | null;
  autoUpdatedAt?: string | null;
}

export interface Tag {
  id: string;
  name: string;
  createdBy?: CreatedBy | null;
  createdAt?: string | null;
  lastModifiedBy?: CreatedBy | null;
  lastModifiedAt?: string | null;
}

export interface GlobalSong {
  onboardingStarter?: boolean;
  onboardingStarterRank?: number;
  onboardingStarterVersion?: string;
  id: string;
  title: string;
  normalizedTitle: string;
  artist: string;
  normalizedArtist: string;
  key?: string;
  bpm?: number;
  lyrics?: string;
  chords?: string;
  chordsUrl?: string;
  videoUrl?: string;
  language?: 'pt' | 'en' | 'es' | 'other' | 'unknown';
  languageDetection?: {
    confidence: number;
    method: 'ai' | 'heuristic' | 'manual';
  };
  tags?: string[];
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  status: 'active' | 'draft';
  importCount: number;
  freshness?: FreshnessMetadata;
  revision?: number;
}

export interface SongSubmission {
  id: string;
  title: string;
  artist: string;
  key?: string;
  bpm?: number;
  lyrics?: string;
  chords?: string;
  organizationId: string;
  submittedBy: string; // userId
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  globalSongId?: string; // if approved
}

export interface Song {
  onboardingStarterPack?: boolean;
  onboardingStarterVersion?: string;
  usageConsumed?: boolean;
  id: string;
  organizationId: string;
  title: string;
  artist: string;
  key: string;
  originalKey?: string;
  selectedKey?: string;
  version?: string;
  bpm?: number | null;
  suggestedBpm?: number | null;
  bpmConfidence?: 'high' | 'medium' | 'low' | 'unknown' | 'user_provided';
  bpmSource?: 'source_text' | 'ai_suggestion' | 'provider_name' | 'manual' | 'not_detected';
  rhythm?: string;
  sections?: string[];
  status: 'active' | 'inactive';
  tagIds: string[];
  lyrics: string;
  chords: string;
  chordsUrl: string;
  videoUrl: string;
  language?: 'pt' | 'en' | 'es' | 'other' | 'unknown';
  languageDetection?: {
    confidence: number;
    method: 'ai' | 'heuristic' | 'manual';
  };
  createdAt: string; // ISO date string
  lastPlayed: string | null; // ISO date string YYYY-MM-DD
  lastScheduledAt?: string | null; // ISO date string
  isNew?: boolean;
  freshness?: FreshnessMetadata;
  createdBy: CreatedBy;
  importedBy?: string | null;
  sourceType?: string;
  aiProcessed?: boolean;
  lastModifiedBy?: CreatedBy | null;
  lastModifiedAt?: string | null;
  chordsCreatedBy?: CreatedBy | null;
  chordsLastModifiedBy?: CreatedBy | null;
  chordsLastModifiedAt?: string | null; // ISO date string
  originGlobalSongId?: string; // Reference to the global library song
  bandNotes?: string; // Internal band comments/observations for this song
  tabs?: { section: string, content: string }[];
  metadata?: any;
}

export interface PopulatedSong extends Song {
    tags: Tag[];
}

export interface EventType {
  id: string;
  name: string;
  createdBy?: CreatedBy | null;
  createdAt?: string | null;
  lastModifiedBy?: CreatedBy | null;
  lastModifiedAt?: string | null;
}

export interface Location {
  id: string;
  name: string;
  createdBy?: CreatedBy | null;
  createdAt?: string | null;
  lastModifiedBy?: CreatedBy | null;
  lastModifiedAt?: string | null;
}

export interface EventName {
  id: string;
  name: string;
  createdBy?: CreatedBy | null;
  createdAt?: string | null;
  lastModifiedBy?: CreatedBy | null;
  lastModifiedAt?: string | null;
}

export interface WorshipCue {
  id: string;
  type: 'chorus' | 'instrumental' | 'bridge' | 'spontaneous' | 'end' | 'custom';
  message?: string;
  timestamp: number;
}

export interface LiveWorshipSession {
  id: string; // usually same as scaleId
  scaleId: string;
  activeSongId: string | null;
  activeCue: WorshipCue | null;
  keyOverrides: Record<string, string>; // { songId: newKey }
  songsOrder: string[]; // array of songIds
  spontaneousSongs: { id: string; title: string; chords: string }[];
  mode: 'worship' | 'rehearsal';
  lastUpdated: number;
  leaderId: string | null;
}

export interface EventAssignment {
  eventAssignmentId: string;
  sourceBandScaleId: string | null;
  sourceAssignmentId: string | null;
  userId: string;
  functionId: string;
  functionName: string;
  functionCategory: 'musical_instrument' | 'vocal' | 'technical' | 'leadership' | 'general';
  active: boolean;
  assignmentRevision: number;
}

export type EventAssignmentResponseStatus =
  | 'pending'
  | 'accepted'
  | 'maybe'
  | 'declined';

export interface EventAssignmentResponse {
  organizationId: string;
  musicScaleId: string;
  eventAssignmentId: string;

  userId: string;
  functionId: string;
  functionName?: string;

  status: EventAssignmentResponseStatus;

  reason: string | null;

  respondedAt: string | null;
  respondedBy: string | null;

  active: boolean;

  assignmentRevision: number;
  respondedAgainstRevision: number | null;

  responseRevision: number;

  createdAt: string;
  updatedAt: string;

  override: {
    changedBy: string;
    changedAt: string;
    reason: string;
  } | null;
}

export interface ScaleSongSettings {
  key?: string | null;
  bpm?: number | null;
}

export interface Scale {
  id: string;
  organizationId?: string;
  date: string; // ISO date string YYYY-MM-DD
  time?: string; // Optional time string HH:mm
  arrivalDate?: string;
  arrivalTime?: string;
  rehearsalDate?: string;
  rehearsalTime?: string;
  durationMinutes?: number;
  status?: 'draft' | 'published' | 'cancelled' | 'completed';
  publishRevision?: number;
  eventAssignments?: EventAssignment[];
  observations: string;
  songIds: string[];
  songSettings?: Record<string, ScaleSongSettings>;
  eventTypeId: string;
  locationId: string;
  eventNameId?: string | null;
  bandScaleId?: string | null;
  createdBy: CreatedBy;
  createdAt: string;
  lastModifiedBy?: CreatedBy | null;
  lastModifiedAt?: string | null;
}

export interface MusicScalePublishPatch {
  date?: string;
  time?: string | null;
  eventTypeId?: string;
  locationId?: string;
  eventNameId?: string | null;
  observations?: string;
  songIds?: string[];
  songSettings?: Record<string, ScaleSongSettings>;
  durationMinutes?: number;
  bandScaleId?: string | null;
}

export interface MusicScalePublishPayload {
  bandScaleId?: string | null;
  scalePatch?: MusicScalePublishPatch;
}

export interface BandMember {
  userId: string;
  instrumentId: string;
}

export interface BandScale {
  id: string;
  organizationId?: string;
  date?: string; // ISO date string YYYY-MM-DD
  time?: string; // Optional time string HH:mm
  observations?: string;
  assignments: BandMember[];
  eventTypeId?: string;
  locationId?: string;
  eventNameId?: string | null;
  musicScaleId?: string | null;
  createdBy: CreatedBy;
  createdAt: string;
  lastModifiedBy?: CreatedBy | null;
  lastModifiedAt?: string | null;
}

export interface FixedBandScale {
  id: string;
  name: string;
  assignments: BandMember[];
  createdBy: CreatedBy;
  createdAt: string;
  lastModifiedBy?: CreatedBy | null;
  lastModifiedAt?: string | null;
}

export interface PopulatedBandScale {
  id: string;
  date?: string;
  time?: string;
  observations?: string;
  assignments: { user: UserProfile; instrument: Instrument }[];
  eventType?: EventType;
  location?: Location;
  eventName?: EventName | null;
  musicScaleId?: string | null;
  createdBy: CreatedBy;
  createdAt: string;
  lastModifiedBy?: CreatedBy | null;
  lastModifiedAt?: string | null;
}

export interface PopulatedScale {
  id:string;
  date: string;
  time?: string;
  durationMinutes?: number;
  status?: 'draft' | 'published' | 'cancelled' | 'completed';
  observations: string;
  songs: PopulatedSong[];
  songSettings?: Record<string, ScaleSongSettings>;
  eventType: EventType;
  location: Location;
  eventName?: EventName | null;
  bandScaleId?: string | null;
  bandScale?: PopulatedBandScale | null;
  createdBy: CreatedBy;
  createdAt: string;
  lastModifiedBy?: CreatedBy | null;
  lastModifiedAt?: string | null;
}

export interface SuggestedSong {
  id: string;
  title: string;
  artist: string;
  link: string;
}

export interface Suggestion {
  id: string;
  songs: SuggestedSong[];
  createdBy: CreatedBy;
  createdAt: string; // ISO date string
  isRead: boolean;
  isArchived?: boolean;
}

export interface GlobalSongUpdateResult {
  status: 'success' | 'deduplicated';
}

export type ScaleSongSettingsUpdateResult = GlobalSongUpdateResult;

export type ScaleSongSettingsChangeHandler = (
  key: string | null,
  bpm: number | null,
  isGlobal: boolean
) => Promise<ScaleSongSettingsUpdateResult>;

