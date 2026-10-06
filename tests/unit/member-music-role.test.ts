import { describe, it, expect } from 'vitest';
import { resolveMemberMusicRoleId } from '../../utils/memberMusicRole';
const roles = [{id:'r-vocal',name:'Vocal'},{id:'r-guitar',name:'Guitarrista'},{id:'r-musician',name:'Músico / Vocal'}];
describe('musical role continuity',()=>{
 it('preserves the exact assignment ahead of a generic legacy label',()=>{
   expect(resolveMemberMusicRoleId({roleId:'r-vocal',musicscaleRole:'musician'},roles)).toBe('r-vocal');
 });
 it('resolves historical role keys without inventing a new role',()=>{
   expect(resolveMemberMusicRoleId({roleId:'role_dummy_musician'},roles)).toBe('r-musician');
 });
 it('supports custom names and array-valued ministry functions',()=>{
   expect(resolveMemberMusicRoleId({ministryFunction:['Guitarrista']},roles)).toBe('r-guitar');
 });
 it('does not convert access role into a music assignment or default to visitor',()=>{
   expect(resolveMemberMusicRoleId({organizationRole:'admin'} as any,roles)).toBe('');
   expect(resolveMemberMusicRoleId({roleId:'unknown'},roles)).toBe('unknown');
 });
 it('does not guess between duplicate role names',()=>{
   expect(resolveMemberMusicRoleId({musicscaleRole:'Guitarrista'},[...roles,{id:'other',name:'Guitarrista'}])).toBe('');
 });
});
