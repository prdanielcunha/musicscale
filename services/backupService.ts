import { logger } from "../lib/logger";

import {
  collection,
  getDocs,
  writeBatch,
  doc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { getUserProfileData } from "./firestoreService";
import { auth } from "./firebase";
import { createOrgQuery } from "../lib/firestore-utils";

export interface BackupData {
  metadata: {
    version: string;
    exportDate: string;
    appVersion: string;
    totalCollections: number;
    organizationId?: string | null; // Allow null for global backups
    isGlobal?: boolean;
  };
  collections: {
    [key: string]: any[];
  };
}

const downloadJSON = (data: object, filename: string) => {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export interface ExportOptions {
  collectionsToBackup: string[];
  isGlobal: boolean;
}

export const createFullBackup = async (
  options: ExportOptions,
): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Usuário não autenticado.");

  const profile = await getUserProfileData(currentUser.uid);
  if (!profile?.organizationId)
    throw new Error("Usuário sem organização vinculada.");

  const orgId = profile.organizationId;

  try {
    const backupData: any = {
      metadata: {
        version: "1.2",
        exportDate: new Date().toISOString(),
        appVersion: "1.0",
        totalCollections: options.collectionsToBackup.length,
        organizationId: options.isGlobal ? null : orgId,
        isGlobal: options.isGlobal,
      },
      collections: {},
    };

    if (
      options.collectionsToBackup.some(
        (c) => c === "songs" || c === "lyrics" || c === "chords",
      )
    ) {
      let q = createOrgQuery("songs", orgId);
      const snap = await getDocs(q);
      const songsDocs = snap.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      }));

      if (options.collectionsToBackup.includes("songs")) {
        backupData.collections["songs"] = songsDocs.map((docData: any) => {
          const { lyrics, chords, chordsUrl, organizationId, ...rest } =
            docData;
          if (!options.isGlobal) rest.organizationId = organizationId;
          return rest;
        });
      }
      if (options.collectionsToBackup.includes("lyrics")) {
        backupData.collections["lyrics"] = songsDocs
          .map((doc: any) => ({
            id: doc.id,
            title: doc.title || "",
            artist: doc.artist || "",
            lyrics: doc.lyrics || "",
          }))
          .filter((doc) => doc.lyrics);
      }
      if (options.collectionsToBackup.includes("chords")) {
        backupData.collections["chords"] = songsDocs
          .map((doc: any) => ({
            id: doc.id,
            title: doc.title || "",
            artist: doc.artist || "",
            chords: doc.chords || "",
            chordsUrl: doc.chordsUrl || "",
          }))
          .filter((doc) => doc.chords || doc.chordsUrl);
      }
    }

    const otherCollections = options.collectionsToBackup.filter(
      (c) => c !== "songs" && c !== "lyrics" && c !== "chords",
    );

    for (const colName of otherCollections) {
      // Only filter by orgId if we're not a sysadmin or something,
      // but we only support org-based data here. So we only export current org's data.
      // Even if it's a global export, we only export the CURRENT org's data but WITHOUT the orgId in the file.
      let q = createOrgQuery(colName, orgId);

      const snap = await getDocs(q);
      backupData.collections[colName] = snap.docs.map((document) => {
        const docData = { id: document.id, ...document.data() };
        if (options.isGlobal) {
          delete (docData as any).organizationId; // Remove bind
        }
        return docData;
      });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const prefix = options.isGlobal ? "global" : orgId;
    downloadJSON(backupData, `music-scale-backup-${prefix}-${timestamp}.json`);
  } catch (error) {
    logger.error("Error creating backup:", error);
    throw new Error(
      "Falha ao gerar o arquivo de backup. Verifique sua conexão e permissões.",
    );
  }
};

export const parseBackupFile = async (file: File): Promise<BackupData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonStr = e.target?.result as string;
        const data: BackupData = JSON.parse(jsonStr);

        if (!data.metadata || !data.collections) {
          throw new Error(
            "Arquivo inválido. Estrutura de backup não reconhecida.",
          );
        }
        resolve(data);
      } catch (err) {
        reject(new Error("Erro ao ler o arquivo como JSON."));
      }
    };
    reader.onerror = () => reject(new Error("Erro ao ler o arquivo."));
    reader.readAsText(file);
  });
};

export interface RestoreOptions {
  backupData: BackupData;
  collectionsToRestore: string[];
  bindToCurrentOrganization: boolean;
  importToLocalOrganization?: boolean;
  saveToGlobalLibrary?: boolean;
  globalSongStatus?: "active" | "draft";
  onProgress: (msg: string, progress: number) => void;
  songResolutions?: Record<string, string>;
}

export interface SongImportAnalysis {
  exactMatches: {
    backupId: string;
    matchedDbId: string;
    title: string;
    artist: string;
  }[];
  unmatched: { backupId: string; title: string; artist: string }[];
  existingSongs: { id: string; title: string; artist: string }[];
}

export const analyzeSongsForImport = async (
  backupData: BackupData,
  collectionsToRestore: string[],
): Promise<SongImportAnalysis> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Usuário não autenticado.");
  const profile = await getUserProfileData(currentUser.uid);
  if (!profile?.organizationId) throw new Error("Sem organização vinculada.");
  const currentOrgId = profile.organizationId;

  const existingSongsSnap = await getDocs(
    createOrgQuery("songs", currentOrgId),
  );
  const existingSongs = existingSongsSnap.docs.map((document) => {
    const d = document.data();
    return { id: document.id, title: d.title || "", artist: d.artist || "" };
  });

  const normalizeString = (str: string | undefined | null) => {
    return str
      ? str
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim()
      : "";
  };

  const existingSongsMap = new Map<string, string>();
  existingSongs.forEach((song) => {
    const key = `${normalizeString(song.title)}|${normalizeString(song.artist)}`;
    if (key !== "|") existingSongsMap.set(key, song.id);
  });

  const exactMatches: any[] = [];
  const unmatched: any[] = [];
  const musicItemsMap = new Map<
    string,
    { backupId: string; title: string; artist: string }
  >();

  for (const colName of ["songs", "lyrics", "chords"]) {
    if (!collectionsToRestore.includes(colName)) continue;
    const items = backupData.collections[colName];
    if (!Array.isArray(items)) continue;
    items.forEach((item) => {
      if (!musicItemsMap.has(item.id)) {
        musicItemsMap.set(item.id, {
          backupId: item.id,
          title: item.title || "",
          artist: item.artist || "",
        });
      }
    });
  }

  musicItemsMap.forEach((item) => {
    const key = `${normalizeString(item.title)}|${normalizeString(item.artist)}`;
    if (existingSongsMap.has(key)) {
      exactMatches.push({
        backupId: item.backupId,
        matchedDbId: existingSongsMap.get(key)!,
        title: item.title,
        artist: item.artist,
      });
    } else {
      unmatched.push(item);
    }
  });

  return { exactMatches, unmatched, existingSongs };
};

export const restoreBackup = async (options: RestoreOptions): Promise<void> => {
  const {
    backupData,
    collectionsToRestore,
    bindToCurrentOrganization,
    onProgress,
  } = options;
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Usuário não autenticado.");

  const profile = await getUserProfileData(currentUser.uid);
  if (!profile?.organizationId)
    throw new Error("Usuário sem organização vinculada.");

  const currentOrgId = profile.organizationId;

  const data = backupData;

  const totalCollections = collectionsToRestore.length;
  let processedCount = 0;

  const songResolutions = options.songResolutions || {};
  const importToLocal = options.importToLocalOrganization !== false;

  if (importToLocal) {
    for (const colName of collectionsToRestore) {
      const items = data.collections[colName];

      if (!Array.isArray(items)) continue;

      onProgress(
        `Restaurando ${colName}... (${items.length} itens)`,
        10 + (processedCount / totalCollections) * 80,
      );

      const chunkSize = 100; // Reduced from 450 to avoid Firebase target mapping assertion crash
      for (let i = 0; i < items.length; i += chunkSize) {
        const batch = writeBatch(db);

        const chunk = items.slice(i, i + chunkSize);
        chunk.forEach((item: any) => {
          let { id, ...docData } = item;

          // If id is missing, skip to avoid invalid ref errors
          if (!id) return;

          // Smart Matching for songs
          if (
            colName === "songs" ||
            colName === "lyrics" ||
            colName === "chords"
          ) {
            if (songResolutions[id]) {
              if (songResolutions[id] !== "CREATE_NEW") {
                id = songResolutions[id];
              }
            }
          }

          if (colName === "lyrics") {
            const updateData: any = {
              lyrics: docData.lyrics,
              title: docData.title,
              artist: docData.artist,
            };
            if (bindToCurrentOrganization)
              updateData.organizationId = currentOrgId;
            const docRef = doc(db, "songs", id);
            batch.set(docRef, updateData, { merge: true });
            return;
          }

          if (colName === "chords") {
            const updateData: any = {
              chords: docData.chords,
              chordsUrl: docData.chordsUrl,
              title: docData.title,
              artist: docData.artist,
            };
            if (bindToCurrentOrganization)
              updateData.organizationId = currentOrgId;
            const docRef = doc(db, "songs", id);
            batch.set(docRef, updateData, { merge: true });
            return;
          }

          const orgSpecificCollections = [
            "songs",
            "roles",
            "scales",
            "bandScales",
            "fixedBandScales",
            "suggestions",
            "eventTypes",
            "locations",
            "eventNames",
            "tags",
            "instruments",
          ];

          if (
            bindToCurrentOrganization &&
            orgSpecificCollections.includes(colName)
          ) {
            docData.organizationId = currentOrgId;
          }

          const docRef = doc(db, colName, id);
          batch.set(docRef, docData, { merge: true });
        });

        await batch.commit();
        // Small delay to allow Firebase Web SDK target listeners to process the cache update, preventing "ID: ca9" crashes
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      processedCount++;
    }
  }

  const isEcosystemAdmin =
    profile?.systemRole === "admin" ||
    profile?.systemRole === "ceo" ||
    profile?.systemRole === "global_admin" ||
    currentUser.email === "pastordanielpcunha@gmail.com" ||
    currentUser.email === "danielcunhapastor@gmail.com";
  if (options.saveToGlobalLibrary && isEcosystemAdmin) {
    onProgress("Compartilhando com a Biblioteca Viva...", 95);

    let allBackupSongIds = new Set<string>();
    ["songs", "lyrics", "chords"].forEach((col) => {
      if (
        collectionsToRestore.includes(col) &&
        Array.isArray(backupData.collections[col])
      ) {
        backupData.collections[col].forEach((item: any) => {
          if (item.id) allBackupSongIds.add(item.id);
        });
      }
    });

    const songsCol = backupData.collections["songs"] || [];
    const lyricsCol = backupData.collections["lyrics"] || [];
    const chordsCol = backupData.collections["chords"] || [];

    const globalSongsToMake = Array.from(allBackupSongIds).map((id) => {
      const songBase = songsCol.find((s: any) => s.id === id) || {};
      const lyricObj = lyricsCol.find((s: any) => s.id === id) || {};
      const chordObj = chordsCol.find((s: any) => s.id === id) || {};

      const title =
        songBase.title || lyricObj.title || chordObj.title || "Unknown";
      const artist =
        songBase.artist || lyricObj.artist || chordObj.artist || "Unknown";
      const normalizedTitle = title
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      const normalizedArtist = artist
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      return {
        title,
        normalizedTitle,
        artist,
        normalizedArtist,
        key: songBase.key || "",
        bpm: Number(songBase.bpm) || 0,
        lyrics: lyricObj.lyrics || "",
        chords: chordObj.chords || "",
        chordsUrl: chordObj.chordsUrl || songBase.chordsUrl || "",
        videoUrl: songBase.videoUrl || "",
        language: songBase.language || "unknown",
        status: options.globalSongStatus || "draft",
        importCount: 0,
        createdBy: {
          uid: currentUser.uid,
          displayName: currentUser.displayName || "Admin",
          email: currentUser.email || "",
        },
        createdAt: serverTimestamp(),
        source: "backup_import",
        sourceOrganizationId: currentOrgId,
        sourceSongId: id,
        lastModifiedBy: currentUser.uid,
        lastModifiedAt: serverTimestamp(),
      };
    });

    // We could theoretically check duplicates per chunk, but for huge batches it's complex.
    // Doing a simple batch write for now (Firestore limits deduplication queries inside large batches).
    // Since backups could contain 1000 songs, we simply insert them.
    // In a real system we'd query existing `normalizedTitle+normalizedArtist` globally first.

    // Fetch existing global songs to avoid dupes purely in memory
    const existingGlobalSongs = new Map<string, string>();
    try {
      // If the library is huge, this is inefficient, but for this level it works.
      const existingSnap = await getDocs(collection(db, "globalSongs"));
      existingSnap.forEach((doc) => {
        const data = doc.data();
        existingGlobalSongs.set(
          `${data.normalizedTitle}|${data.normalizedArtist}`,
          doc.id,
        );
      });
    } catch (e) {
      logger.warn("Could not fetch global songs for dupe check.");
    }

    const songsToCreate: any[] = [];
    const songsToUpdate: { id: string; data: any }[] = [];
    const processedKeys = new Set<string>();

    globalSongsToMake.forEach((s) => {
      const key = `${s.normalizedTitle}|${s.normalizedArtist}`;
      if (processedKeys.has(key)) return; // Prevent dupes within the import bulk itself
      processedKeys.add(key);

      if (existingGlobalSongs.has(key)) {
        songsToUpdate.push({
          id: existingGlobalSongs.get(key)!,
          data: s,
        });
      } else {
        songsToCreate.push(s);
      }
    });

    // Use a single loop to batch both creates and updates
    const allOperations = [
      ...songsToCreate.map((data) => ({ type: "create", data })),
      ...songsToUpdate.map((item) => ({
        type: "update",
        data: item.data,
        id: item.id,
      })),
    ] as { type: "create" | "update"; data: any; id?: string }[];

    const chunkSize = 100; // writeBatch limit is 500, using smaller chunks for safety
    for (let i = 0; i < allOperations.length; i += chunkSize) {
      const batch = writeBatch(db);
      const chunk = allOperations.slice(i, i + chunkSize);
      chunk.forEach((op) => {
        let docRef;
        let isCreation = false;

        if (op.type === "create") {
          docRef = doc(collection(db, "globalSongs"));
          batch.set(docRef, op.data);
          isCreation = true;
        } else {
          docRef = doc(db, "globalSongs", op.id as string);
          batch.set(docRef, op.data, { merge: true });
        }

        if (isCreation) {
          const auditRef = doc(collection(db, "audit_logs"));
          batch.set(auditRef, {
            action: "global_song_created",
            userId: currentUser.uid,
            userEmail: currentUser.email,
            systemRole: profile?.systemRole,
            sourceOrganizationId: currentOrgId,
            source: "backup_import",
            songTitle: op.data.title,
            globalSongId: docRef.id,
            timestamp: serverTimestamp(),
          });
        }
      });
      await batch.commit();
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  onProgress("Finalizando...", 100);
};
