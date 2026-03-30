import tailwindcss from "@tailwindcss/vite";
import glsl from 'vite-plugin-glsl'
import wasm from "vite-plugin-wasm";
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
    base: '/project-gallery/',
    plugins: [
        tailwindcss(),
        glsl(),
        wasm(),
    ],
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                carProject: resolve(__dirname, 'car-project/index.html'),
            }
        }
    }
})
