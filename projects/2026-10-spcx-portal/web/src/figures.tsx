import { LATEST_VINTAGE } from './data.ts';
import { RevenuePrice } from './RevenuePrice.tsx';

export const figures = {
  'revenue-price': {
    component: RevenuePrice,
    states: [
      { targets: 'jul7' as const }, { targets: 'oct20' as const }, { targets: 'oct21' as const },
      { events: true }, { targets: LATEST_VINTAGE, events: true },
    ],
  },
};
