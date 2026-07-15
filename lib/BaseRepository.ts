import { 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    getDoc,
    serverTimestamp, 
    writeBatch,
    QueryConstraint,
    DocumentData,
    where
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { createScopedQuery, fetchOrgCollection, subscribeToOrgCollection } from './firestore-utils';
import type { UserProfile, CreatedBy } from '../types';

export function removeUndefinedValues<T>(obj: T): T {
    if (obj === undefined || obj === null) return obj;
    if (typeof obj !== 'object') return obj;
    
    // Preserve arrays
    if (Array.isArray(obj)) {
        return obj.map(item => removeUndefinedValues(item)) as any;
    }

    // Preserve Firestore custom objects (Timestamp, GeoPoint, FieldValue, DocumentReference, etc.) and Date
    if (obj.constructor.name !== 'Object') {
        return obj;
    }

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
            result[key] = removeUndefinedValues(value);
        }
    }
    return result;
}

export class BaseRepository<T extends object> {
    constructor(
        protected collectionName: string,
        protected orgId: string,
        protected userProfile?: UserProfile | null
    ) {}

    protected get collectionRef() {
        return collection(db, this.collectionName);
    }

    protected docRef(id: string) {
        return doc(db, this.collectionName, id);
    }

    protected get auditable() {
        if (!this.userProfile) return {};
        return {
            uid: this.userProfile.uid,
            displayName: this.userProfile.displayName,
            photoURL: this.userProfile.photoURL
        };
    }

    async list(...constraints: QueryConstraint[]): Promise<T[]> {
        return fetchOrgCollection<T>(this.collectionName, this.orgId, ...constraints);
    }

    subscribe(onUpdate: (data: T[]) => void, onError: (error: any) => void, ...constraints: QueryConstraint[]) {
        return subscribeToOrgCollection<T>(this.collectionName, this.orgId, onUpdate, onError, ...constraints);
    }

    async getById(id: string): Promise<T | null> {
        const docSnap = await getDoc(this.docRef(id));
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.organizationId === this.orgId) {
                return { id: docSnap.id, ...data } as T;
            }
        }
        return null;
    }

    protected writeAuditLog(batch: any, action: string, targetId: string, details?: any) {
        if (!this.orgId || this.collectionName === 'users') return;
        const auditRef = doc(collection(db, 'audits'));
        batch.set(auditRef, {
            action,
            targetCollection: this.collectionName,
            targetId,
            details: details || {},
            user: this.auditable,
            organizationId: this.orgId,
            timestamp: serverTimestamp()
        });
    }

    async create(data: Omit<T, 'id' | 'createdAt' | 'createdBy' | 'organizationId'>): Promise<string> {
        if (!this.orgId) throw new Error("Organization context missing");
        
        const docData = removeUndefinedValues({
            ...data,
            organizationId: this.orgId,
            createdBy: this.auditable,
            createdAt: serverTimestamp(),
        });

        const batch = writeBatch(db);
        const newRef = doc(this.collectionRef);
        batch.set(newRef, docData);
        this.writeAuditLog(batch, 'CREATE', newRef.id);
        await batch.commit();

        return newRef.id;
    }

    async update(id: string, data: Partial<T>): Promise<void> {
        const docRef = this.docRef(id);
        const batch = writeBatch(db);
        const docData = removeUndefinedValues({
            ...data,
            lastModifiedBy: this.auditable,
            lastModifiedAt: serverTimestamp(),
        });
        batch.update(docRef, docData);
        this.writeAuditLog(batch, 'UPDATE', id, docData);
        await batch.commit();
    }

    async delete(id: string): Promise<void> {
        const batch = writeBatch(db);
        batch.delete(this.docRef(id));
        this.writeAuditLog(batch, 'DELETE', id);
        await batch.commit();
    }

    async updateMany(ids: string[], data: Partial<T>): Promise<void> {
        const batch = writeBatch(db);
        const docData = removeUndefinedValues({
            ...data,
            lastModifiedBy: this.auditable,
            lastModifiedAt: serverTimestamp(),
        });
        ids.forEach(id => {
            batch.update(this.docRef(id), docData);
            this.writeAuditLog(batch, 'UPDATE', id, docData);
        });
        await batch.commit();
    }

    async deleteMany(ids: string[]): Promise<void> {
        const batch = writeBatch(db);
        ids.forEach(id => {
            batch.delete(this.docRef(id));
            this.writeAuditLog(batch, 'DELETE', id);
        });
        await batch.commit();
    }
}
