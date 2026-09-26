export const motionTokens = Object.freeze({
  duration: Object.freeze({ fast: 0.22, base: 0.58, slow: 0.82 }),
  easing: Object.freeze({
    editorial: [0.22, 1, 0.36, 1],
    cinematic: [0.16, 1, 0.3, 1],
  }),
  stagger: Object.freeze({ fast: 0.06, base: 0.09 }),
});

export const motionVariants = Object.freeze({
  reveal: {
    rest: { opacity: 0.84, y: 16 },
    show: { opacity: 1, y: 0 },
  },
  image: {
    rest: { opacity: 0.86, y: 12, scale: 1.025, clipPath: 'inset(0 0 6% 0)' },
    show: { opacity: 1, y: 0, scale: 1, clipPath: 'inset(0 0 0% 0)' },
  },
  stagger: {
    rest: {},
    show: { transition: { staggerChildren: motionTokens.stagger.base } },
  },
  item: {
    rest: { opacity: 0.86, y: 12 },
    show: { opacity: 1, y: 0 },
  },
});
