import type { MetadataRoute } from 'next';

/**
 * What makes the site installable. `start_url` is the bare root so the
 * middleware picks the visitor's language on launch — pinning it to /tr would
 * hand an English speaker a Turkish app icon.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Follower — Instagram takipçi analizi',
    short_name: 'Follower',
    description:
      'Seni geri takip etmeyenleri, hayranlarını ve karşılıklı takipleşmelerini gör. Şifren saklanmaz.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f6f6f8',
    theme_color: '#f6f6f8',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
