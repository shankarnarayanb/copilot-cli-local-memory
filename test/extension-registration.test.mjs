import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
    copyFile,
    mkdir,
    mkdtemp,
    readFile,
    rm,
    writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const extensionRoot = join(packageRoot, "extensions", "local-memory");

test("extension registers Copilot commands and natural-language tools", async () => {
    const root = await mkdtemp(join(tmpdir(), "copilot-local-memory-extension-"));
    const sdkDir = join(root, "node_modules", "@github", "copilot-sdk");
    const capturePath = join(root, "capture.json");

    try {
        await mkdir(sdkDir, { recursive: true });
        await copyFile(join(extensionRoot, "extension.mjs"), join(root, "extension.mjs"));
        await copyFile(
            join(extensionRoot, "memory-store.mjs"),
            join(root, "memory-store.mjs"),
        );
        await writeFile(
            join(sdkDir, "package.json"),
            JSON.stringify({
                name: "@github/copilot-sdk",
                type: "module",
                exports: { "./extension": "./extension.mjs" },
            }),
        );
        await writeFile(
            join(sdkDir, "extension.mjs"),
            `import { writeFile } from "node:fs/promises";

export async function joinSession(config) {
    const logs = [];
    const fakeSession = {
        log: async (message) => logs.push(message),
    };

    setTimeout(async () => {
        try {
            const remember = config.commands.find(({ name }) => name === "remember");
            const memories = config.commands.find(({ name }) => name === "memories");
            const recall = config.tools.find(({ name }) => name === "local_memory_recall");

            await remember.handler({
                args: '--scope "src/**/*.ts" Prefer Zod for validation.',
            });
            await memories.handler({ args: "Zod validation" });
            const recalled = await recall.handler({ query: "Zod validation", limit: 5 });

            await writeFile(
                process.env.CAPTURE_PATH,
                JSON.stringify({
                    commands: config.commands.map(({ name }) => name),
                    tools: config.tools.map(({ name }) => name),
                    logs,
                    recalled,
                }),
            );
        } catch (error) {
            await writeFile(
                process.env.CAPTURE_PATH,
                JSON.stringify({ error: error?.stack ?? String(error) }),
            );
            process.exitCode = 1;
        }
    }, 0);

    return fakeSession;
}
`,
        );

        await execFileAsync(process.execPath, [join(root, "extension.mjs")], {
            env: {
                ...process.env,
                COPILOT_HOME: join(root, "copilot-home"),
                CAPTURE_PATH: capturePath,
            },
        });

        const capture = JSON.parse(await readFile(capturePath, "utf8"));
        assert.equal(capture.error, undefined);
        assert.deepEqual(capture.commands, ["remember", "memories", "forget"]);
        assert.deepEqual(capture.tools, [
            "local_memory_remember",
            "local_memory_recall",
        ]);
        assert.match(capture.logs[0], /Remembered [a-z0-9]+ for files matching src\/\*\*\/\*\.ts/);
        assert.match(capture.logs[1], /Prefer Zod for validation/);
        assert.match(capture.recalled, /Prefer Zod for validation/);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
