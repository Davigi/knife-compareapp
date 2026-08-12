import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // In dev, the app calls /.netlify/functions/shopify-proxy directly.
      // Netlify CLI handles this in production; Vite proxies the function path locally
      // by forwarding directly to Shopify using the same param-based logic.
      '/.netlify/functions/shopify-proxy': {
        target: 'https://www.musashihamono.com',
        changeOrigin: true,
        rewrite: (path, req) => {
          const url = new URL('http://localhost' + req.url);
          const p = url.searchParams;
          const resource = p.get('resource');
          if (resource === 'products') {
            const handle = p.get('handle');
            const currency = p.get('currency');
            return `/products/${handle}.json${currency ? `?currency=${currency}` : ''}`;
          }
          p.delete('resource');
          return `/search/suggest.json?${p.toString()}`;
        },
      },
    },
  },
})