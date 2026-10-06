"use client";

import { createContext, useContext } from 'react';
import { ORGANIZATION_RENTAL_CONTEXT } from '../services/rentalRequestContext';

const RentalOperationContext = createContext(ORGANIZATION_RENTAL_CONTEXT);

export const RentalOperationProvider = ({ value, children }) => (
  <RentalOperationContext.Provider value={value || ORGANIZATION_RENTAL_CONTEXT}>
    {children}
  </RentalOperationContext.Provider>
);

export const useRentalOperationContext = () => useContext(RentalOperationContext);
