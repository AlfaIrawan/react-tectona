/**
 * Animation utilities for managing --animation-speed CSS custom property
 * and ensuring consistent animation behavior across the application.
 */

/**
 * Initialize animation speed from user preferences
 * This should be called on app bootstrap
 */
export const initializeAnimationSpeed = (animationSpeed: number = 300) => {
  // Set the CSS custom property on document root
  document.documentElement.style.setProperty('--animation-speed', `${animationSpeed}ms`);
  
  // Also set it on the body for any components that might need it
  document.body.style.setProperty('--animation-speed', `${animationSpeed}ms`);
};

/**
 * Update animation speed in real-time
 * This should be called when user changes the animation speed setting
 */
export const updateAnimationSpeed = (animationSpeed: number) => {
  document.documentElement.style.setProperty('--animation-speed', `${animationSpeed}ms`);
  document.body.style.setProperty('--animation-speed', `${animationSpeed}ms`);
};

/**
 * Get current animation speed from CSS custom property
 */
export const getCurrentAnimationSpeed = (): number => {
  const computedStyle = getComputedStyle(document.documentElement);
  const animationSpeed = computedStyle.getPropertyValue('--animation-speed');
  
  // Extract numeric value from CSS value (e.g., "300ms" -> 300)
  const match = animationSpeed.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 300;
};

/**
 * Check if user prefers reduced motion
 */
export const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};
