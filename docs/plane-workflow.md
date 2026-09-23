# SmartBrew Plane workflow

This document is the persistent source of truth for agents working from the
SmartBrew Plane board at `http://localhost:8081/smartbrew`.

## Required ticket lifecycle

Every product ticket must follow this sequence:

1. **Backlog → Todo:** select the highest-priority actionable ticket and move it
   to Todo for analysis.
2. **Todo — analysis:** inspect its objective, scope, acceptance criteria,
   dependencies, relevant code, repository instructions, and existing changes.
3. **Split when needed:** if the ticket is too large, complex, or partially
   blocked by an approval or product decision, prepare small concrete subtickets
   and follow the approval protocol below. Block only the subticket that truly
   needs user input; continue with the independent actionable subtickets.
4. **Todo → In Progress:** move the ticket only after analysis is complete and
   the next implementation step is clear and executable.
5. **In Progress — implementation:** make a real, bounded change and verify it
   with the relevant tests, lint, typecheck, build, or runtime check.
6. **In Progress → Done:** move the ticket to Done only when every required
   acceptance criterion is satisfied and relevant verification passes. Never
   leave a resolved ticket in In Progress, and never mark incomplete work Done.
7. **Automatic status synchronization:** once verification passes, update Plane
   automatically: move the completed ticket to Done and move the next analyzed,
   actionable related ticket to In Progress. Do not request an additional user
   approval for these routine lifecycle transitions.

## Queue and safety rules

- Work in this order: In Progress, then Todo, then Backlog.
- Within the same state, prioritize continuity: first select subtickets of the
  current parent ticket, then other tickets directly related to that parent or
  feature, before starting unrelated work. Respect dependency order so a
  prerequisite is completed before a ticket that depends on it.
- Process one actionable product ticket at a time.
- Ignore Plane demo/onboarding tickets unless the user explicitly requests them.
- Do not redo completed work or overwrite unrelated changes.
- Do not deploy, publish, purchase, change credentials, or perform other
  irreversible external actions without explicit authorization.
- If a required decision, credential, or permission is missing, request exactly
  what is needed and leave the blocked work accurately represented in Plane.
- Keep Plane status synchronized with the actual repository state whenever the
  interface is available.

## Split approval and notification protocol

Before creating subtickets in Plane:

1. Send a user notification from the current Codex task with `NOTIFY` status.
2. Name the parent ticket and list every proposed subticket in that notification.
3. End with an explicit request such as: `Respondé: APROBAR SPLIT SMART-15`.
4. Keep the parent ticket in Todo while approval is pending; do not move it to
   In Progress and do not create the proposed subtickets yet.
5. Treat only a user-authored approval response for that specific parent ticket
   as authorization to create the split in Plane.
6. After creation, send another notification listing the created ticket IDs and
   identify which one will move to In Progress first.

If a heartbeat fires again while approval is pending and there is no new user
response, stay quiet with `DONT_NOTIFY`; do not repeatedly send the same request.
