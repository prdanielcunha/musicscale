import fs from 'fs';
let content = fs.readFileSync('components/layout/GlobalCreateAction.tsx', 'utf8');

// Fix previousOverflow logic
content = content.replace(
  'const previousOverflow = useRef<string>(\'\');',
  'const previousOverflow = useRef<string | null>(null);'
);

content = content.replace(
  `  useEffect(() => {
    if (variant === 'mobile') {
      if (isOpen) {
        previousOverflow.current = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = previousOverflow.current;
      }
    }
    return () => {
      if (variant === 'mobile') document.body.style.overflow = previousOverflow.current;
    };
  }, [isOpen, variant]);`,
  `  useEffect(() => {
    if (variant === 'mobile') {
      if (isOpen) {
        previousOverflow.current = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
      } else if (previousOverflow.current !== null) {
        document.body.style.overflow = previousOverflow.current;
      }
    }
    return () => {
      if (variant === 'mobile' && previousOverflow.current !== null) {
        document.body.style.overflow = previousOverflow.current;
      }
    };
  }, [isOpen, variant]);`
);

// Remove the console log
content = content.replace('console.log("handleExitComplete called, pendingAction:", pendingActionRef.current); ', '');

fs.writeFileSync('components/layout/GlobalCreateAction.tsx', content);
