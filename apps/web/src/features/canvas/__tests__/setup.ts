// Only load jest-dom matchers in browser-like (jsdom) environments
if (typeof window !== 'undefined') {
  await import('@testing-library/jest-dom')
}
