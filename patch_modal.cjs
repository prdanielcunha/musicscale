const fs = require('fs');

let code = fs.readFileSync('components/onboarding/StarterRepertoireModal.tsx', 'utf8');

// Replace props interface
code = code.replace(
  /interface StarterRepertoireModalProps \{[\s\S]*?\}/,
  `interface StarterRepertoireModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onCompleted: (result?: any) => void;
}`
);

// Replace component destructuring
code = code.replace(
  /export function StarterRepertoireModal\(\{ isOpen, onClose, onSuccess \}: StarterRepertoireModalProps\) \{/,
  `export function StarterRepertoireModal({ isOpen, onCancel, onCompleted }: StarterRepertoireModalProps) {`
);

// Replace onSuccess() call
code = code.replace(
  /onSuccess\(\);/g,
  `onCompleted();`
);

// Replace onClose in modal props and buttons
code = code.replace(
  /<Modal isOpen=\{isOpen\} onClose=\{onClose\}/,
  `<Modal isOpen={isOpen} onClose={onCancel}`
);

code = code.replace(
  /onClick=\{onClose\}/,
  `onClick={onCancel}`
);

fs.writeFileSync('components/onboarding/StarterRepertoireModal.tsx', code);
