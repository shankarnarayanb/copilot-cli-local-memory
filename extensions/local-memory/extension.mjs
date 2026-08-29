// Copilot CLI extension: local-memory
// Provides local, user-managed persistence through modular custom instructions.

import { homedir } from "node:os";
import { join } from "node:path";

import { joinSession } from "@github/copilot-sdk/extension";

import {
    createMemoryStore,
    MAX_CAVEAT_LENGTH,
    MemoryValidationError,
} from "./memory-store.mjs";

const configuredHome = process.env.COPILOT_HOME?.trim();
const copilotHome = configuredHome || join(homedir(), ".copilot");
const store = createMemoryStore({ copilotHome });

function oneLine(value) {
    return String(value)
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function formatMemory(memory) {
    const scope = memory.applyTo === "**" ? "" : ` [${oneLine(memory.applyTo)}]`;
    return `- ${memory.id}${scope} — ${oneLine(memory.caveat)}`;
}

function parseRememberArgs(value) {
    const raw = String(value ?? "").trim();
    if (!/^--scope(?:=|\s)/.test(raw)) {
        return { caveat: raw, applyTo: "**" };
    }

    const match = raw.match(
        /^--scope(?:=|\s+)(?:"([^"\r\n]+)"|'([^'\r\n]+)'|(\S+))\s+([\s\S]+)$/,
    );
    if (!match) {
        return {
            error: "Usage: /remember [--scope <file glob>] <caveat>",
        };
    }

    return {
        applyTo: match[1] ?? match[2] ?? match[3],
        caveat: match[4].trim(),
    };
}

function describeError(error) {
    if (error instanceof MemoryValidationError) {
        if (error.code === "sensitive") {
            return (
                `I did not save that because it looks like it contains a ${error.details}. ` +
                "Save the rule for obtaining or using the credential, never the credential value."
            );
        }
        if (error.code === "too_long") {
            return `${error.message} Split it into smaller caveats.`;
        }
        return error.message;
    }

    return `Local memory failed: ${error instanceof Error ? error.message : String(error)}`;
}

let session;

async function log(message) {
    await session.log(message, { level: "info" });
}

async function rememberCaveat(caveat, applyTo = "**") {
    try {
        const result = await store.remember(caveat, { applyTo });
        if (result.status === "duplicate") {
            return `Already remembered as ${result.memory.id}: ${oneLine(result.memory.caveat)}`;
        }

        const scope =
            result.memory.applyTo === "**"
                ? "all files"
                : `files matching ${result.memory.applyTo}`;
        return (
            `Remembered ${result.memory.id} for ${scope}: ${oneLine(result.memory.caveat)}\n\n` +
            "Run /new (or start another Copilot CLI session) before relying on it."
        );
    } catch (error) {
        return describeError(error);
    }
}

async function recallCaveats(query, requestedLimit = 8) {
    try {
        const numericLimit = Number(requestedLimit);
        const limit = Number.isFinite(numericLimit)
            ? Math.min(20, Math.max(1, Math.trunc(numericLimit)))
            : 8;
        const memories = (await store.search(query)).slice(0, limit);
        if (memories.length === 0) {
            return `No local memories match: ${oneLine(query)}`;
        }

        return `${memories.length} matching local memor${memories.length === 1 ? "y" : "ies"}:\n${memories
            .map(formatMemory)
            .join("\n")}`;
    } catch (error) {
        return describeError(error);
    }
}

session = await joinSession({
    tools: [
        {
            name: "local_memory_remember",
            description:
                "Persist a user caveat locally across GitHub Copilot CLI sessions. " +
                "Call this only when the user explicitly asks to remember, save, or retain a caveat. " +
                "Do not infer consent, and never store a secret value. The optional applyTo value is " +
                "a Copilot custom-instruction file glob; omit it to apply to all files.",
            defer: "never",
            parameters: {
                type: "object",
                properties: {
                    caveat: {
                        type: "string",
                        description: "The concise, durable caveat to remember.",
                    },
                    applyTo: {
                        type: "string",
                        description:
                            'Optional file glob such as "src/**/*.ts". Defaults to "**".',
                    },
                },
                required: ["caveat"],
                additionalProperties: false,
            },
            handler: async ({ caveat, applyTo = "**" } = {}) =>
                rememberCaveat(caveat, applyTo),
        },
        {
            name: "local_memory_recall",
            description:
                "Search the user's local cross-session GitHub Copilot CLI caveats. " +
                "Call this when the user asks what is remembered, asks about caveats for a named " +
                "tool or workflow, or explicitly asks you to consult local memory. Results are " +
                "deterministically ranked and bounded; no embeddings or network service are used.",
            defer: "never",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "Keywords, tool name, file path, or memory ID to find.",
                    },
                    limit: {
                        type: "integer",
                        minimum: 1,
                        maximum: 20,
                        description: "Maximum results. Defaults to 8.",
                    },
                },
                required: ["query"],
                additionalProperties: false,
            },
            handler: async ({ query, limit = 8 } = {}) => recallCaveats(query, limit),
        },
    ],
    commands: [
        {
            name: "remember",
            description: "Save a local caveat for future Copilot CLI sessions.",
            handler: async (ctx) => {
                const parsed = parseRememberArgs(ctx.args);
                if (parsed.error) {
                    await log(parsed.error);
                    return;
                }

                const { caveat, applyTo } = parsed;
                if (!caveat) {
                    await log(
                        "Usage: /remember [--scope <file glob>] <caveat> " +
                            `(maximum ${MAX_CAVEAT_LENGTH} characters)`,
                    );
                    return;
                }

                await log(await rememberCaveat(caveat, applyTo));
            },
        },
        {
            name: "memories",
            description: "List local memories, optionally filtered by text or ID.",
            handler: async (ctx) => {
                const query = (ctx.args ?? "").trim();
                try {
                    const memories = await store.search(query);
                    if (memories.length === 0) {
                        await log(
                            query
                                ? `No local memories match: ${oneLine(query)}`
                                : "No local memories yet. Add one with /remember <caveat>.",
                        );
                        return;
                    }

                    const heading = query
                        ? `${memories.length} local memory match${memories.length === 1 ? "" : "es"}:`
                        : `${memories.length} local memor${memories.length === 1 ? "y" : "ies"}:`;
                    await log(`${heading}\n${memories.map(formatMemory).join("\n")}`);
                } catch (error) {
                    await log(describeError(error));
                }
            },
        },
        {
            name: "forget",
            description: "Delete a local memory by ID or unique caveat text.",
            handler: async (ctx) => {
                const query = (ctx.args ?? "").trim();
                if (!query) {
                    await log("Usage: /forget <memory ID or unique caveat text>");
                    return;
                }

                try {
                    const result = await store.forget(query);
                    if (result.status === "not_found") {
                        await log(`No local memory matches: ${oneLine(query)}`);
                        return;
                    }
                    if (result.status === "ambiguous") {
                        await log(
                            "That matches more than one memory. Delete one by ID:\n" +
                                result.matches.map(formatMemory).join("\n"),
                        );
                        return;
                    }

                    await log(
                        `Forgot ${result.memory.id}: ${oneLine(result.memory.caveat)}\n\n` +
                            "Run /new (or start another Copilot CLI session) to remove it from loaded instructions.",
                    );
                } catch (error) {
                    await log(describeError(error));
                }
            },
        },
    ],
});
