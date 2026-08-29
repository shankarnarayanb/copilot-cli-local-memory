import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
    createMemoryStore,
    detectSensitiveValue,
    MemoryValidationError,
} from "../extensions/local-memory/memory-store.mjs";

async function withStore(run) {
    const root = await mkdtemp(join(tmpdir(), "copilot-local-memory-"));
    let nextId = 0;
    const ids = ["aaaaaa0001", "bbbbbb0002", "cccccc0003"];
    const store = createMemoryStore({
        copilotHome: root,
        now: () => new Date("2026-08-28T12:00:00.000Z"),
        generateId: () => ids[nextId++],
    });

    try {
        await run({ root, store });
    } finally {
        await rm(root, { recursive: true, force: true });
    }
}

test("remember writes a modular user instruction and list reads it", async () => {
    await withStore(async ({ store }) => {
        const result = await store.remember(
            "When using deploy-tool, pass --dry-run before production.",
        );

        assert.equal(result.status, "added");
        assert.equal(result.memory.id, "aaaaaa0001");

        const content = await readFile(
            join(store.memoryDir, result.memory.filename),
            "utf8",
        );
        assert.match(content, /^---\napplyTo: "\*\*"\n---/);
        assert.match(content, /copilot-local-memory/);

        const memories = await store.list();
        assert.deepEqual(
            memories.map(({ id, applyTo, caveat }) => ({ id, applyTo, caveat })),
            [
                {
                    id: "aaaaaa0001",
                    applyTo: "**",
                    caveat: "When using deploy-tool, pass --dry-run before production.",
                },
            ],
        );
    });
});

test("remember deduplicates equivalent whitespace and casing", async () => {
    await withStore(async ({ store }) => {
        await store.remember("Prefer JSON output for audit-tool.");
        const duplicate = await store.remember("  prefer   json output FOR audit-tool.  ");

        assert.equal(duplicate.status, "duplicate");
        assert.equal((await store.list()).length, 1);
    });
});

test("the same caveat can have independent file scopes", async () => {
    await withStore(async ({ store }) => {
        const global = await store.remember("Use Zod for validation.");
        const scoped = await store.remember("Use Zod for validation.", {
            applyTo: "src/**/*.ts",
        });

        assert.equal(global.status, "added");
        assert.equal(scoped.status, "added");
        assert.equal((await store.list()).length, 2);

        const content = await readFile(
            join(store.memoryDir, scoped.memory.filename),
            "utf8",
        );
        assert.match(content, /^---\napplyTo: "src\/\*\*\/\*\.ts"\n---/);
        assert.equal(scoped.memory.applyTo, "src/**/*.ts");
    });
});

test("invalid multiline file scopes are rejected", async () => {
    await withStore(async ({ store }) => {
        await assert.rejects(
            () =>
                store.remember("Use Zod for validation.", {
                    applyTo: "src/**\nexcludeAgent: cloud-agent",
                }),
            (error) =>
                error instanceof MemoryValidationError &&
                error.code === "invalid_scope",
        );
    });
});

test("forget refuses ambiguous text and accepts an exact ID", async () => {
    await withStore(async ({ store }) => {
        const first = await store.remember("Run verify-tool before release.");
        await store.remember("Run verify-tool with --strict for production.");

        const ambiguous = await store.forget("verify-tool");
        assert.equal(ambiguous.status, "ambiguous");
        assert.equal(ambiguous.matches.length, 2);

        const deleted = await store.forget(first.memory.id);
        assert.equal(deleted.status, "deleted");
        assert.equal((await store.list()).length, 1);
    });
});

test("search filters by text and partial ID", async () => {
    await withStore(async ({ store }) => {
        await store.remember("Use the staging account for smoke tests.");
        await store.remember("Never pass --force to migration-tool.");

        assert.equal((await store.search("migration")).length, 1);
        assert.equal((await store.search("bbbb")).length, 1);
        assert.equal((await store.search()).length, 2);
    });
});

test("search ranks multi-term matches and searches file scope", async () => {
    await withStore(async ({ store }) => {
        const best = await store.remember(
            "For migration-tool, always run a dry run before applying changes.",
        );
        await store.remember("Migration documentation lives in the handbook.");
        const scoped = await store.remember("Use the component test harness.", {
            applyTo: "src/components/**/*.tsx",
        });

        const ranked = await store.search("migration dry run");
        assert.equal(ranked[0].id, best.memory.id);
        assert.equal((await store.search("components tsx"))[0].id, scoped.memory.id);
    });
});

test("list ignores unrelated instruction files", async () => {
    await withStore(async ({ store }) => {
        await store.remember("Use UTC timestamps in reports.");
        await writeFile(
            join(store.memoryDir, "manual.instructions.md"),
            '---\napplyTo: "**"\n---\nThis file belongs to the user.\n',
        );

        assert.equal((await store.list()).length, 1);
    });
});

test("common credential values are rejected without blocking ordinary guidance", async () => {
    assert.equal(detectSensitiveValue("Refresh expired tokens before retrying."), null);
    assert.equal(
        detectSensitiveValue("api_key=abcdefghijklmnopqrstuvwxyz123456"),
        "credential value",
    );
    assert.equal(
        detectSensitiveValue("-----BEGIN OPENSSH PRIVATE KEY-----"),
        "private key",
    );

    await withStore(async ({ store }) => {
        await assert.rejects(
            () => store.remember("password: correct-horse-battery-staple"),
            (error) =>
                error instanceof MemoryValidationError && error.code === "sensitive",
        );
    });
});
