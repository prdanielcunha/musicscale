import { 
    collection, 
    doc, 
    query, 
    where, 
    Query, 
    DocumentReference, 
    CollectionReference, 
    orderBy, 
    limit, 
    DocumentData,
    QueryConstraint,
    onSnapshot,
    getDocs
} from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Type-safe interface for any document that belongs to an organization.
 */
export interface TenantDocument {
    organizationId: string;
    id: string;
}

/**
 * Creates a base query scoped to an organization.
 * This is the core of the centralized query strategy.
 */
export const createScopedQuery = (
    collectionName: string, 
    orgId: string, 
    ...constraints: QueryConstraint[]
): Query<DocumentData> => {
    if (!orgId) {
        throw new Error(`[FirestoreHardening] Critical: Attempted to query ${collectionName} without organizationId context.`);
    }
    
    // All collections are root-level in MillionsNest, secured by organizationId
    const colRef = collection(db, collectionName);
    return query(colRef, where('organizationId', '==', orgId), ...constraints);
};

export const createOrgQuery = createScopedQuery;

/**
 * Realtime listener wrapper with automatic organization scoping.
 */
export const subscribeToOrgCollection = <T>(
    collectionName: string,
    orgId: string,
    onUpdate: (data: T[]) => void,
    onError: (error: any) => void,
    ...constraints: QueryConstraint[]
) => {
    const q = createScopedQuery(collectionName, orgId, ...constraints);
    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as T));
        onUpdate(data);
    }, onError);
};

/**
 * One-time fetch wrapper with automatic organization scoping.
 */
export const fetchOrgCollection = async <T>(
    collectionName: string,
    orgId: string,
    ...constraints: QueryConstraint[]
): Promise<T[]> => {
    const q = createScopedQuery(collectionName, orgId, ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as T));
};

export const getDocRef = (collectionName: string, docId: string): DocumentReference<DocumentData> => {
    return doc(db, collectionName, docId);
};
