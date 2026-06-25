// Optional GitHub personal access token, persisted in localStorage. It is only used to
// raise the unauthenticated 60-requests/hour API rate limit (and is never required for
// the public repos this editor targets). Mirrors the theme-key convention in main.tsx.

const TOKEN_KEY = 'mkdocs-editor-gh-token'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY) || null
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  const trimmed = token.trim()
  try {
    if (trimmed) localStorage.setItem(TOKEN_KEY, trimmed)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Ignore storage failures (private mode, quota) — the token is a convenience only.
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // no-op
  }
}
