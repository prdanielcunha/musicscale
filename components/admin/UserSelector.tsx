import React, { useState, useEffect } from "react";
import { collection, query, limit, getDocs, orderBy, startAt, endAt, where } from "firebase/firestore";
import { db } from "../../services/firebase";

interface UserSelectorProps {
  onSelect: (user: any) => void;
  onCancel: () => void;
}

export const UserSelector: React.FC<UserSelectorProps> = ({ onSelect, onCancel }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // We could just fetch the latest N users or do a simple search
  // Since we might not have perfect text search in Firestore without Algolia,
  // we can just fetch all users if it's a small dataset, or fetch by email prefix.
  // We'll fetch a batch of users and filter client-side for simplicity, or do a basic query.

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // For a global admin tool in a small/medium DB, fetching a reasonable number of users is okay.
      // If we expect many users, we should use a more targeted query.
      const q = query(collection(db, "users"), limit(100)); // Fetch up to 100 for pure client-side filter
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return fetchUsers();

    setLoading(true);
    try {
      // Fetch users based on EXACT matches or simple prefixes usually,
      // But we will fetch by email exactly, or just filter our loaded users.
      // To be safer and more robust, we'll fetch all and filter client side for names/emails.
      // If the BD grows, we'd need a cloud function or standard search.
      const q = query(collection(db, "users"));
      const snap = await getDocs(q);
      const allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const term = searchTerm.toLowerCase();
      const filtered = allUsers.filter((u: any) => 
        (u.email || "").toLowerCase().includes(term) ||
        (u.displayName || "").toLowerCase().includes(term) ||
        u.id.toLowerCase().includes(term)
      );

      setUsers(filtered.slice(0, 50)); // cap at 50 results
    } catch (e) {
      console.error("Search failed", e);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users;

  return (
    <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-lg mt-2 relative z-50 max-h-[400px] flex flex-col">
       <div className="flex justify-between items-center mb-3">
          <h4 className="text-white font-bold text-sm">Selecionar dono da organização</h4>
          <button onClick={onCancel} className="text-slate-400 hover:text-white text-xs">Cancelar</button>
       </div>

       <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <input 
            type="text" 
            placeholder="Buscar por nome, email ou uid..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-1 bg-slate-800 border border-slate-700 text-white rounded px-3 py-1.5 text-sm"
          />
          <button type="submit" className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded text-sm font-bold">Buscar</button>
       </form>

       <div className="flex-1 overflow-y-auto space-y-2">
          {loading ? (
             <p className="text-xs text-slate-400 text-center py-4 animate-pulse">Buscando usuários...</p>
          ) : filteredUsers.length === 0 ? (
             <p className="text-xs text-slate-400 text-center py-4">Nenhum usuário encontrado.</p>
          ) : (
             filteredUsers.map(u => (
                <div key={u.id} className="bg-slate-800 hover:bg-slate-700 p-3 rounded-lg border border-slate-700 transition flex justify-between items-center cursor-pointer group">
                   <div className="flex items-center gap-3">
                       {u.photoURL ? (
                           <img src={u.photoURL} alt={u.displayName || "?"} className="w-8 h-8 rounded-full" />
                       ) : (
                           <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold text-white">
                               {String(u.displayName || u.email || "?").charAt(0).toUpperCase()}
                           </div>
                       )}
                       <div>
                           <p className="text-sm font-bold text-white">{u.displayName || "Sem nome"}</p>
                           <p className="text-xs text-slate-400">{u.email}</p>
                           <p className="text-[10px] text-slate-500 font-mono mt-0.5">UID: {u.id}</p>
                       </div>
                   </div>
                   <button 
                       onClick={() => onSelect(u)}
                       className="bg-amber-600 hover:bg-amber-500 text-white text-xs px-3 py-1.5 rounded font-bold shrink-0 ml-2"
                    >
                       Selecionar
                   </button>
                </div>
             ))
          )}
       </div>
    </div>
  );
};
