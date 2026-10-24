/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#10182B',
        indigo: '#202B52',
        metro: '#6558E8',
        cyan: '#57D9F0',
        lav: '#E9E8FF',
        off: '#F7F8FC',
        ok: '#20A779',
        ink: '#182033',
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans Devanagari', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
