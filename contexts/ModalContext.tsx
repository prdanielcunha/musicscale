import { logger } from '../lib/logger';

import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from './ToastContext';
import { useNavigate, useLocation } from 'react-router-dom';
import type { PopulatedSong, Song, Scale, PopulatedScale, BandScale, PopulatedBandScale, MusicScalePublishPayload, MusicScalePublishPatch } from '../types';
import { useMusic } from './MusicDataContext';
import { useAuth } from './AuthContext';
import { DuplicateMatch } from '../components/songs/DuplicateSongModal';
import { getSongSimilarityScore } from '../lib/songMatch';
import { useApi } from './ApiContext';
import * as suggestionApi from '../services/suggestionsService';
import { useSuggestionsContext } from './SuggestionContext';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { db } from "../services/firebase";

export type MusicScaleSaveIntent = "save-draft" | "publish";

export type MusicScaleWritableData = Omit<Scale, "id" | "createdBy" | "createdAt"> | Scale;
export type BandScaleWritableData = Omit<BandScale, "id" | "createdBy" | "createdAt"> | BandScale;

export interface MusicScaleSaveRequest {
  data: MusicScaleWritableData;
  intent: MusicScaleSaveIntent;
  idempotencyKey: string;
}

export type MusicScaleSaveResult =
  | { status: "draft-saved"; scaleId: string }
  | { status: "published"; scaleId: string; version?: number }
  | { status: "publish-unavailable" }
  | { status: "publish-failed"; scaleId?: string; draftPreserved: boolean; correlationId?: string }
  | { status: "republish-failed"; scaleId?: string; publishedPreserved: boolean; correlationId?: string };


// Keep essential components eager or very light
import Modal from '../components/common/Modal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import SuccessModal from '../components/common/SuccessModal';

// Lazy load heavy modals
const DuplicateSongModal = lazy(() => import('../components/songs/DuplicateSongModal').then(m => ({ default: m.DuplicateSongModal })));
const SongForm = lazy(() => import('../components/songs/SongForm'));
const SongDetailModal = lazy(() => import('../components/songs/SongDetailModal'));
const AiSongImportModal = lazy(() => import('../components/songs/AiSongImportModal'));
const ModernScaleForm = lazy(() => import('../components/scales/ModernScaleForm'));
const ScaleDetailModal = lazy(() => import('../components/scales/ScaleDetailModal'));
const AddChordModal = lazy(() => import('../components/chords/AddChordModal'));
const SuggestionFormModal = lazy(() => import('../components/suggestions/SuggestionFormModal'));
const HelpModal = lazy(() => import('../components/help/HelpModal'));
const SupportModal = lazy(() => import('../components/help/SupportModal'));
const FeedbackModal = lazy(() => import('../components/common/FeedbackModal').then(m => ({ default: m.FeedbackModal })));
const WhatsNewModal = lazy(() => import('../components/WhatsNewModal').then(m => ({ default: m.WhatsNewModal })));


const createClientNotification = async (
  orgId: string,
  recipientId: string,
  type: 'band_scale' | 'scale' | 'suggestion' | 'system',
  title: string,
  message: string,
  link: string,
  metadata?: Record<string, unknown>
) => {
  try {
    const notificationsRef = collection(db, `organizations/${orgId}/notifications`);
    await addDoc(notificationsRef, {
      recipientId,
      type,
      title,
      message,
      link,
      metadata: metadata || {},
      isRead: false,
      isArchived: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("Failed to create client-side notification:", err);
  }
};


interface ModalContextType {
  // Ai Import
  isAiSongImportOpen: boolean;
  openAiSongImport: () => void;
  closeAiSongImport: () => void;
  
  // Whats New
  isWhatsNewOpen: boolean;
  openWhatsNew: () => void;
  closeWhatsNew: () => void;

  openSongForm: (song?: PopulatedSong) => void;
  openSongDetail: (song: PopulatedSong, keepCurrentOpen?: boolean, scaleContext?: {  scaleId?: string, songs: PopulatedSong[], currentIndex: number } | null, startInPerformanceMode?: boolean) => void;
  openDeleteSongConfirmation: (song: PopulatedSong) => void;
  openScaleForm: (scale?: Scale, preselectedSongIds?: string[]) => void;
  openScaleDetail: (scale: PopulatedScale, action?: 'delete') => void;
  openBandScaleForm: (scale?: BandScale, options?: { linkToMusicScaleId: string, prefillData?: Partial<BandScale> }) => void;
  openBandScaleDetail: (scale: PopulatedBandScale, action?: 'delete') => void;
  openAddChordModal: () => void;
  openSuggestionForm: () => void;
  openHelpModal: (section: string) => void;
  openSupportModal: () => void;
  saveChord: (data: { songId: string, chords: string }) => Promise<void>;
  isSubmitting: boolean;
  handleSaveScale: (req: MusicScaleSaveRequest | { data: BandScaleWritableData; idempotencyKey?: string }) => Promise<MusicScaleSaveResult | void>;
  // Feedback Modal
  isFeedbackOpen: boolean;
  feedbackType: 'bug' | 'suggestion' | 'feedback';
  openFeedback: (type?: 'bug' | 'suggestion' | 'feedback') => void;
  closeFeedback: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);


interface ErrorLike {
  message?: unknown;
  code?: unknown;
  status?: unknown;
  correlationId?: unknown;
}

export function extractErrorDetails(error: unknown): { message?: string; code?: string; status?: number; correlationId?: string } {
    const result: { message?: string; code?: string; status?: number; correlationId?: string } = {};
    if (error instanceof Error) {
        result.message = error.message;
    }
    if (typeof error === 'object' && error !== null) {
        const errObj = error as ErrorLike;
        if (typeof errObj.message === 'string') {
            result.message = errObj.message;
        }
        if (typeof errObj.code === 'string') {
            result.code = errObj.code;
        }
        if (typeof errObj.status === 'number') {
            result.status = errObj.status;
        }
        if (typeof errObj.correlationId === 'string') {
            result.correlationId = errObj.correlationId;
        }
    }
    return result;
}

export function buildMusicScalePublishPayload(
    scaleData: MusicScaleWritableData
): MusicScalePublishPayload {
    const scalePatch: MusicScalePublishPatch = {};

    if (scaleData.date !== undefined) {
        scalePatch.date = scaleData.date;
    }
    if (scaleData.time !== undefined) {
        scalePatch.time = scaleData.time;
    }
    if (scaleData.eventTypeId !== undefined) {
        scalePatch.eventTypeId = scaleData.eventTypeId;
    }
    if (scaleData.locationId !== undefined) {
        scalePatch.locationId = scaleData.locationId;
    }
    if (scaleData.eventNameId !== undefined) {
        scalePatch.eventNameId = scaleData.eventNameId;
    }
    if (scaleData.observations !== undefined) {
        scalePatch.observations = scaleData.observations;
    }
    if (scaleData.songIds !== undefined) {
        scalePatch.songIds = scaleData.songIds;
    }
    if (scaleData.songSettings !== undefined) {
        scalePatch.songSettings = scaleData.songSettings;
    }
    
    if (scaleData.durationMinutes !== undefined && scaleData.durationMinutes !== null) {
        if (typeof scaleData.durationMinutes !== 'number' || !Number.isInteger(scaleData.durationMinutes) || scaleData.durationMinutes <= 0 || !Number.isFinite(scaleData.durationMinutes)) {
            throw new Error("Invalid durationMinutes");
        }
        scalePatch.durationMinutes = scaleData.durationMinutes;
    }

    if ('bandScaleId' in scaleData && scaleData.bandScaleId !== undefined) {
        scalePatch.bandScaleId = scaleData.bandScaleId;
    }

    return { scalePatch };
}

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userProfile } = useAuth();
  const api = useApi();
  const { refreshData, songs, tags, scales, bandScales, populatedBandScales, instruments, eventTypes, locations, eventNames } = useMusic();
  const { refreshSuggestions } = useSuggestionsContext();

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Song Modals State
  const [songToEdit, setSongToEdit] = useState<PopulatedSong | null>(null);
  const [songToView, setSongToView] = useState<PopulatedSong | null>(null);
  const [songToDelete, setSongToDelete] = useState<PopulatedSong | null>(null);
  const [duplicateSongInfo, setDuplicateSongInfo] = useState<{ 
    newSongData: Omit<Song, 'id' | 'createdAt' | 'lastPlayed' | 'createdBy'> | Song, 
    matches: DuplicateMatch[], 
    options: { saveToOrganization: boolean; saveToGlobalLibrary: boolean },
    onSuccess?: () => void 
  } | null>(null);
  const [startInPerformanceMode, setStartInPerformanceMode] = useState<boolean>(false);

  // Scale Modals State
  const [scaleToEdit, setScaleToEdit] = useState<Scale | BandScale | null>(null);
  const [scaleType, setScaleType] = useState<'music' | 'band' | null>(null);
  const [preselectedSongIds, setPreselectedSongIds] = useState<string[]>([]);
  const [scaleToView, setScaleToView] = useState<PopulatedScale | PopulatedBandScale | null>(null);
  const [scaleToDelete, setScaleToDelete] = useState<PopulatedScale | PopulatedBandScale | null>(null);
  const [linkingOptions, setLinkingOptions] = useState<{ linkToMusicScaleId: string } | null>(null);

  // In-modal navigation state
  const [scaleNavigationContext, setScaleNavigationContext] = useState<{ scaleId?: string, songs: PopulatedSong[], currentIndex: number } | null>(null);


  // Chord Modals State
  const [isAddChordModalOpen, setAddChordModalOpen] = useState(false);

  // Suggestion Modal State
  const [isSuggestionFormOpen, setSuggestionFormOpen] = useState(false);
  
  // Help Modal State
  const [helpModalSection, setHelpModalSection] = useState<string | null>(null);
  const [isSupportModalOpen, setSupportModalOpen] = useState(false);

  // Success Modal State
  const [successConfig, setSuccessConfig] = useState<{ title: string; message: string; actionText: string; onAction: () => void; stayText: string; onStay?: () => void; } | null>(null);

  // Feedback Modal State
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'bug'|'suggestion'|'feedback'>('feedback');

  const [isAiSongImportOpen, setIsAiSongImportOpen] = useState(false);
  const [isWhatsNewOpen, setIsWhatsNewOpen] = useState(false);
  
  const closeAllModals = useCallback(() => {
    setSongToEdit(null);
    setSongToView(null);
    setSongToDelete(null);
    setScaleToEdit(null);
    setScaleType(null);
    setPreselectedSongIds([]);
    setScaleToView(null);
    setScaleToDelete(null);
    setAddChordModalOpen(false);
    setSuggestionFormOpen(false);
    setHelpModalSection(null);
    setSupportModalOpen(false);
    setSuccessConfig(null);
    setLinkingOptions(null);
    setDuplicateSongInfo(null);
    setScaleNavigationContext(null);
    setIsAiSongImportOpen(false);
    setIsWhatsNewOpen(false);
    setIsFeedbackOpen(false);
  }, []);

  const openFeedback = useCallback((type: 'bug'|'suggestion'|'feedback' = 'feedback') => {
    closeAllModals();
    setFeedbackType(type);
    setIsFeedbackOpen(true);
  }, [closeAllModals]);

  const closeFeedback = useCallback(() => setIsFeedbackOpen(false), []);

  const openAiSongImport = useCallback(() => { closeAllModals(); setIsAiSongImportOpen(true); }, [closeAllModals]);
  const closeAiSongImport = useCallback(() => { setIsAiSongImportOpen(false); }, []);

  const openWhatsNew = useCallback(() => { closeAllModals(); setIsWhatsNewOpen(true); }, [closeAllModals]);
  const closeWhatsNew = useCallback(() => { setIsWhatsNewOpen(false); }, []);

  const handleCloseScaleDetail = useCallback(() => {
    const currentPath = location.pathname;
    const isMusicScalePath = currentPath.startsWith('/scales/');
    const isBandScalePath = currentPath.startsWith('/band-scales/');
    
    const wasOnDetailView = (isMusicScalePath || isBandScalePath) && currentPath.split('/').length > 2;

    setScaleToView(null);
    setScaleType(null);

    if (wasOnDetailView) {
        navigate(isMusicScalePath ? '/scales' : '/band-scales', { replace: true });
    }
  }, [location.pathname, navigate]);

  // Song Handlers
  const openSongForm = useCallback((song?: PopulatedSong) => { closeAllModals(); setSongToEdit(song || {} as PopulatedSong); }, [closeAllModals]);
  
  const openSongDetail = useCallback((song: PopulatedSong, keepCurrentOpen = false, scaleContext: { scaleId?: string, songs: PopulatedSong[], currentIndex: number } | null = null, startInPerformanceMode = false) => {
    if (!keepCurrentOpen) {
      closeAllModals();
    }
    setSongToView(song);
    setScaleNavigationContext(scaleContext);
    setStartInPerformanceMode(startInPerformanceMode);
  }, [closeAllModals]);

  const openDeleteSongConfirmation = useCallback((song: PopulatedSong) => { closeAllModals(); setSongToDelete(song); }, [closeAllModals]);

  const handleSaveSong = useCallback(async (
    songData: Omit<Song, 'id' | 'createdAt' | 'lastPlayed' | 'createdBy'> | Song,
    options: { saveToOrganization: boolean; saveToGlobalLibrary: boolean } = { saveToOrganization: true, saveToGlobalLibrary: false },
    onSuccess?: () => void
  ) => {
    if (!user || !userProfile) return;

    const isEcosystemAdmin = userProfile?.systemRole === "ceo" || userProfile?.systemRole === "admin" || userProfile?.systemRole === "global_admin";

    // Check for duplicates only when creating a new song
    if (!('id' in songData)) {
        let matches: DuplicateMatch[] = [];

        if (options.saveToOrganization) {
            for (const s of songs) {
              const score = getSongSimilarityScore(songData, s);
              if (score >= 0.7) {
                 matches.push({
                   song: s,
                   score,
                   matchType: score === 1.0 ? 'exact' : (score >= 0.85 ? 'probable' : 'possible'),
                   location: 'repertoire'
                 });
              }
            }
        }
        
        if (options.saveToGlobalLibrary && isEcosystemAdmin) {
            const { checkGlobalDuplicates } = await import('../services/globalLibraryService');
            const result = await checkGlobalDuplicates(songData.title, songData.artist, songData.key);
            if (result.isDuplicate || result.matches.length > 0) {
                for (const match of result.matches) {
                   matches.push({
                       song: match,
                       score: result.isDuplicate ? 1.0 : 0.85,
                       matchType: result.isDuplicate ? 'exact' : 'probable',
                       location: 'global_library'
                   });
                }
            }
        }

        matches.sort((a, b) => b.score - a.score);

        if (matches.length > 0) {
            setDuplicateSongInfo({ newSongData: songData, matches, options, onSuccess });
            return; // Stop the save process and wait for user confirmation
        }
    }

    setIsSubmitting(true);
    try {
      if (!api) return;
      
      if (options.saveToOrganization) {
        if ('id' in songData) {
          const { tags, ...songToSave } = songData as PopulatedSong;
          await api.songs.update(songToSave.id, songToSave as Song);
        } else {
          await api.songs.create(songData);
        }
      }

      const isEcosystemAdmin = userProfile?.systemRole === "ceo" || userProfile?.systemRole === "admin" || userProfile?.systemRole === "global_admin";
      if (options.saveToGlobalLibrary && isEcosystemAdmin) {
        await api.submitToGlobal(userProfile, songData);
      }

      setSongToEdit(null);
      if (onSuccess) onSuccess();

      if (options.saveToGlobalLibrary) {
        setSuccessConfig({
          title: 'Música Compartilhada!',
          message: options.saveToOrganization 
            ? 'A música foi salva no seu repertório e adicionada à Biblioteca Viva MusicScale.'
            : 'A música foi adicionada à Biblioteca Viva MusicScale.',
          actionText: 'Ok',
          onAction: () => setSuccessConfig(null),
          stayText: '',
        });
      }

      await refreshData();
    } catch (error) {
      logger.error("Failed to save song", error);
      const errDetails = extractErrorDetails(error);
      let errorMsg = errDetails.message || t('common.unknownError', "Ocorreu um erro desconhecido.");
      if (errDetails.code === 'permission-denied') errorMsg = t('common.permissionDenied', "Sem permissão. Verifique seu papel na organização.");
      toast({ type: 'error', message: t('common.errorSavingSong', "Erro ao salvar música"), description: `${t('common.details', 'Detalhes')}: ${errorMsg} (${errDetails.code || ''})` });
    } finally {
      setIsSubmitting(false);
    }
  }, [user, userProfile, songs, refreshData, api]);
  
  const handleConfirmDuplicateSave = useCallback(async () => {
    if (!duplicateSongInfo || !user || !userProfile || !api) return;

    setIsSubmitting(true);
    try {
      if (duplicateSongInfo.options.saveToOrganization) {
        await api.songs.create(duplicateSongInfo.newSongData);
      }
      
      const isEcosystemAdmin = userProfile?.systemRole === "ceo" || userProfile?.systemRole === "admin" || userProfile?.systemRole === "global_admin";
      if (duplicateSongInfo.options.saveToGlobalLibrary && isEcosystemAdmin) {
        await api.submitToGlobal(userProfile, duplicateSongInfo.newSongData, true);
      }

      closeAllModals();
      setDuplicateSongInfo(null);
      if (duplicateSongInfo.onSuccess) duplicateSongInfo.onSuccess();

      if (duplicateSongInfo.options.saveToGlobalLibrary) {
        setSuccessConfig({
          title: t('songs.sharedTitle', 'Música Compartilhada!'),
          message: duplicateSongInfo.options.saveToOrganization 
            ? t('songs.savedAndSharedMsg', 'A música foi salva no seu repertório e adicionada à Biblioteca Viva MusicScale.')
            : t('songs.sharedMsg', 'A música foi adicionada à Biblioteca Viva MusicScale.'),
          actionText: 'Ok',
          onAction: () => setSuccessConfig(null),
          stayText: '',
        });
      }

      await refreshData();
    } catch (error) {
        logger.error("Failed to save duplicate song", error);
        const errDetails = extractErrorDetails(error);
        let errorMsg = errDetails.message || t('common.unknownError', "Ocorreu um erro desconhecido.");
        if (errDetails.code === 'permission-denied') errorMsg = t('common.permissionDenied', "Sem permissão. Verifique seu papel na organização.");
        toast({ type: 'error', message: t('common.error', "Erro"), description: `${t('common.details', 'Detalhes')}: ${errorMsg}` });
    } finally {
        setIsSubmitting(false);
    }
  }, [duplicateSongInfo, user, userProfile, refreshData, closeAllModals, api]);

  const handleDeleteSong = useCallback(async () => {
    if (!songToDelete || !api) return;
    setIsSubmitting(true);
    try {
      await api.songs.delete(songToDelete.id);
      setSongToDelete(null);
      await refreshData();
    } catch (error) {
      logger.error("Failed to delete song", error);
      const errDetails = extractErrorDetails(error);
        let errorMsg = errDetails.message || t('common.unknownError', "Ocorreu um erro desconhecido.");
        if (errDetails.code === 'permission-denied') errorMsg = t('common.permissionDenied', "Sem permissão. Verifique seu papel na organização.");
      toast({ type: 'error', message: t('common.error', "Erro"), description: `${t('common.details', 'Detalhes')}: ${errorMsg}` });
    } finally {
      setIsSubmitting(false);
    }
  }, [songToDelete, refreshData, api]);

  // Scale Handlers
  const openScaleForm = useCallback((scale?: Scale, preselectedIds?: string[]) => {
    closeAllModals();
    setScaleType('music');
    setScaleToEdit(scale || null);
    setPreselectedSongIds(preselectedIds || []);
  }, [closeAllModals]);
  
  const openBandScaleForm = useCallback((scale?: BandScale, options?: { linkToMusicScaleId: string, prefillData?: Partial<BandScale> }) => {
      closeAllModals();
      setScaleType('band');
      const scaleForForm = { ...(scale || {}) };
      if (options?.prefillData) {
          Object.assign(scaleForForm, options.prefillData);
      }
      setScaleToEdit(scaleForForm as BandScale);
      if (options?.linkToMusicScaleId) {
          setLinkingOptions({ linkToMusicScaleId: options.linkToMusicScaleId });
      }
  }, [closeAllModals]);

  const openScaleDetail = useCallback((scale: PopulatedScale, action?: 'delete') => {
    closeAllModals();
    if (action === 'delete') {
      setScaleToDelete(scale);
    } else {
      setScaleToView(scale);
    }
    setScaleType('music');
  }, [closeAllModals]);

  const openBandScaleDetail = useCallback((scale: PopulatedBandScale, action?: 'delete') => {
    closeAllModals();
     if (action === 'delete') {
      setScaleToDelete(scale);
    } else {
      setScaleToView(scale);
    }
    setScaleType('band');
  }, [closeAllModals]);
  
  const { organization } = useAuth();
  const isCommandApiV1Enabled = organization?.featureFlags?.['musicscale.bandScaleCommandApiV1'] === true || organization?.features?.['musicscale.bandScaleCommandApiV1'] === true;
  const isMusicScalePublishCommandEnabled = organization?.featureFlags?.['musicscale.musicScalePublishCommandV1'] === true || organization?.features?.['musicscale.musicScalePublishCommandV1'] === true;

  const scaleSaveInFlightRef = React.useRef(false);

  const handleSaveScale = useCallback(async (
    req: MusicScaleSaveRequest | { data: BandScaleWritableData; idempotencyKey?: string }
  ): Promise<MusicScaleSaveResult | void> => {
    if (scaleSaveInFlightRef.current) return;
    
    if (!user || !userProfile || !api) {
        logger.error("Cannot save scale: user, userProfile or api is missing", { user: !!user, userProfile: !!userProfile, api: !!api });
        return;
    }
    
    scaleSaveInFlightRef.current = true;
    setIsSubmitting(true);
    
    try {
        if (scaleType === 'music') {
            const musicReq = req as MusicScaleSaveRequest;
            const orgId = organization?.id || "";
            const isPublishIntent = musicReq.intent === 'publish';
            const scaleData = musicReq.data as MusicScaleWritableData;
            let idempotencyKey = musicReq.idempotencyKey;

            if (isPublishIntent && !isMusicScalePublishCommandEnabled) {
                toast({
                    title: t("scaleModal.publishUnavailable"),
                    description: t("scaleModal.publishUnavailableDescription"),
                    variant: "destructive"
                });
                return { status: "publish-unavailable" };
            }

            // Check if we need to bootstrap taxonomy implicitly
            if (eventTypes.length === 0 || locations.length === 0) {
                logger.info("Implicitly bootstrapping taxonomy as eventTypes or locations are empty");
                try {
                    const token = await user.getIdToken();
                    const bootstrapRes = await fetch('/api/v1/onboarding/bootstrap', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                            'x-organization-id': orgId
                        }
                    });
                    if (bootstrapRes.ok) {
                        logger.info("Implicit taxonomy bootstrap completed successfully");
                        await refreshData();
                    } else {
                        logger.warn("Implicit taxonomy bootstrap returned non-ok status", bootstrapRes.status);
                    }
                } catch (bootstrapErr) {
                    logger.error("Failed to implicitly bootstrap taxonomy", bootstrapErr);
                }
            }

            let musicScaleId: string;
            const isUpdate = 'id' in scaleData && !!scaleData.id && scaleData.id !== 'CLONE';
            
            // Preserve the original status so we don't accidentally downgrade published scales to draft
            const currentStatus = isUpdate && scaleToEdit && 'status' in scaleToEdit ? (scaleToEdit as Scale).status || "draft" : "draft";
            const updateData = { ...scaleData, status: currentStatus };
            
            if (isPublishIntent) {
                // For publishing, if it is a new scale, we MUST create it as a draft first to get a valid musicScaleId
                if (!isUpdate) {
                    const initialDraftData = { ...scaleData, status: "draft" as const };
                    musicScaleId = await api.scales.create(initialDraftData as Omit<Scale, 'id' | 'createdBy' | 'createdAt'>);
                    setScaleToEdit({ ...initialDraftData, id: musicScaleId } as Scale);
                } else {
                    musicScaleId = scaleData.id as string;
                }

                if (!idempotencyKey) {
                    idempotencyKey = crypto.randomUUID();
                }

                const payload = buildMusicScalePublishPayload(scaleData);

                console.log('[MusicScale Publish Path] => ' + JSON.stringify({
                    organizationId: orgId,
                    musicScaleId,
                    musicScalePublishCommandEnabled: isMusicScalePublishCommandEnabled,
                    selectedAction: "publish_command_api"
                }));

                try {
                    const publishResult = await api.musicScaleCommands.publish(
                        musicScaleId,
                        payload,
                        idempotencyKey
                    );

                    console.log('[MusicScale Publish Result] => ' + JSON.stringify({
                        organizationId: orgId,
                        musicScaleId,
                        status: "published",
                        publishRevision: publishResult.version,
                        eventAssignmentCount: publishResult.eventAssignmentCount || publishResult.createdResponseCount || 0,
                        createdResponseCount: publishResult.createdResponseCount || 0,
                        createdNotificationCount: publishResult.createdNotificationCount || 0,
                        recipientCount: publishResult.createdNotificationCount || 0,
                        fromCache: !!publishResult.fromCache,
                        correlationId: publishResult.correlationId || idempotencyKey
                    }));

                    toast({
                        title: t('scaleModal.publishSuccess'),
                        description: t('scaleModal.publishSuccessDescription'),
                    });
                    
                    closeAllModals();
                    await refreshData();
                    return { status: "published", scaleId: musicScaleId, version: publishResult.version };
                } catch (publishErr: unknown) {
                    logger.error("Failed to publish scale via command", publishErr);
                    
                    const errorObj = publishErr as Record<string, unknown> | null;
                    const correlationId = errorObj && typeof errorObj.correlationId === 'string' ? errorObj.correlationId : undefined;
                    
                    const isPublishedPreserved = currentStatus === "published";
                    const errorDescription = isPublishedPreserved 
                        ? t('scaleModal.publishedPreserved') 
                        : t('scaleModal.draftPreserved');

                    toast({
                        title: t('scaleModal.publishFailed'),
                        description: errorDescription,
                        variant: "destructive"
                    });
                    
                    await refreshData();
                    
                    if (isPublishedPreserved) {
                        return { 
                            status: "republish-failed", 
                            scaleId: musicScaleId, 
                            publishedPreserved: true, 
                            correlationId: correlationId 
                        };
                    } else {
                        return { 
                            status: "publish-failed", 
                            scaleId: musicScaleId, 
                            draftPreserved: true, 
                            correlationId: correlationId 
                        };
                    }
                }
            } else {
                if (isUpdate) {
                    musicScaleId = scaleData.id as string;
                    await api.scales.update(musicScaleId, updateData as Scale);
                } else {
                    musicScaleId = await api.scales.create(updateData as Omit<Scale, 'id' | 'createdBy' | 'createdAt'>);
                    setScaleToEdit({ ...updateData, id: musicScaleId } as Scale);
                }

                const bandScaleId = 'bandScaleId' in scaleData ? scaleData.bandScaleId || null : null;
                if (bandScaleId) {
                    await api.linkScales(musicScaleId, bandScaleId);
                }

                toast({
                    title: t('scaleModal.draftSaved'),
                    description: t('scaleModal.draftSavedDescription'),
                });
                
                closeAllModals();
                await refreshData();
                return { status: "draft-saved", scaleId: musicScaleId };
            }
        } else if (scaleType === 'band') {
             const bandReq = req as { data: BandScaleWritableData; idempotencyKey?: string };
             const scaleData = bandReq.data;
             let idempotencyKey = bandReq.idempotencyKey;
             
             let bandScaleId: string;
             const isUpdate = 'id' in scaleData && scaleData.id && scaleData.id !== 'CLONE';
             const oldScale = isUpdate && 'id' in scaleData ? bandScales.find(b => b.id === scaleData.id) : null;
             
             console.info('[BandScale Save Path] => ' + JSON.stringify({
                 organizationId: organization?.id,
                 featureFlagEnabled: isCommandApiV1Enabled,
                 selectedWriter: isCommandApiV1Enabled ? 'command_api' : 'legacy_repository'
             }));

             if (isCommandApiV1Enabled) {
                 if (!idempotencyKey) {
                     idempotencyKey = crypto.randomUUID(); // Fallback if not provided
                 }
                 if (isUpdate && oldScale) {
                     const expectedVersion = oldScale && 'version' in oldScale && typeof oldScale.version === 'number' 
                         ? oldScale.version 
                         : 1;
                     const result = await api.bandScaleCommands.update(scaleData.id as string, expectedVersion, scaleData, idempotencyKey);
                     bandScaleId = result.scaleId || scaleData.id;
                 } else {
                     const result = await api.bandScaleCommands.create(scaleData, idempotencyKey);
                     bandScaleId = result.scaleId;
                 }
             } else {
                 if (isUpdate) {
                    const bandScaleData = scaleData as BandScale;
                    await api.bandScales.update(bandScaleData.id, bandScaleData);
                    bandScaleId = bandScaleData.id;
                } else {
                    bandScaleId = await api.bandScales.create(scaleData as Omit<BandScale, 'id' | 'createdBy' | 'createdAt'>);
                }
             }
             
            const bandScaleData = scaleData as BandScale & { musicScaleId?: string };
            if (bandScaleData.musicScaleId) {
                await api.linkScales(bandScaleData.musicScaleId, bandScaleId);
            }
            if (bandScaleId && linkingOptions?.linkToMusicScaleId) {
                await api.linkScales(linkingOptions.linkToMusicScaleId, bandScaleId);
            }
            
            closeAllModals();
            await refreshData();
        }
    } catch(e: unknown) {
        logger.error("Failed to save scale", e);
        
        
        const errDetails = extractErrorDetails(e);
        let errorMsg = errDetails.message || t('common.unknownError', "Ocorreu um erro desconhecido.");
        if (errDetails.status === 409) {
             errorMsg = t('common.concurrencyError', "Esta escala foi alterada por outra pessoa. Atualize os dados antes de salvar novamente.");
        } else if (errDetails.code === 'permission-denied') {
             errorMsg = t('common.permissionDenied', "Sem permissão. Verifique seu papel na organização.");
        }
        
        let desc = errorMsg;
        if (errDetails.correlationId) {
            desc += ` (${t('common.correlation', 'Correlação')}: ${errDetails.correlationId})`;
        } else if (errDetails.code) {
            desc += ` (${errDetails.code})`;
        }

        
        toast({ type: 'error', message: t('common.errorSaving', "Erro ao salvar"), description: desc });
    } finally {
        setIsSubmitting(false);
        scaleSaveInFlightRef.current = false;
    }
  }, [user, userProfile, scaleType, linkingOptions, refreshData, closeAllModals, api, bandScales, instruments, isCommandApiV1Enabled, isMusicScalePublishCommandEnabled, organization?.id, eventTypes, locations, t, toast]);

  const handleDeleteScale = useCallback(async () => {
      if (!scaleToDelete || !api || !user || !userProfile) {
          logger.error("Cannot delete scale: missing required context");
          return;
      }
      setIsSubmitting(true);
      try {
          if (scaleType === 'music') {
              const linkedBandScaleIds = bandScales
                  .filter(b => b.musicScaleId === scaleToDelete.id)
                  .map(b => b.id);
                  
              await api.scales.deleteMany([scaleToDelete.id]);
              
              if (linkedBandScaleIds.length > 0) {
                  await api.bandScales.deleteMany(linkedBandScaleIds);
              }
          } else if (scaleType === 'band') {
              await api.bandScales.deleteMany([scaleToDelete.id]);
          }
          setScaleToDelete(null);
          setScaleType(null);
          await refreshData();
      } catch(e) {
          logger.error("Failed to delete scale", e);
          const errDetails = extractErrorDetails(e);
          let errorMsg = errDetails.message || t('common.unknownError', "Ocorreu um erro desconhecido.");
          if (errDetails.code === 'permission-denied') errorMsg = t('common.permissionDenied', "Sem permissão. Verifique seu papel na organização.");
          toast({ type: 'error', message: t('common.errorDeleting', "Erro ao excluir"), description: `${t('common.details', 'Detalhes')}: ${errorMsg}` });
      } finally {
          setIsSubmitting(false);
      }
  }, [scaleToDelete, scaleType, user, userProfile, refreshData, api, bandScales]);
  
  // Chord Handlers
  const openAddChordModal = useCallback(() => { closeAllModals(); setAddChordModalOpen(true); }, [closeAllModals]);

  const saveChord = useCallback(async (data: { songId: string, chords: string }) => {
    if (!user || !userProfile || !api) return;
    setIsSubmitting(true);
    try {
      await api.songs.update(data.songId, { chords: data.chords });
      await refreshData();
    } catch (e) {
      logger.error("Failed to save chords", e);
    } finally {
      setIsSubmitting(false);
    }
  }, [user, refreshData, api]);

  // Suggestion Handlers
  const openSuggestionForm = useCallback(() => { closeAllModals(); setSuggestionFormOpen(true); }, [closeAllModals]);

  const handleSaveSuggestion = useCallback(async (songs: {title: string, artist: string, link: string}[]) => {
    if (!user || !userProfile?.organizationId || songs.length === 0) return;
    setIsSubmitting(true);
    try {
        await suggestionApi.addSuggestion(user, userProfile.organizationId, { songs });
        await refreshSuggestions();
        setSuggestionFormOpen(false);
        setSuccessConfig({
            title: 'Indicação Enviada!',
            message: 'Obrigado! Sua indicação de música foi enviada para análise.',
            actionText: 'Ver Indicações',
            onAction: () => {
                closeAllModals();
                navigate('/suggestions');
            },
            stayText: 'Fechar',
            onStay: closeAllModals,
        });

        // Client-side notification is removed.
        // Notifications are produced on the server-side via Cloud Functions (onSuggestionCreated).
    } catch (e) {
        logger.error("Failed to save suggestion", e);
    } finally {
        setIsSubmitting(false);
    }
  }, [user, userProfile, refreshSuggestions, closeAllModals, navigate]);
  
  // Help Handler
  const openHelpModal = useCallback((section: string) => {
      closeAllModals();
      setHelpModalSection(section);
  }, [closeAllModals]);

  const openSupportModal = useCallback(() => {
    closeAllModals();
    setSupportModalOpen(true);
  }, [closeAllModals]);

  const navigateToSongInScale = useCallback((direction: 'next' | 'previous' | number) => {
    if (!scaleNavigationContext) return;

    const { songs, currentIndex } = scaleNavigationContext;
    let newIndex = currentIndex;
    
    if (typeof direction === 'number') {
        newIndex = direction;
    } else {
        newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    }

    if (newIndex >= 0 && newIndex < songs.length) {
        const newSong = songs[newIndex];
        setSongToView(newSong);
        setScaleNavigationContext({ songs, currentIndex: newIndex });
    }
  }, [scaleNavigationContext]);


  const value = useMemo(() => ({
      isAiSongImportOpen,
      openAiSongImport,
      closeAiSongImport,
      isWhatsNewOpen,
      openWhatsNew,
      closeWhatsNew,
      openSongForm,
      openSongDetail,
      openDeleteSongConfirmation,
      openScaleForm,
      openScaleDetail,
      openBandScaleForm,
      openBandScaleDetail,
      openAddChordModal,
      openSuggestionForm,
      openHelpModal,
      openSupportModal,
      saveChord,
      isSubmitting,
      isFeedbackOpen,
      feedbackType,
      openFeedback,
      closeFeedback,
      handleSaveScale
  }), [
      isAiSongImportOpen, openAiSongImport, closeAiSongImport, isWhatsNewOpen, openWhatsNew, closeWhatsNew,
      openSongForm, openSongDetail, openDeleteSongConfirmation, openScaleForm, openScaleDetail,
      openBandScaleForm, openBandScaleDetail, openAddChordModal, openSuggestionForm, openHelpModal,
      openSupportModal, saveChord, isSubmitting, isFeedbackOpen, feedbackType, openFeedback, closeFeedback,
      handleSaveScale
  ]);

  return (
    <ModalContext.Provider value={value}>
      {children}

      <Suspense fallback={null}>
        {isWhatsNewOpen && <WhatsNewModal isOpen={isWhatsNewOpen} onClose={closeWhatsNew} />}

        {isFeedbackOpen && <FeedbackModal isOpen={isFeedbackOpen} onClose={closeFeedback} type={feedbackType} />}

        {scaleToView && (
            <ScaleDetailModal
              scale={scaleToView}
              scaleType={scaleType!}
              onClose={handleCloseScaleDetail}
              onEdit={(s) => {
                  let rawScale: Scale | BandScale | undefined;
                  if (scaleType === 'music') {
                      rawScale = scales.find(raw => raw.id === s.id);
                  } else {
                      rawScale = bandScales.find(raw => raw.id === s.id);
                  }
                  
                  setScaleToView(null);
                  if (rawScale) {
                      if (scaleType === 'music') openScaleForm(rawScale as Scale);
                      else openBandScaleForm(rawScale as BandScale);
                  } else {
                      logger.error("Could not find raw scale to edit for ID:", s.id);
                  }
              }}
              onClone={(s) => {
                  let rawScale: Scale | BandScale | undefined;
                  if (scaleType === 'music') {
                      rawScale = scales.find(raw => raw.id === s.id);
                  } else {
                      rawScale = bandScales.find(raw => raw.id === s.id);
                  }
                  
                  setScaleToView(null);
                  if (rawScale) {
                      if (scaleType === 'music') {
                          const clonedScale: Scale = { ...rawScale, id: 'CLONE', date: '' } as Scale;
                          openScaleForm(clonedScale);
                      } else {
                          const clonedScale: BandScale = { ...rawScale, id: 'CLONE', date: '' } as BandScale;
                          openBandScaleForm(clonedScale);
                      }
                  }
              }}
              onDelete={(s) => { 
                  const currentType = scaleType;
                  handleCloseScaleDetail(); 
                  setScaleToDelete(s); 
                  setScaleType(currentType); 
              }}
              openSongDetail={openSongDetail}
              openBandScaleForm={openBandScaleForm}
            />
        )}

        {songToView && (
          <SongDetailModal
            song={songToView}
            onClose={() => { setSongToView(null); setScaleNavigationContext(null); setStartInPerformanceMode(false); }}
            onEdit={(song) => { setSongToView(null); setScaleNavigationContext(null); setStartInPerformanceMode(false); openSongForm(song); }}
            onDelete={(song) => { setSongToView(null); setScaleNavigationContext(null); setStartInPerformanceMode(false); openDeleteSongConfirmation(song); }}
            onCreateScale={(song) => { setSongToView(null); setScaleNavigationContext(null); setStartInPerformanceMode(false); navigate('/scales', { state: { preselectedSongIds: [song.id] } }); }}
            scaleContext={scaleNavigationContext}
            onNavigate={navigateToSongInScale}
            startInPerformanceMode={startInPerformanceMode}
          />
        )}

        {isAiSongImportOpen && (
          <AiSongImportModal
            isOpen={isAiSongImportOpen}
            onClose={() => setIsAiSongImportOpen(false)}
          />
        )}

        {songToEdit && (
          <Modal
            isOpen={!!songToEdit}
            onClose={() => setSongToEdit(null)}
            title={songToEdit.id ? t("modals.edit_song_title", 'Editar Música') : t("modals.new_song_title", 'Nova Música')}
            maxWidth="max-w-4xl"
          >
            <SongForm
              songToEdit={songToEdit.id ? songToEdit : null}
              onSave={handleSaveSong}
              onClose={() => setSongToEdit(null)}
              isSubmitting={isSubmitting}
              tags={tags}
            />
          </Modal>
        )}
        
        <ConfirmationModal
          isOpen={!!songToDelete}
          onClose={() => setSongToDelete(null)}
          onConfirm={handleDeleteSong}
          title={t("modals.delete_song_title", `Excluir "${songToDelete?.title}"?`)}
          message={t("modals.delete_song_message", "Tem certeza que deseja excluir esta música? Esta ação não pode ser desfeita.")}
          isLoading={isSubmitting}
        />

        {duplicateSongInfo && (
          <DuplicateSongModal
            isOpen={!!duplicateSongInfo}
            onClose={() => setDuplicateSongInfo(null)}
            candidateSong={duplicateSongInfo?.newSongData}
            matches={duplicateSongInfo?.matches || []}
            onSaveAnyway={handleConfirmDuplicateSave}
            onEditExisting={(song) => {
              setDuplicateSongInfo(null);
              openSongForm(song);
            }}
            isLoading={isSubmitting}
          />
        )}
        
        {(scaleToEdit || (scaleType && !scaleToView && !scaleToDelete)) && (
          <ModernScaleForm
            isOpen={!!scaleToEdit || !!scaleType}
            scaleType={scaleType!}
            scaleToEdit={scaleToEdit}
            preselectedSongIds={preselectedSongIds}
            onSave={handleSaveScale}
            onClose={() => { setScaleToEdit(null); setScaleType(null); }}
            isSubmitting={isSubmitting}
          />
        )}
        
        <ConfirmationModal
          isOpen={!!scaleToDelete}
          onClose={() => { setScaleToDelete(null); setScaleType(null); }}
          onConfirm={handleDeleteScale}
          title={t("modals.delete_scale_title", "Excluir Escala?")}
          message={t("modals.delete_scale_message", "Tem certeza que deseja excluir esta escala? Esta ação não pode ser desfeita.")}
          isLoading={isSubmitting}
        />

        {isAddChordModalOpen && (
          <AddChordModal
            isOpen={isAddChordModalOpen}
            onClose={() => setAddChordModalOpen(false)}
            onSave={async (data) => {
                const savePromise = saveChord(data);
                setAddChordModalOpen(false);
                await savePromise;
            }}
            songs={songs}
            isSubmitting={isSubmitting}
          />
        )}

        {isSuggestionFormOpen && (
          <SuggestionFormModal
            isOpen={isSuggestionFormOpen}
            onClose={() => setSuggestionFormOpen(false)}
            onSave={handleSaveSuggestion}
            isSubmitting={isSubmitting}
          />
        )}

        {helpModalSection && (
          <HelpModal 
            isOpen={!!helpModalSection}
            initialSection={helpModalSection}
            onClose={() => setHelpModalSection(null)}
          />
        )}

        {isSupportModalOpen && (
          <SupportModal
            isOpen={isSupportModalOpen}
            onClose={() => setSupportModalOpen(false)}
            userEmail={user?.email}
          />
        )}

        {successConfig && (
          <SuccessModal 
            isOpen={!!successConfig}
            onClose={() => setSuccessConfig(null)}
            {...successConfig}
          />
        )}
      </Suspense>
    </ModalContext.Provider>
  );
};

export const useModals = (): ModalContextType => {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModals must be used within a ModalProvider');
  }
  return context;
};
