# ADR-002: Unified Chat Context and Entity Resolution

**Status:** Accepted  
**Date:** 2026-08-13  
**Supersedes:** —  
**Related:** ADR-001 (keep custom orchestrator for Lane 1)

## Context

Interactive chat is the primary user interface. Users expect multi-turn references ("move it to 4pm"), multi-step requests ("create a project, schedule a meeting, generate a logo"), and inline rich results (images) without navigating to separate pages.

The existing stack already routes through Orchestrator → AgentCoordinator → Agents → Tools. Agents must not access the database directly.

## Decision

Extend Lane 1 with a **Conversational Orchestration Layer** inserted before the orchestrator:

1. **ConversationContext** — session-only state (`currentEvent`, `currentTask`, etc.) with hybrid persistence: in-memory cache keyed by `userId:sessionId`, recovered from `conversations.entities` JSONB on cache miss.

2. **EntityResolver** — deterministic pronoun/deictic resolution using session state and existing list tools (no raw SQL from agents).

3. **Execution plans** — orchestrator may return a `plan[]` with `dependsOn` and `$step:N.field` input binding; AgentCoordinator runs steps via `executePlan`.

4. **Capability registry** — static manifest (`capabilities.js`) informs the planner; agents unchanged in contract (JSON → tools).

5. **ProjectAgent** — new specialist agent; project logic lives in `services/projects.js`, called from tools and REST routes.

6. **Chat persistence** — assistant turns store `entities` JSONB (active entities, attachments, steps); frontend renders inline images.

We do **not** migrate chat to LangChain/LangGraph (per ADR-001).

## Consequences

### Positive

- Lower latency for specialist routes (8B tier unchanged); complex multi-intent uses 70B planner.
- Follow-up utterances resolve entities without re-asking.
- Multi-agent workflows composable without new pages.
- Architecture contract preserved: Agents → Tools → Services → Database.

### Negative

- Session state can stale if user switches devices (mitigated by JSONB recovery per sessionId).
- Large base64 images in `entities` capped/truncated; object storage deferred.
- Planner accuracy depends on orchestrator prompt quality; eval harness still needed (Stage B).

## Implementation

- `backend/src/conversation/*`
- `backend/src/agents/capabilities.js`, `projectAgent.js`
- `backend/src/routes/agents.js` — `sessionId`, `entities` column
- `frontend/src/hooks/useChat.js`, `frontend/src/pages/Chat.jsx`
