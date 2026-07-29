const fs = require('fs');
let code = fs.readFileSync('tests/ui/music-scale-publish-integrity.test.tsx', 'utf8');

code = code.replace(`const TestComponent = () => {\n  const { handleSaveScale, openScaleForm, scaleType } = useModals();`, `const TestComponent = () => {\n  const { handleSaveScale, openScaleForm } = useModals();`);

code = code.replace(`console.log("TestComponent rendering! scaleType:", scaleType);\n  \n  // Use a ref to track if handleSaveScale changes\n  const prevHandleSaveScale = React.useRef(handleSaveScale);\n  React.useEffect(() => {\n    if (prevHandleSaveScale.current !== handleSaveScale) {\n        console.log("handleSaveScale reference CHANGED!");\n        prevHandleSaveScale.current = handleSaveScale;\n    }\n  }, [handleSaveScale]);\n\n  const handlePublish = async () => {\n\n    \n    try {`, `const handlePublish = async () => {\n    try {`);

code = code.replace(`console.log("RES:", res);\n      setResult(JSON.stringify(res));\n    } catch (e: any) {\n      console.log("ERROR:", e);\n      setResult(e.message);\n    }`, `setResult(JSON.stringify(res));\n    } catch (e: any) {\n      setResult(e.message);\n    }`);

code = code.replace(`console.log("RESULT:", resultDiv2.textContent);\n      expect(resultDiv2.textContent).toContain('publish-failed');`, `expect(resultDiv2.textContent).toContain('publish-failed');`);

fs.writeFileSync('tests/ui/music-scale-publish-integrity.test.tsx', code);
