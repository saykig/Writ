/**
 * Fast, overdamped smoothing for scroll-linked homepage motion.
 *
 * The short settling time removes wheel-step rigidity without introducing
 * overshoot or a floaty delay between the user's scroll and the interface.
 */
export const HOME_SCROLL_SPRING = {
  stiffness: 220,
  damping: 34,
  mass: 0.24,
} as const;
