export const animationVariants = {
  // Fade animations
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  },

  // Scale animations
  scaleIn: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 }
  },

  // Slide animations
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
  },

  slideDown: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 }
  },

  slideLeft: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  },

  slideRight: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 }
  },

  // Spring pop
  pop: {
    initial: { opacity: 0, scale: 0.5 },
    animate: {
      opacity: 1,
      scale: 1,
      transition: { type: 'spring', stiffness: 500, damping: 25 }
    },
    exit: { opacity: 0, scale: 0.5 }
  },

  // Bounce
  bounce: {
    initial: { opacity: 0, y: -50 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 300, damping: 10 }
    }
  }
}

// Transition presets
export const transitions = {
  instant: { duration: 0.05 },
  fast: { duration: 0.15 },
  normal: { duration: 0.25 },
  slow: { duration: 0.4 },
  spring: { type: 'spring' as const, stiffness: 400, damping: 25 },
  springBouncy: { type: 'spring' as const, stiffness: 300, damping: 10 },
  springSmooth: { type: 'spring' as const, stiffness: 200, damping: 20 },
  easeOut: { duration: 0.25, ease: [0, 0, 0.2, 1] as [number, number, number, number] },
  easeIn: { duration: 0.25, ease: [0.4, 0, 1, 1] as [number, number, number, number] },
  easeInOut: { duration: 0.25, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }
}
