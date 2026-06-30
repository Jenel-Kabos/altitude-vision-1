import React from 'react';

// Supprime les props spécifiques à framer-motion pour éviter les warnings React DOM
const stripMotion = ({
  initial, animate, exit, variants, transition,
  whileHover, whileTap, whileInView, whileFocus, whileDrag,
  custom, layout, layoutId, drag, dragConstraints,
  children, ...rest
}) => ({ children, ...rest });

const Mk = (Tag) => (props) => {
  const { children, ...rest } = stripMotion(props);
  return React.createElement(Tag, rest, children);
};

export const frameworkMotionMock = {
  motion: {
    div:     Mk('div'),
    section: Mk('section'),
    article: Mk('article'),
    span:    Mk('span'),
    h1:      Mk('h1'),
    h2:      Mk('h2'),
    h3:      Mk('h3'),
    p:       Mk('p'),
    ul:      Mk('ul'),
    li:      Mk('li'),
    button:  Mk('button'),
    form:    Mk('form'),
    // motion.create(Component) → retourne un composant qui strip les props motion
    create:  (Component) => (props) => {
      const { children, ...rest } = stripMotion(props);
      return React.createElement(Component, rest, children);
    },
  },
  AnimatePresence: ({ children }) => <>{children}</>,
  useAnimation:    () => ({ start: vi.fn(), stop: vi.fn() }),
  useInView:       () => true,
};
