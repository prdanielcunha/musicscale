import { admin } from '../firebaseAdmin.js';

export function sanitizeFirestoreData(obj: any): any {
  if (obj === undefined) return undefined;
  if (obj === null) return null;
  if (typeof obj !== 'object') return obj;

  // Preserve specifically allowed Firestore objects
  if (obj instanceof Date) return obj;
  
  // Use admin object for Firestore types
  if (obj instanceof admin.firestore.Timestamp) return obj;
  if (obj instanceof admin.firestore.FieldValue) return obj;
  if (obj instanceof admin.firestore.DocumentReference) return obj;
  if (obj instanceof admin.firestore.GeoPoint) return obj;

  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => sanitizeFirestoreData(item));
  }

  const result: any = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value !== undefined) {
      result[key] = sanitizeFirestoreData(value);
    }
  }
  return result;
}

export function findUndefinedPaths(obj: any, currentPath = ''): string[] {
  let paths: string[] = [];

  if (obj === undefined) {
    paths.push(currentPath);
    return paths;
  }

  if (obj === null || typeof obj !== 'object') {
    return paths;
  }

  if (obj instanceof Date || obj instanceof admin.firestore.Timestamp || obj instanceof admin.firestore.FieldValue || obj instanceof admin.firestore.DocumentReference || obj instanceof admin.firestore.GeoPoint) {
    return paths;
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const nestedPaths = findUndefinedPaths(obj[i], `${currentPath}[${i}]`);
      paths.push(...nestedPaths);
    }
  } else {
    for (const key of Object.keys(obj)) {
      const newPath = currentPath ? `${currentPath}.${key}` : key;
      const nestedPaths = findUndefinedPaths(obj[key], newPath);
      paths.push(...nestedPaths);
    }
  }

  return paths;
}
