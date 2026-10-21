import { RevenuePrice } from './RevenuePrice.tsx';

export const figures = {
  'revenue-price': {
    component: RevenuePrice,
    states: [
      { view: 'all' as const }, { view: 'outlook' as const },
      { targets: 'jul7' as const }, { targets: 'oct20' as const }, { targets: 'oct21' as const },
      { view: 'all' as const, targets: 'oct21' as const }, { view: 'outlook' as const, targets: 'jul7' as const },
    ],
  },
};
