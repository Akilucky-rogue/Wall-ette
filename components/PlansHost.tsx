import React, { lazy, Suspense } from 'react';
import { usePlansOpen } from '../services/planSheet';

const PlansSheet = lazy(() => import('./PlansSheet'));

/** The plans sheet, above every screen, while open (services/planSheet.ts). */
const PlansHost: React.FC = () => {
  const open = usePlansOpen();
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <PlansSheet reason={open.reason} />
    </Suspense>
  );
};

export default PlansHost;
