import { evaluateFirstValueJourney, FirstValueJourneyInput } from '../utils/firstValueJourney';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

const baseInput: FirstValueJourneyInput = {
  songs: [],
  scales: [],
  allUsers: [{ id: 'user1' }],
  canEditScales: true,
  canCreateSongs: true,
  canManageMembers: true,
  organizationId: 'org1',
  loading: false
};

// 1. loading mantém jornada carregando.
const test1 = evaluateFirstValueJourney({ ...baseInput, loading: true });
assert(test1.isLoading === true && test1.isEligible === false, "loading mantém jornada carregando.");

// 2. usuário sem capacidade não recebe jornada.
const test2 = evaluateFirstValueJourney({ ...baseInput, canEditScales: false });
assert(test2.isEligible === false, "usuário sem capacidade não recebe jornada.");

// 3. organização sem músicas inicia em repertoire.
const test3 = evaluateFirstValueJourney({ ...baseInput });
assert(test3.currentEssentialStep === 'repertoire', "organização sem músicas inicia em repertoire.");

// 4. uma música conclui Repertório.
const test4 = evaluateFirstValueJourney({ ...baseInput, songs: [{ id: 's1' }] });
assert(test4.completedEssentialSteps >= 1 && test4.milestones.find(m => m.id === 'repertoire')?.status === 'completed', "uma música conclui Repertório.");

// 5. músicas sem escala iniciam firstScale.
assert(test4.currentEssentialStep === 'firstScale', "músicas sem escala iniciam firstScale.");

// 6. escala draft conclui Primeira escala.
const test6 = evaluateFirstValueJourney({ ...baseInput, songs: [{ id: 's1' }], scales: [{ id: 'sc1', status: 'draft' }] });
assert(test6.completedEssentialSteps >= 2 && test6.milestones.find(m => m.id === 'firstScale')?.status === 'completed', "escala draft conclui Primeira escala.");

// 7. escala draft inicia publish.
assert(test6.currentEssentialStep === 'publish', "escala draft inicia publish.");

// 8. ausência de equipe não bloqueia publish.
assert(test6.milestones.find(m => m.id === 'publish')?.status === 'current', "ausência de equipe não bloqueia publish.");

// 9. equipe com mais de um usuário ativa flag hasTeam.
const test9 = evaluateFirstValueJourney({ ...baseInput, songs: [{ id: 's1' }], scales: [{ id: 'sc1', status: 'draft' }], allUsers: [{ id: 'user1' }, { id: 'user2' }] });
assert(test9.hasTeam === true, "equipe com mais de um usuário ativa hasTeam.");

// 10. equipe sem usuários adicionais desativa hasTeam.
const test10 = evaluateFirstValueJourney({ ...baseInput, songs: [{ id: 's1' }], scales: [{ id: 'sc1', status: 'draft' }] });
assert(test10.hasTeam === false, "equipe sem usuários adicionais desativa hasTeam.");

// 11. escala published conclui a jornada.
const test11 = evaluateFirstValueJourney({ ...baseInput, songs: [{ id: 's1' }], scales: [{ id: 'sc1', status: 'published' }] });
assert(test11.isCompleted === true, "escala published conclui a jornada.");

// 12. escala legada sem status conclui a jornada.
const test12 = evaluateFirstValueJourney({ ...baseInput, songs: [{ id: 's1' }], scales: [{ id: 'sc1' }] });
assert(test12.isCompleted === true, "escala legada sem status conclui a jornada.");

// 13. escala cancelled não conclui jornada.
const test13 = evaluateFirstValueJourney({ ...baseInput, songs: [{ id: 's1' }], scales: [{ id: 'sc1', status: 'cancelled' }] });
assert(test13.isCompleted === false && test13.currentEssentialStep === 'firstScale', "escala cancelled não conclui jornada.");

// 14. rascunho mais recente é selecionado.
const test14 = evaluateFirstValueJourney({ 
  ...baseInput, 
  songs: [{ id: 's1' }], 
  scales: [
    { id: 'sc1', status: 'draft', createdAt: { toMillis: () => 1000 } },
    { id: 'sc2', status: 'draft', createdAt: { toMillis: () => 3000 } },
    { id: 'sc3', status: 'draft', createdAt: { toMillis: () => 2000 } }
  ] 
});
assert(test14.draftScale?.id === 'sc2', "rascunho mais recente é selecionado.");

console.log('All evaluateFirstValueJourney tests passed!');
