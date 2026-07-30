const fs = require('fs');
const file = 'pages/NotificationsPage.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
`  const getLocalizedTitle = (notif: Notification) => {
    if (i18n.language.startsWith('en')) {
      if (notif.type === 'music_scale_assignment') return "You have been scheduled!";
      if (notif.type === 'music_scale_changed') return "Music Scale Updated";
      if (notif.type === 'band_scale' && notif.metadata?.action === 'role_changed') return "Your role in the scale has been changed";
    } else if (i18n.language.startsWith('es')) {
      if (notif.type === 'music_scale_assignment') return "¡Has sido programado!";
      if (notif.type === 'music_scale_changed') return "Escala Musical Actualizada";
      if (notif.type === 'band_scale' && notif.metadata?.action === 'role_changed') return "Su función en la escala ha sido modificada";
    }
    
    // In PT, use the server-generated title (which is already formatted correctly with 'tocar', 'cantar', etc)
    // Just clean up legacy 'Sua função' if it exists.
    if (notif.type === 'music_scale_assignment' && notif.title) {
       return notif.title.replace(' tocar Sua função', '').replace('Sua função', '').trim() || 'Você foi escalado!';
    }
    
    return notif.title;
  };`,
`  const getLocalizedTitle = (notif: Notification) => {
    if (i18n.language.startsWith('en')) {
      if (notif.type === 'music_scale_assignment') return "You have been scheduled!";
      if (notif.type === 'music_scale_changed') return "Music Scale Updated";
      if (notif.type === 'music_scale_cancelled') return "Music Scale Cancelled";
      if (notif.type === 'music_scale_published') return "Music Scale Published";
      if (notif.type === 'band_scale' && notif.metadata?.action === 'role_changed') return "Your role in the scale has been changed";
    } else if (i18n.language.startsWith('es')) {
      if (notif.type === 'music_scale_assignment') return "¡Has sido programado!";
      if (notif.type === 'music_scale_changed') return "Escala Musical Actualizada";
      if (notif.type === 'music_scale_cancelled') return "Escala Musical Cancelada";
      if (notif.type === 'music_scale_published') return "Escala Musical Publicada";
      if (notif.type === 'band_scale' && notif.metadata?.action === 'role_changed') return "Su función en la escala ha sido modificada";
    }
    
    // In PT, use the server-generated title (which is already formatted correctly with 'tocar', 'cantar', etc)
    if (notif.type === 'music_scale_assignment' && notif.title) {
       return notif.title.replace(' tocar Sua função', '').replace('Sua função', '').trim() || 'Você foi escalado!';
    }
    if (notif.type === 'music_scale_cancelled' && !notif.title) return "Escala Cancelada";
    if (notif.type === 'music_scale_published' && !notif.title) return "Escala Publicada";
    if (notif.type === 'music_scale_changed' && !notif.title) return "Escala Alterada";
    
    return notif.title || '';
  };`
);

content = content.replace(
`    if (notif.type === 'music_scale_assignment' || notif.type === 'music_scale_changed') {
      const scale = findScaleForNotification(notif);
      if (scale) {
        const datePart = formatEventDate(scale.date);
        
        if (i18n.language.startsWith('en')) {
          const timePart = scale.time ? \` at \${scale.time}\` : '';
          return \`At the event on \${datePart}\${timePart}.\`;
        } else if (i18n.language.startsWith('es')) {
          const timePart = scale.time ? \` a las \${scale.time}\` : '';
          return \`En el evento del día \${datePart}\${timePart}.\`;
        }
        
        const timePart = scale.time ? \` às \${scale.time}\` : '';
        return \`No evento do dia \${datePart}\${timePart}.\`;
      }
    }`,
`    if (['music_scale_assignment', 'music_scale_changed', 'music_scale_cancelled', 'music_scale_published'].includes(notif.type || '')) {
      const scale = findScaleForNotification(notif);
      if (scale) {
        const datePart = formatEventDate(scale.date);
        
        if (i18n.language.startsWith('en')) {
          const timePart = scale.time ? \` at \${scale.time}\` : '';
          if (notif.type === 'music_scale_cancelled') return \`The event on \${datePart}\${timePart} has been cancelled.\`;
          return \`At the event on \${datePart}\${timePart}.\`;
        } else if (i18n.language.startsWith('es')) {
          const timePart = scale.time ? \` a las \${scale.time}\` : '';
          if (notif.type === 'music_scale_cancelled') return \`El evento del día \${datePart}\${timePart} ha sido cancelado.\`;
          return \`En el evento del día \${datePart}\${timePart}.\`;
        }
        
        const timePart = scale.time ? \` às \${scale.time}\` : '';
        if (notif.type === 'music_scale_cancelled') return \`O evento do dia \${datePart}\${timePart} foi cancelado.\`;
        return \`No evento do dia \${datePart}\${timePart}.\`;
      }
    }`
);

fs.writeFileSync(file, content);
