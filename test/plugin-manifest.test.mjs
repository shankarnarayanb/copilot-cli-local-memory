import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

test("plugin manifest packages the Copilot CLI extension", async () => {
    const manifest = JSON.parse(
        await readFile(join(packageRoot, "plugin.json"), "utf8"),
    );
    const packageMetadata = JSON.parse(
        await readFile(join(packageRoot, "package.json"), "utf8"),
    );

    assert.equal(manifest.name, "copilot-cli-local-memory");
    assert.equal(manifest.version, packageMetadata.version);
    assert.equal(manifest.extensions, undefined);
    assert.equal(manifest.license, "MIT");
    assert.equal(manifest.repository, packageMetadata.repository.url.replace(/\.git$/, ""));
    assert.match(manifest.description, /local/i);
    assert.match(manifest.description, /memory/i);
    assert.ok(manifest.keywords.includes("copilot-cli"));
    assert.ok(manifest.keywords.every((keyword) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(keyword)));

    await access(join(packageRoot, "extensions", "local-memory", "extension.mjs"));
    await access(join(packageRoot, "extensions", "local-memory", "memory-store.mjs"));
});
