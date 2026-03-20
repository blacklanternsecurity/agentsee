# API Reference

All endpoints are on the same port as the dashboard. Useful for scripting or integrating with other tools.

!!! note
    If [authentication](authentication.md) is enabled, API requests require a Bearer token header:
    `Authorization: Bearer YOUR_TOKEN`

## Endpoints

### Health check

```
GET /health
```

```bash
curl http://localhost:4900/health
```

### List all agents

```
GET /agent/status
```

```bash
curl http://localhost:4900/agent/status
```

### Hold an agent

Pauses the agent on its next tool call.

```
POST /agent/:agent_id/hold
```

```bash
curl -X POST http://localhost:4900/agent/AGENT_ID/hold
```

### Release an agent

Resumes a held agent.

```
POST /agent/:agent_id/release
```

```bash
curl -X POST http://localhost:4900/agent/AGENT_ID/release
```

### Set leash (supervised mode)

Makes the agent check in after a set number of tool calls.

```
POST /agent/:agent_id/threshold
Content-Type: application/json

{"threshold": 5}
```

```bash
# Check in every 5 tools
curl -X POST http://localhost:4900/agent/AGENT_ID/threshold \
  -H "Content-Type: application/json" -d '{"threshold": 5}'
```

### Set autonomous mode

```
POST /agent/:agent_id/threshold
Content-Type: application/json

{"threshold": null}
```

```bash
curl -X POST http://localhost:4900/agent/AGENT_ID/threshold \
  -H "Content-Type: application/json" -d '{"threshold": null}'
```

### Delete an agent

Permanently deletes the agent's transcript from disk.

```
DELETE /agent/:agent_id
```

```bash
curl -X DELETE http://localhost:4900/agent/AGENT_ID
```

## WebSocket

The dashboard connects via WebSocket at `ws://localhost:4900`. Messages are JSON with the format:

```json
{"type": "event_type", "agent_id": "...", "data": {...}}
```

Key event types:

| Type | Direction | Description |
|------|-----------|-------------|
| `init` | server → client | All agents on connect |
| `agent:registered` | server → client | New agent discovered |
| `agent:status` | server → client | Status/mode change |
| `agent:stream` | server → client | Live transcript entry |
| `agent:checkin` | server → client | Agent checking in |
| `agent:removed` | server → client | Agent purged |
| `agent:hold` | client → server | Hold an agent |
| `agent:release` | client → server | Release an agent |
| `agent:remove` | client → server | Purge an agent |
| `agent:remove-all` | client → server | Purge all agents |
| `agent:subscribe` | client → server | Subscribe to agent stream |
