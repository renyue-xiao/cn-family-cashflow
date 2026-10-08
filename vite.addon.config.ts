import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{target:['chrome107','safari16'],outDir:'addon/dist',lib:{entry:'src/addon.tsx',formats:['es'],fileName:()=> 'addon.js'},rollupOptions:{external:['react','react/jsx-runtime','react/jsx-dev-runtime']}}});
