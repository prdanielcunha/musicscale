const p = new Proxy({}, {
    get: (target, prop) => {
        if (prop === 'then' || prop === 'constructor' || typeof prop !== 'string') return undefined;
        return true;
    }
});

const hasCap = (cap) => !!p[cap];

console.log('manageOrganization:', hasCap('manageOrganization'));
console.log('musicscale.songs.edit:', hasCap('musicscale.songs.edit'));
console.log('Object.keys:', Object.keys(p));
