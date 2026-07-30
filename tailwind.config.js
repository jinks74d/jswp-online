/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontSize: {
        // Accessibility floor: 16px is the app-wide minimum font size.
        // Tailwind's default xs (12px) and sm (14px) are the only named
        // sizes below 16px, so both are floored to 1rem. base/lg/xl+ keep
        // their values, preserving the hierarchy above the floor. Sizes
        // stay rem-based so the floor scales with the user's browser
        // font/zoom settings. (Decision: Raymond, 2026-06-08.)
        xs: ['1rem', '1.5rem'],
        sm: ['1rem', '1.5rem'],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      boxShadow: {
        'sidebar': '8px 0 15px -3px rgba(0, 0, 0, 0.1), 4px 0 6px -2px rgba(0, 0, 0, 0.05)',
        'sidebar-lg': '12px 0 25px -5px rgba(0, 0, 0, 0.1), 8px 0 10px -6px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [],
}
