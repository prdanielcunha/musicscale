const fs = require('fs');
const path = './components/scales/ModernScaleForm.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(`    // Using a short timeout to let the state settle before capturing snapshot
    setTimeout(() => {
      setFormData(currentData => {
        initialFormDataRef.current = JSON.stringify(getComparableData(currentData));
        return currentData;
      });
    }, 0);`, `      initialFormDataRef.current = JSON.stringify(getComparableData(next));`);

fs.writeFileSync(path, content);
console.log('Removed setTimeout');
