import { randomUUID } from "node:crypto";
import {
    mkdir,
    readdir,
    readFile,
    rename,
    unlink,
    writeFile,
} from "node:fs/promises";
import { join } from "node:path";

export const MAX_CAVEAT_LENGTH = 2_000;
export const MAX_SCOPE_LENGTH = 256;

const FILE_SUFFIX = ".instructions.md";
const FRONTMATTER_PATTERN = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;
const METADATA_PATTERN = /<!--\s*copilot-local-memory\s+(\{[\s\S]*?\})\s*-->/;

const SENSITIVE_PATTERNS = [
    {
        label: "private key",
        pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
    },
    {
        label: "GitHub token",
        pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
    },
    {
        label: "AWS access key",
        pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
    },
    {
        label: "JSON Web Token",
        pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
    },
    {
        label: "bearer token",
        pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/i,
    },
    {
        label: "credential value",
        pattern:
            /\b(?:password|passwd|api[_ -]?key|client[_ -]?secret|access[_ -]?token|refresh[_ -]?token)\s*[:=]\s*["']?(?!(?:<[^>]+>|redacted\b|masked\b|example\b|none\b|null\b))[^\s"'`]{8,}/i,
    },
];

export class MemoryValidationError extends Error {
    constructor(code, message, details = undefined) {
        super(message);
        this.name = "MemoryValidationError";
        this.code = code;
        this.details = details;
    }
}

export function normalizeForMatch(value) {
    return String(value ?? "")
        .normalize("NFKC")
        .replace(/\s+/g, " ")
        .trim()
        .toLocaleLowerCase("en-US");
}

export function detectSensitiveValue(value) {
    const text = String(value ?? "");
    return SENSITIVE_PATTERNS.find(({ pattern }) => pattern.test(text))?.label ?? null;
}

export function normalizeApplyTo(value = "**") {
    const applyTo = String(value ?? "").trim();
    if (!applyTo) {
        throw new MemoryValidationError("invalid_scope", "The path scope is empty.");
    }
    if (applyTo.length > MAX_SCOPE_LENGTH || /[\u0000\r\n]/.test(applyTo)) {
        throw new MemoryValidationError(
            "invalid_scope",
            `Path scopes must be a single line of at most ${MAX_SCOPE_LENGTH} characters.`,
        );
    }
    return applyTo;
}

function cleanCaveat(value) {
    return String(value ?? "").replace(/\r\n?/g, "\n").trim();
}

function slugify(value) {
    const slug = value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("en-US")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48)
        .replace(/-+$/g, "");

    return slug || "memory";
}

function renderInstruction(memory) {
    const metadata = JSON.stringify({
        id: memory.id,
        createdAt: memory.createdAt,
        applyTo: memory.applyTo,
        version: 1,
    });

    return [
        "---",
        `applyTo: ${JSON.stringify(memory.applyTo)}`,
        "---",
        `<!-- copilot-local-memory ${metadata} -->`,
        "",
        memory.caveat,
        "",
    ].join("\n");
}

function parseInstruction(filename, content) {
    const metadataMatch = content.match(METADATA_PATTERN);
    if (!metadataMatch) {
        return null;
    }

    let metadata;
    try {
        metadata = JSON.parse(metadataMatch[1]);
    } catch {
        return null;
    }

    if (
        typeof metadata.id !== "string" ||
        !/^[a-z0-9]{6,32}$/i.test(metadata.id) ||
        typeof metadata.createdAt !== "string" ||
        Number.isNaN(Date.parse(metadata.createdAt))
    ) {
        return null;
    }

    const caveat = content
        .replace(FRONTMATTER_PATTERN, "")
        .replace(METADATA_PATTERN, "")
        .trim();

    if (!caveat) {
        return null;
    }

    const applyTo =
        typeof metadata.applyTo === "string" &&
        metadata.applyTo.length <= MAX_SCOPE_LENGTH &&
        !/[\u0000\r\n]/.test(metadata.applyTo)
            ? metadata.applyTo
            : "**";

    return {
        id: metadata.id,
        createdAt: metadata.createdAt,
        applyTo,
        caveat,
        filename,
    };
}

function defaultId() {
    return randomUUID().replaceAll("-", "").slice(0, 10);
}

export function createMemoryStore({
    copilotHome,
    now = () => new Date(),
    generateId = defaultId,
} = {}) {
    if (!copilotHome) {
        throw new TypeError("copilotHome is required");
    }

    const memoryDir = join(copilotHome, "instructions", "local-memory");

    async function list() {
        let entries;
        try {
            entries = await readdir(memoryDir, { withFileTypes: true });
        } catch (error) {
            if (error?.code === "ENOENT") {
                return [];
            }
            throw error;
        }

        const memories = [];
        for (const entry of entries) {
            if (!entry.isFile() || !entry.name.endsWith(FILE_SUFFIX)) {
                continue;
            }

            try {
                const content = await readFile(join(memoryDir, entry.name), "utf8");
                const memory = parseInstruction(entry.name, content);
                if (memory) {
                    memories.push(memory);
                }
            } catch (error) {
                // Another command may have removed a file after readdir().
                if (error?.code !== "ENOENT") {
                    throw error;
                }
            }
        }

        return memories.sort((left, right) =>
            right.createdAt.localeCompare(left.createdAt),
        );
    }

    async function remember(value, { applyTo: requestedScope = "**" } = {}) {
        const caveat = cleanCaveat(value);
        if (!caveat) {
            throw new MemoryValidationError("empty", "The caveat is empty.");
        }
        if (caveat.length > MAX_CAVEAT_LENGTH) {
            throw new MemoryValidationError(
                "too_long",
                `Caveats are limited to ${MAX_CAVEAT_LENGTH} characters.`,
            );
        }

        const sensitiveKind = detectSensitiveValue(caveat);
        if (sensitiveKind) {
            throw new MemoryValidationError(
                "sensitive",
                `The caveat appears to contain a ${sensitiveKind}.`,
                sensitiveKind,
            );
        }

        const applyTo = normalizeApplyTo(requestedScope);

        const existing = await list();
        const normalized = normalizeForMatch(caveat);
        const duplicate = existing.find(
            (memory) =>
                normalizeForMatch(memory.caveat) === normalized &&
                memory.applyTo === applyTo,
        );
        if (duplicate) {
            return { status: "duplicate", memory: duplicate };
        }

        const existingIds = new Set(existing.map(({ id }) => id));
        let id;
        for (let attempt = 0; attempt < 10; attempt += 1) {
            const candidate = String(generateId()).toLocaleLowerCase("en-US");
            if (/^[a-z0-9]{6,32}$/.test(candidate) && !existingIds.has(candidate)) {
                id = candidate;
                break;
            }
        }
        if (!id) {
            throw new Error("Could not generate a unique memory ID.");
        }

        const createdAt = new Date(now()).toISOString();
        const memory = { id, createdAt, applyTo, caveat };
        const filename = `${id}-${slugify(caveat)}${FILE_SUFFIX}`;
        const temporaryFilename = `.${filename}.${randomUUID()}.tmp`;

        await mkdir(memoryDir, { recursive: true, mode: 0o700 });
        const temporaryPath = join(memoryDir, temporaryFilename);
        try {
            await writeFile(temporaryPath, renderInstruction(memory), {
                encoding: "utf8",
                mode: 0o600,
                flag: "wx",
            });
            await rename(temporaryPath, join(memoryDir, filename));
        } catch (error) {
            await unlink(temporaryPath).catch(() => {});
            throw error;
        }

        return {
            status: "added",
            memory: { ...memory, filename },
        };
    }

    async function search(value = "") {
        const query = normalizeForMatch(value);
        const memories = await list();
        if (!query) {
            return memories;
        }

        const queryTerms = [...new Set(query.match(/[a-z0-9]+/g) ?? [])];
        return memories
            .map((memory) => {
                const id = memory.id.toLocaleLowerCase("en-US");
                const searchable = normalizeForMatch(
                    `${memory.caveat} ${memory.applyTo}`,
                );
                const searchableTerms = new Set(searchable.match(/[a-z0-9]+/g) ?? []);
                let score = 0;

                if (id === query) score += 10_000;
                else if (id.startsWith(query)) score += 2_000;
                else if (id.includes(query)) score += 1_000;

                if (searchable.includes(query)) score += 500;
                for (const term of queryTerms) {
                    if (searchableTerms.has(term)) score += 50;
                    else if (searchable.includes(term)) score += 10;
                }

                return score > 0 ? { memory, score } : null;
            })
            .filter(Boolean)
            .sort(
                (left, right) =>
                    right.score - left.score ||
                    right.memory.createdAt.localeCompare(left.memory.createdAt),
            )
            .map(({ memory }) => memory);
    }

    async function forget(value) {
        const query = normalizeForMatch(value);
        if (!query) {
            throw new MemoryValidationError("empty", "The forget query is empty.");
        }

        const memories = await list();
        let matches = memories.filter(
            (memory) => memory.id.toLocaleLowerCase("en-US") === query,
        );

        if (matches.length === 0) {
            matches = memories.filter(
                (memory) => normalizeForMatch(memory.caveat) === query,
            );
        }

        if (matches.length === 0) {
            matches = memories.filter(
                (memory) =>
                    (query.length >= 4 &&
                        memory.id.toLocaleLowerCase("en-US").startsWith(query)) ||
                    normalizeForMatch(memory.caveat).includes(query),
            );
        }

        if (matches.length === 0) {
            return { status: "not_found", matches: [] };
        }
        if (matches.length > 1) {
            return { status: "ambiguous", matches };
        }

        const [memory] = matches;
        try {
            await unlink(join(memoryDir, memory.filename));
        } catch (error) {
            if (error?.code !== "ENOENT") {
                throw error;
            }
        }

        return { status: "deleted", memory };
    }

    return Object.freeze({ memoryDir, list, remember, search, forget });
}
