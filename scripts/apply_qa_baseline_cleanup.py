from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


http_path = Path("tests/server/music-scale-http-endpoints.test.ts")
http = http_path.read_text()

http = replace_once(
    http,
    "import { describe, it, expect, vi, beforeEach } from 'vitest';\nimport request from 'supertest';\n\n",
    "import { describe, it, expect, vi, beforeEach } from 'vitest';\nimport request from 'supertest';\n\nvi.hoisted(() => {\n  process.env.VERCEL = 'true';\n});\n\n",
    "http hoisted env insertion",
)

http = replace_once(
    http,
    "// Set process.env.VERCEL so startLocalServer is NOT started\nprocess.env.VERCEL = 'true';\n\n// Import our Express application\n",
    "// Import our Express application\n",
    "http ineffective env removal",
)

http = replace_once(
    http,
    "    seedStandardUserAndOrg({ userId: 'user_not_escalado', role: 'member', isOwner: false, scaleStatus: 'published' });\n\n    // Try to post response\n",
    "    seedStandardUserAndOrg({ userId: 'user_not_escalado', role: 'member', isOwner: false, scaleStatus: 'published' });\n\n    // Keep this authorization/business-rule scenario independent from wall-clock time.\n    const seededScale = mockDbState.get('scales/scale_123');\n    mockDbState.set('scales/scale_123', { ...seededScale, date: '2099-08-10', time: '19:00' });\n\n    // Try to post response\n",
    "http future-date fixture",
)

http_path.write_text(http)

ai_path = Path("tests/unit/apiAiImport.test.ts")
ai = ai_path.read_text()

ai = replace_once(
    ai,
    "import { describe, it, expect, vi, beforeEach } from 'vitest';\nimport request from 'supertest';\nimport app from '../../server';\nimport { areKeysEnharmonicallyEquivalent } from '../../utils/chordEngine';\n\n",
    "import { describe, it, expect, vi, beforeEach } from 'vitest';\nimport request from 'supertest';\nimport app from '../../server';\nimport { areKeysEnharmonicallyEquivalent } from '../../utils/chordEngine';\n\nvi.hoisted(() => {\n  process.env.VERCEL = 'true';\n  process.env.GEMINI_API_KEY = 'test-gemini-key';\n});\n\n",
    "ai hoisted test env insertion",
)

ai_path.write_text(ai)

print("QA baseline cleanup applied successfully")
