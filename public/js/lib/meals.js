// Måltider som en dag kan innehålla, i den ordning de visas.
export const MEALS = [
  { id: 'frukost', label: 'Frukost' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'middag', label: 'Middag' },
  { id: 'fika', label: 'Fika' },
  { id: 'kvall', label: 'Kvällsmat' },
];

export const isMeal = (id) => MEALS.some((m) => m.id === id);
export const mealLabel = (id) => MEALS.find((m) => m.id === id)?.label ?? id;
export const mealOrder = (id) => {
  const i = MEALS.findIndex((m) => m.id === id);
  return i === -1 ? MEALS.length : i;
};
