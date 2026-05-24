self.addEventListener('install', (e) => {
    console.log('[MOGO Studio] Service Worker Installed');
});

self.addEventListener('fetch', (e) => {
    // Required for PWA to work, even if empty
});
