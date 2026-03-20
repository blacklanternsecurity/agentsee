# Authentication

By default, agentsee binds to `127.0.0.1` with no authentication — only accessible from your local machine.

To access agentsee remotely (e.g. from a host machine into a VM, or over a network), generate an auth token. When a token is present, the server automatically binds to `0.0.0.0` and requires authentication on all routes.

## Generate a token

```bash
bash generate-token.sh
```

This creates a token at `~/.config/agentsee/auth-token` and prints it to the terminal. Restart the server to pick it up.

## How it works

| Token file | Bind address | Auth required |
|-----------|-------------|---------------|
| Absent | `127.0.0.1` | No |
| Present | `0.0.0.0` | Yes |

The `AGENTSEE_HOST` environment variable overrides the bind address if set.

## Browser access

When auth is enabled, navigating to the dashboard redirects you to a login page. Paste your token to log in. Sessions last 24 hours.

## API access

For API or curl access, use a Bearer token:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://your-host:4900/agent/status
```

## Hook endpoints

Hook endpoints (`/hook/pre`, `/hook/post`) are **always allowed** regardless of authentication. Agents authenticate via their hook configuration, not via the auth token.

## Remove authentication

Delete the token file and restart:

```bash
rm ~/.config/agentsee/auth-token
# restart agentsee — it will bind to 127.0.0.1 again
```
