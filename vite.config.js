// vite.config.js
export default {
  // Base public path when served in production
  base: './',

  // Public directory containing assets like favicons
  publicDir: 'public',

  // Build configuration
  build: {
    // Output directory for production build
    outDir: 'dist',

    // Enable minification
    minify: 'terser',

    // Terser options for better minification
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log statements
        drop_debugger: true, // Remove debugger statements
      },
    },

    // Generate sourcemaps for debugging
    sourcemap: false,

    // Configure rollup options
    rollupOptions: {
      input: {
        main: './index.html',
      },
      output: {
        // Chunk files by type
        manualChunks: {
          v: ['three'],
          c: ['./js/controls.js', './js/mobileControls.js'],
          e: ['./js/environment.js'],
          a: ['./js/airplane.js'],
          core: ['./js/main.js', './js/constants.js'],
        },
      },
    },
  },

  // Development server configuration
  server: {
    open: true, // Auto-open browser on server start
    port: 3000, // Use port 3000
    host: true, // Listen on all addresses, including LAN and public addresses
    hmr: {
      overlay: true, // Show errors as an overlay on the page
    },
    watch: {
      usePolling: false, // Set to true if hot reload doesn't work on certain systems
      ignored: ['**/node_modules/**', '**/dist/**'], // Ignore these directories
    },
  },
};
