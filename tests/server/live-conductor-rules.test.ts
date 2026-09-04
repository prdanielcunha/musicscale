import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { resolve } from "path";
import { beforeAll, beforeEach, afterAll, describe, it } from "vitest";
import { doc, setDoc, updateDoc } from "firebase/firestore";

let env: RulesTestEnvironment | null = null;
const hasEmulatorHost = !!process.env.FIRESTORE_EMULATOR_HOST;

beforeAll(async () => {
  if (!hasEmulatorHost) return;
  env = await initializeTestEnvironment({
    projectId: "demo-musicscale-live-conductor-rules",
    firestore: {
      rules: readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8"),
    },
  });
}, 30_000);

beforeEach(async () => {
  if (!env) return;
  await env.clearFirestore();
});

afterAll(async () => {
  if (env) await env.cleanup();
});

async function seedMember(
  uid: string,
  permissions: Record<string, boolean> = {},
) {
  await env!.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "organizations/org-1"), {
      status: "active",
      name: "Org 1",
    });
    await setDoc(doc(db, `organizations/org-1/members/${uid}`), {
      uid,
      organizationId: "org-1",
      status: "active",
      role: "member",
      organizationRole: "member",
      permissions,
    });
  });
}

describe.skipIf(!hasEmulatorHost)("Live Worship conductor Firestore rules", () => {
  it("allows an explicitly enabled conductor to create a live session", async () => {
    await seedMember("conductor-1", {
      "musicscale.live.conduct": true,
    });
    const db = env!.authenticatedContext("conductor-1").firestore();

    await assertSucceeds(
      setDoc(doc(db, "liveSessions/session-1"), {
        id: "session-1",
        scaleId: "scale-1",
        organizationId: "org-1",
        activeSongId: null,
        leaderId: "conductor-1",
      }),
    );
  });

  it("denies an ordinary member without scale-management or conductor permission", async () => {
    await seedMember("member-1");
    const db = env!.authenticatedContext("member-1").firestore();

    await assertFails(
      setDoc(doc(db, "liveSessions/session-2"), {
        id: "session-2",
        scaleId: "scale-1",
        organizationId: "org-1",
        activeSongId: null,
        leaderId: "member-1",
      }),
    );
  });

  it("preserves canonical leader role authority without an explicit permission", async () => {
    await env!.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "organizations/org-1"), {
        status: "active",
        name: "Org 1",
      });
      await setDoc(doc(db, "organizations/org-1/members/leader-1"), {
        uid: "leader-1",
        organizationId: "org-1",
        status: "active",
        role: "leader",
        organizationRole: "leader",
        permissions: {},
      });
    });

    const db = env!.authenticatedContext("leader-1").firestore();
    await assertSucceeds(
      setDoc(doc(db, "liveSessions/session-leader"), {
        id: "session-leader",
        scaleId: "scale-1",
        organizationId: "org-1",
        activeSongId: null,
        leaderId: "leader-1",
      }),
    );
  });

  it("preserves the existing canManageScales path", async () => {
    await seedMember("manager-1", {
      canManageScales: true,
    });
    const db = env!.authenticatedContext("manager-1").firestore();

    await assertSucceeds(
      setDoc(doc(db, "liveSessions/session-3"), {
        id: "session-3",
        scaleId: "scale-1",
        organizationId: "org-1",
        activeSongId: null,
        leaderId: "manager-1",
      }),
    );
  });

  it("allows an explicit conductor to update live direction", async () => {
    await seedMember("conductor-2", {
      "musicscale.live.conduct": true,
    });
    await env!.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "liveSessions/session-4"), {
        id: "session-4",
        scaleId: "scale-1",
        organizationId: "org-1",
        activeSongId: null,
        leaderId: "host-1",
      });
    });

    const db = env!.authenticatedContext("conductor-2").firestore();
    await assertSucceeds(
      updateDoc(doc(db, "liveSessions/session-4"), {
        activeSongId: "song-2",
      }),
    );
  });

  it("does not allow a conductor to move the live session to another tenant", async () => {
    await seedMember("conductor-3", {
      "musicscale.live.conduct": true,
    });
    await env!.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "liveSessions/session-5"), {
        id: "session-5",
        scaleId: "scale-1",
        organizationId: "org-1",
        activeSongId: null,
        leaderId: "host-1",
      });
      await setDoc(doc(context.firestore(), "organizations/org-2"), {
        status: "active",
      });
    });

    const db = env!.authenticatedContext("conductor-3").firestore();
    await assertFails(
      updateDoc(doc(db, "liveSessions/session-5"), {
        organizationId: "org-2",
      }),
    );
  });
});
