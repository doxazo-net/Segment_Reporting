// Fix backslash paths in lefthook's generated hook scripts.
// On Windows/MSYS, lefthook writes absolute paths with backslashes
// (e.g., D:\path\to\lefthook.exe) which Git bash interprets as
// escape sequences. This script converts them to forward slashes.
//
// Run from the repo root (the `prepare` script cd's there first). Every hook
// lefthook installs needs the same fix, so process each stage we configure.

import { readFileSync, writeFileSync, existsSync } from "fs";

const hookPaths = [".git/hooks/pre-commit", ".git/hooks/pre-push"];

for (const hookPath of hookPaths) {
    if (!existsSync(hookPath)) {
        continue;
    }
    const content = readFileSync(hookPath, "utf8");
    const fixed = content.replace(/\\/g, "/");
    if (fixed !== content) {
        writeFileSync(hookPath, fixed);
    }
}
