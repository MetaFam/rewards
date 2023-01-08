import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import {
  NodeGlobalsPolyfillPlugin
} from '@esbuild-plugins/node-globals-polyfill'
import {
  NodeModulesPolyfillPlugin
} from '@esbuild-plugins/node-modules-polyfill'
import rollupNodePolyFill from 'rollup-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/program/coorditang/dist/',
  define: { global: 'globalThis' },
  resolve: {
    alias: {
      stream: 'rollup-plugin-node-polyfills/polyfills/stream',
      util: 'rollup-plugin-node-polyfills/polyfills/util',
      buffer: 'rollup-plugin-node-polyfills/polyfills/buffer-es6',
      process: 'rollup-plugin-node-polyfills/polyfills/process-es6',
      tty: 'rollup-plugin-node-polyfills/polyfills/tty',

      sys: 'util',
      events: 'rollup-plugin-node-polyfills/polyfills/events',
      path: 'rollup-plugin-node-polyfills/polyfills/path',
      querystring: 'rollup-plugin-node-polyfills/polyfills/qs',
      punycode: 'rollup-plugin-node-polyfills/polyfills/punycode',
      url: 'rollup-plugin-node-polyfills/polyfills/url',
      string_decoder:
          'rollup-plugin-node-polyfills/polyfills/string-decoder',
      http: 'rollup-plugin-node-polyfills/polyfills/http',
      https: 'rollup-plugin-node-polyfills/polyfills/http',
      os: 'rollup-plugin-node-polyfills/polyfills/os',
      assert: 'rollup-plugin-node-polyfills/polyfills/assert',
      constants: 'rollup-plugin-node-polyfills/polyfills/constants',
      _stream_duplex:
          'rollup-plugin-node-polyfills/polyfills/readable-stream/duplex',
      _stream_passthrough:
          'rollup-plugin-node-polyfills/polyfills/readable-stream/passthrough',
      _stream_readable:
          'rollup-plugin-node-polyfills/polyfills/readable-stream/readable',
      _stream_writable:
          'rollup-plugin-node-polyfills/polyfills/readable-stream/writable',
      _stream_transform:
          'rollup-plugin-node-polyfills/polyfills/readable-stream/transform',
      timers: 'rollup-plugin-node-polyfills/polyfills/timers',
      console: 'rollup-plugin-node-polyfills/polyfills/console',
      vm: 'rollup-plugin-node-polyfills/polyfills/vm',
      zlib: 'rollup-plugin-node-polyfills/polyfills/zlib',
      domain: 'rollup-plugin-node-polyfills/polyfills/domain',
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      plugins: [
        NodeGlobalsPolyfillPlugin({
          process: true,
          buffer: false,
        }),
        NodeModulesPolyfillPlugin(),
      ],
    },
  },
  build: {
    target: ['ESNext'],
    minify: false,
    sourcemap: true,
    polyfillModulePreload: false,
    rollupOptions: {
      plugins: [
        rollupNodePolyFill(),
      ],
    },
  },
})