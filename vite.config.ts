import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function normalizeBasePath(raw?: string): string {
  const trimmed = raw?.trim()
  if (!trimmed || trimmed === '/') return '/'
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  const collapsed = withLeading.replace(/\/+/g, '/')
  return collapsed.endsWith('/') ? collapsed : `${collapsed}/`
}

function resolveBasePath(env: Record<string, string>): string {
  if (env.VITE_BASE_PATH) {
    return normalizeBasePath(env.VITE_BASE_PATH)
  }
  if (env.GITHUB_ACTIONS === 'true' && env.GITHUB_REPOSITORY) {
    const repo = env.GITHUB_REPOSITORY.split('/')[1]
    if (repo && !repo.toLowerCase().endsWith('.github.io')) {
      return normalizeBasePath(repo)
    }
  }
  return '/'
}

function githubPagesFallbackPlugin(): Plugin {
  return {
    name: 'fileatlas-gh-pages-fallback',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const indexAsset = bundle['index.html']
      if (indexAsset && indexAsset.type === 'asset') {
        this.emitFile({
          type: 'asset',
          fileName: '404.html',
          source: indexAsset.source,
        })
      }
      this.emitFile({
        type: 'asset',
        fileName: '.nojekyll',
        source: '',
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  return {
    base: resolveBasePath(env),
    plugins: [react(), githubPagesFallbackPlugin()],
    server: {
      host: '0.0.0.0',
      allowedHosts: true,
    },
    preview: {
      host: '0.0.0.0',
      allowedHosts: true,
    },
    build: {
      target: 'es2022',
      sourcemap: true,
      chunkSizeWarningLimit: 650,
    },
  }
})
