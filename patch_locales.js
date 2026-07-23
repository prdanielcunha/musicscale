const fs = require('fs');
const files = ['locales/pt.json', 'locales/en.json', 'locales/es.json'];

const teamSetupData = {
  pt: {
    "teamSetup": {
      "progress": {
        "title": "Configure sua equipe",
        "membersAdded": "{{count}} pessoas adicionadas",
        "membersAdded_one": "1 pessoa adicionada",
        "membersAdded_zero": "Nenhuma pessoa adicionada",
        "missingAccess": "{{count}} ainda precisa de um perfil de acesso",
        "missingAccess_one": "1 ainda precisa de um perfil de acesso",
        "missingFunctions": "{{count}} ainda precisa de uma função na equipe",
        "missingFunctions_one": "1 ainda precisa de uma função na equipe",
        "configured": "Todos os integrantes estão configurados",
        "continueAction": "Continuar configuração",
        "reviewAction": "Revisar equipe"
      },
      "steps": {
        "stepIndicator": "Etapa {{current}} de {{total}}",
        "understand": "ENTENDER",
        "choosePerson": "ESCOLHER PESSOA",
        "accessProfile": "PERFIL DE ACESSO",
        "functions": "FUNÇÕES NA EQUIPE",
        "review": "REVISAR",
        "back": "Voltar"
      },
      "access": {
        "title": "O que esta pessoa poderá fazer no MusicScale?",
        "description": "Escolha o que essa pessoa poderá fazer.",
        "permissions": {
          "canManageUsers": "Administrar pessoas da equipe",
          "canManageRoles": "Configurar perfis de acesso",
          "canManageRepertoire": "Adicionar e editar músicas",
          "canManageScales": "Criar e editar escalas",
          "canManageChords": "Editar cifras",
          "canViewContent": "Consultar conteúdo e compromissos"
        }
      },
      "functions": {
        "title": "Como esta pessoa poderá servir na equipe?",
        "description": "Agora escolha como ela poderá participar das escalas.",
        "hints": [
          "Você pode marcar mais de uma opção.",
          "Uma pessoa pode servir como vocal e violonista."
        ],
        "categories": {
          "Ministro": "Ministro e liderança musical",
          "Voz": "Vozes",
          "Instrumento": "Instrumentos e funções técnicas"
        },
        "defer": "Definir depois"
      },
      "review": {
        "title": "Está tudo certo?",
        "access": "Perfil de acesso",
        "functions": "Funções ministeriais",
        "deferredFunctions": "Serão definidas depois",
        "save": "Salvar configuração",
        "fix": "Voltar e corrigir"
      },
      "invite": {
        "action": "Convidar nova pessoa",
        "successTitle": "Convite criado",
        "successMessage": "Quando a pessoa aceitar, ela aparecerá nesta lista para você definir suas funções na equipe.",
        "copy": "Copiar convite",
        "configureAnother": "Configurar outra pessoa",
        "backToTeam": "Voltar para equipe",
        "ownerRestricted": "Não é possível convidar proprietários da organização.",
        "limitReached": "O limite de usuários do seu plano foi atingido."
      },
      "completion": {
        "title": "Pessoa configurada",
        "message": "Agora o MusicScale sabe o que essa pessoa pode fazer e em quais funções ela pode ser escalada.",
        "configureNext": "Configurar próxima pessoa",
        "backToTeam": "Voltar para equipe",
        "goToNextEvent": "Ir para o próximo culto"
      },
      "errors": {
        "cannotChangeSelfAccess": "Você não pode alterar seu próprio perfil de acesso.",
        "saveFailed": "Erro ao salvar a configuração.",
        "tryAgain": "Tentar novamente"
      },
      "understand": {
         "title1": "Vínculo com a organização",
         "text1": "Define de qual organização a pessoa faz parte. Essa configuração vem da MillionsNest.",
         "badge1": "Administrado pela MillionsNest",
         "title2": "Perfil de acesso",
         "text2": "Define o que a pessoa poderá fazer dentro do MusicScale.",
         "example2": "Criar escalas, organizar repertório ou apenas consultar compromissos.",
         "title3": "Funções na equipe",
         "text3": "Define como a pessoa poderá participar das escalas.",
         "example3": "Vocal, teclado, bateria, som ou ministro.",
         "action": "Começar configuração"
      },
      "choose": {
         "incompleteStatus": "Configuração incompleta",
         "missingAccess": "Falta perfil de acesso",
         "missingFunctions": "Falta função na equipe",
         "completeStatus": "Configuração completa"
      }
    }
  },
  en: {
    "teamSetup": {
      "progress": {
        "title": "Configure your team",
        "membersAdded": "{{count}} people added",
        "membersAdded_one": "1 person added",
        "membersAdded_zero": "No people added",
        "missingAccess": "{{count}} still need an access profile",
        "missingAccess_one": "1 still needs an access profile",
        "missingFunctions": "{{count}} still need a team function",
        "missingFunctions_one": "1 still needs a team function",
        "configured": "All members are configured",
        "continueAction": "Continue setup",
        "reviewAction": "Review team"
      },
      "steps": {
        "stepIndicator": "Step {{current}} of {{total}}",
        "understand": "UNDERSTAND",
        "choosePerson": "CHOOSE PERSON",
        "accessProfile": "ACCESS PROFILE",
        "functions": "TEAM FUNCTIONS",
        "review": "REVIEW",
        "back": "Back"
      },
      "access": {
        "title": "What will this person be able to do in MusicScale?",
        "description": "Choose what this person will be able to do.",
        "permissions": {
          "canManageUsers": "Manage team members",
          "canManageRoles": "Configure access profiles",
          "canManageRepertoire": "Add and edit songs",
          "canManageScales": "Create and edit schedules",
          "canManageChords": "Edit chords",
          "canViewContent": "View content and schedules"
        }
      },
      "functions": {
        "title": "How can this person serve on the team?",
        "description": "Now choose how they can participate in the schedules.",
        "hints": [
          "You can select more than one option.",
          "A person can serve as vocal and guitarist."
        ],
        "categories": {
          "Ministro": "Minister and musical leadership",
          "Voz": "Vocals",
          "Instrumento": "Instruments and technical functions"
        },
        "defer": "Define later"
      },
      "review": {
        "title": "Is everything correct?",
        "access": "Access profile",
        "functions": "Ministry functions",
        "deferredFunctions": "Will be defined later",
        "save": "Save configuration",
        "fix": "Go back and fix"
      },
      "invite": {
        "action": "Invite new person",
        "successTitle": "Invite created",
        "successMessage": "When the person accepts, they will appear in this list for you to define their team functions.",
        "copy": "Copy invite",
        "configureAnother": "Configure another person",
        "backToTeam": "Back to team",
        "ownerRestricted": "It is not possible to invite organization owners.",
        "limitReached": "Your plan's user limit has been reached."
      },
      "completion": {
        "title": "Person configured",
        "message": "Now MusicScale knows what this person can do and in what functions they can be scheduled.",
        "configureNext": "Configure next person",
        "backToTeam": "Back to team",
        "goToNextEvent": "Go to next event"
      },
      "errors": {
        "cannotChangeSelfAccess": "You cannot change your own access profile.",
        "saveFailed": "Error saving the configuration.",
        "tryAgain": "Try again"
      },
      "understand": {
         "title1": "Organization link",
         "text1": "Defines which organization the person belongs to. This setup comes from MillionsNest.",
         "badge1": "Managed by MillionsNest",
         "title2": "Access profile",
         "text2": "Defines what the person can do within MusicScale.",
         "example2": "Create schedules, organize repertoire, or just view commitments.",
         "title3": "Team functions",
         "text3": "Defines how the person can participate in the schedules.",
         "example3": "Vocal, keyboard, drums, sound, or minister.",
         "action": "Start setup"
      },
      "choose": {
         "incompleteStatus": "Incomplete setup",
         "missingAccess": "Missing access profile",
         "missingFunctions": "Missing team function",
         "completeStatus": "Setup complete"
      }
    }
  },
  es: {
    "teamSetup": {
      "progress": {
        "title": "Configura tu equipo",
        "membersAdded": "{{count}} personas agregadas",
        "membersAdded_one": "1 persona agregada",
        "membersAdded_zero": "Ninguna persona agregada",
        "missingAccess": "{{count}} aún necesita un perfil de acceso",
        "missingAccess_one": "1 aún necesita un perfil de acceso",
        "missingFunctions": "{{count}} aún necesita una función en el equipo",
        "missingFunctions_one": "1 aún necesita una función en el equipo",
        "configured": "Todos los integrantes están configurados",
        "continueAction": "Continuar configuración",
        "reviewAction": "Revisar equipo"
      },
      "steps": {
        "stepIndicator": "Paso {{current}} de {{total}}",
        "understand": "ENTENDER",
        "choosePerson": "ELEGIR PERSONA",
        "accessProfile": "PERFIL DE ACCESO",
        "functions": "FUNCIONES EN EL EQUIPO",
        "review": "REVISAR",
        "back": "Volver"
      },
      "access": {
        "title": "¿Qué podrá hacer esta persona en MusicScale?",
        "description": "Elige lo que esta persona podrá hacer.",
        "permissions": {
          "canManageUsers": "Administrar personas del equipo",
          "canManageRoles": "Configurar perfiles de acceso",
          "canManageRepertoire": "Añadir y editar canciones",
          "canManageScales": "Crear y editar programaciones",
          "canManageChords": "Editar acordes",
          "canViewContent": "Consultar contenido y programaciones"
        }
      },
      "functions": {
        "title": "¿Cómo podrá servir esta persona en el equipo?",
        "description": "Ahora elige cómo podrá participar en las programaciones.",
        "hints": [
          "Puedes marcar más de una opción.",
          "Una persona puede servir como vocal y guitarrista."
        ],
        "categories": {
          "Ministro": "Ministro y liderazgo musical",
          "Voz": "Voces",
          "Instrumento": "Instrumentos y funciones técnicas"
        },
        "defer": "Definir después"
      },
      "review": {
        "title": "¿Está todo correcto?",
        "access": "Perfil de acceso",
        "functions": "Funciones ministeriales",
        "deferredFunctions": "Se definirán después",
        "save": "Guardar configuración",
        "fix": "Volver y corregir"
      },
      "invite": {
        "action": "Invitar a nueva persona",
        "successTitle": "Invitación creada",
        "successMessage": "Cuando la persona acepte, aparecerá en esta lista para que definas sus funciones en el equipo.",
        "copy": "Copiar invitación",
        "configureAnother": "Configurar a otra persona",
        "backToTeam": "Volver al equipo",
        "ownerRestricted": "No es posible invitar a los propietarios de la organización.",
        "limitReached": "Se ha alcanzado el límite de usuarios de tu plan."
      },
      "completion": {
        "title": "Persona configurada",
        "message": "Ahora MusicScale sabe lo que esta persona puede hacer y en qué funciones puede ser programada.",
        "configureNext": "Configurar siguiente persona",
        "backToTeam": "Volver al equipo",
        "goToNextEvent": "Ir a la próxima reunión"
      },
      "errors": {
        "cannotChangeSelfAccess": "No puedes cambiar tu propio perfil de acceso.",
        "saveFailed": "Error al guardar la configuración.",
        "tryAgain": "Intentar nuevamente"
      },
      "understand": {
         "title1": "Vínculo con la organización",
         "text1": "Define a qué organización pertenece la persona. Esta configuración proviene de MillionsNest.",
         "badge1": "Administrado por MillionsNest",
         "title2": "Perfil de acceso",
         "text2": "Define lo que la persona podrá hacer dentro de MusicScale.",
         "example2": "Crear programaciones, organizar repertorio o solo consultar compromisos.",
         "title3": "Funciones en el equipo",
         "text3": "Define cómo la persona podrá participar en las programaciones.",
         "example3": "Vocal, teclado, batería, sonido o ministro.",
         "action": "Comenzar configuración"
      },
      "choose": {
         "incompleteStatus": "Configuración incompleta",
         "missingAccess": "Falta perfil de acceso",
         "missingFunctions": "Falta función en el equipo",
         "completeStatus": "Configuración completa"
      }
    }
  }
};

files.forEach(f => {
  const lang = f.replace('locales/', '').replace('.json', '');
  const data = JSON.parse(fs.readFileSync(f, 'utf8'));
  data.teamSetup = teamSetupData[lang].teamSetup;
  fs.writeFileSync(f, JSON.stringify(data, null, 2) + '\n', 'utf8');
});
console.log('Locales updated.');
