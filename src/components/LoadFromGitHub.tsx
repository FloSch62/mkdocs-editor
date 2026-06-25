import { useState } from 'react'
import { Box, Button, Collapse, Link, TextField, Typography, CircularProgress } from '@mui/material'
import GitHubIcon from '@mui/icons-material/GitHub'
import { GitHubError, loadRepoMarkdown, type LoadResult } from '../github/api.ts'
import { getToken, setToken } from '../github/token.ts'

const formatError = (err: unknown): string => {
  if (err instanceof GitHubError) {
    if (err.kind === 'rate-limit') {
      const when = err.resetAt
        ? err.resetAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'later'
      return `GitHub rate limit reached. Resets around ${when}. Add a personal access token below to raise the limit.`
    }
    return err.message
  }
  return (err as Error)?.message || 'Failed to load repository.'
}

export default function LoadFromGitHub({ onLoaded }: { onLoaded: (res: LoadResult) => void }) {
  const [url, setUrl] = useState('')
  const [token, setTokenValue] = useState(() => getToken() ?? '')
  const [showToken, setShowToken] = useState(() => Boolean(getToken()))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (!url.trim() || loading) return
    setLoading(true)
    setError(null)
    setToken(token) // remember (or clear) the token for next time
    try {
      const res = await loadRepoMarkdown(url, token.trim() || undefined)
      onLoaded(res)
    } catch (err) {
      setError(formatError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box className="zx-gh-load">
      <div className="zx-gh-divider"><span>or load docs from a GitHub repo</span></div>
      <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
        <TextField
          fullWidth
          size="small"
          placeholder="https://github.com/nokia-eda/docs"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void load() }}
          disabled={loading}
          slotProps={{ input: { startAdornment: <GitHubIcon fontSize="small" sx={{ mr: 1, opacity: 0.6 }} /> } }}
        />
        <Button
          variant="contained"
          onClick={() => void load()}
          disabled={loading || !url.trim()}
          sx={{ whiteSpace: 'nowrap' }}
        >
          {loading ? <CircularProgress size={18} color="inherit" /> : 'Load docs'}
        </Button>
      </Box>

      <Typography variant="caption" sx={{ color: 'var(--muted)' }}>
        A repo root or a subfolder link (e.g. <code>github.com/srl-labs/containerlab/tree/main/docs</code>).
        Only markdown files are loaded.
      </Typography>

      {error && (
        <Typography variant="body2" color="error" sx={{ maxWidth: 560, textAlign: 'center' }}>
          {error}
        </Typography>
      )}

      <Link
        component="button"
        type="button"
        variant="caption"
        underline="hover"
        onClick={() => setShowToken((v) => !v)}
        sx={{ color: 'var(--muted)' }}
      >
        {showToken ? 'Hide token' : 'Add a token (optional)'}
      </Link>
      <Collapse in={showToken} sx={{ width: '100%' }}>
        <TextField
          fullWidth
          size="small"
          type="password"
          placeholder="GitHub personal access token (optional)"
          value={token}
          onChange={(e) => setTokenValue(e.target.value)}
          disabled={loading}
          helperText="Public repos work without a token. A token raises the 60-requests/hour rate limit and is stored only in this browser."
        />
      </Collapse>
    </Box>
  )
}
