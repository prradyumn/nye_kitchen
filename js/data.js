// Mission content and the systems model (numbers from the storyboard).
export const DISHES = {
  biryani: { name: 'Biryani', line: 'big pot, feeds a crowd', img: 'dish_biryani', prep: 2, cook: 8, loss: .5, hot: true },
  tikka: { name: 'Paneer tikka', line: 'smoky and quick', img: 'dish_tikka', prep: 2, cook: 4, loss: 1.6, hot: true },
  jamun: { name: 'Gulab jamun', line: 'sweet and warm', img: 'dish_jamun', prep: 0, cook: 0, loss: .4, hot: false, dessert: true },
  cake: { name: 'Cake slice', line: 'party favourite', img: 'dish_cake', prep: 1, cook: 1, loss: 0, hot: false, dessert: true, squash: true },
  fries: { name: 'Fries', line: 'kids love them', img: 'dish_fries', prep: 1, cook: 3, loss: 1.2, hot: true, soggy: true },
  raita: { name: 'Raita', line: 'cool and fresh', img: 'dish_raita', prep: 1, cook: 1, loss: 0, hot: false, cold: true },
};
export const PACKS = {
  foil: { name: 'Foil box', line: '₹10 · keeps some heat · 4 boxes per rider', img: 'pkg_foil', cost: 10, loss: 1.0, cap: 4 },
  insulated: { name: 'Insulated bag', line: '₹35 · keeps heat well · 2 boxes per rider', img: 'pkg_insulated', cost: 35, loss: .4, cap: 2 },
  carton: { name: 'Plain carton', line: '₹4 · cheapest · 4 boxes per rider', img: 'pkg_carton', cost: 4, loss: 1.6, cap: 4 },
};
export const AREAS = { near: { name: 'Near', km: 2, min: 8 }, mid: { name: 'Mid', km: 5, min: 15 }, far: { name: 'Far', km: 8, min: 24 } };
export const STATIONS = [
  { k: 'prep', name: 'Prep', job: 'chops the food', icon: 'st_prep', col: '#8BC34A' },
  { k: 'cook', name: 'Cook', job: 'cooks it', icon: 'st_cook', col: '#E8503A' },
  { k: 'pack', name: 'Pack', job: 'boxes it up', icon: 'st_pack', col: '#F4A51C' },
  { k: 'disp', name: 'Dispatch', job: 'sends riders out', icon: 'st_disp', col: '#7FB8F0' },
];
export const CLUES = [
  { id: 'party10', img: 'clue_party', text: 'Our party starts at 10!', who: 'anya' },
  { id: 'far', img: 'clue_far', text: "We're 8 km away.", who: 'family' },
  { id: 'dessert', img: 'clue_dessert', text: 'Kids want dessert.', who: 'anya' },
  { id: 'cold', img: 'clue_cold', text: "It's a cold night.", who: 'family' },
];
export const CLUE_LATE = { id: 'midnight', img: 'clue_midnight', text: "We don't mind waiting, just make it before midnight.", who: 'anya' };
export const REPLAN = [
  { id: 'batch', name: 'Batch by area', line: 'one rider takes a few boxes to the same area', img: 'opt_batch' },
  { id: 'pickup', name: 'Customer pickup', line: 'families who live near come and collect', img: 'opt_pickup' },
  { id: 'pause', name: 'Pause new orders', line: 'no new orders for 10 minutes', img: 'opt_pause' },
  { id: 'simplify', name: 'Simplify the menu', line: 'take the slowest food off the menu', img: 'opt_simplify' },
  { id: 'move', name: 'Move a child to Dispatch', line: 'an extra helper sends riders out', img: 'opt_move' },
];
// what each food "taught" the team once it met real orders (revealed in Step 5, hidden in Step 2)
export const DISH_FACTS = {
  biryani: ['Slow: 8 minutes in the pot', 'Holds its heat well'],
  tikka: ['Quick: 4 minutes on the grill', 'Loses heat fast'],
  jamun: ['Ready-made: no cooking', 'Travels well'],
  cake: ['Quick to put together', 'Gets squashed in a plain carton'],
  fries: ['Quick: 3 minutes', 'Goes soggy after about 15 minutes'],
  raita: ['Quick to make', 'Must stay cold: warm after about 20 minutes'],
};
export const TRANSFER = [
  { id: 'cake_kid', who: 'a 5-year-old’s birthday party', img: 'x_cake_kid', pair: 1, opts: ['Tasty and fun. Wonky icing is fine.', 'Ready before the candles.', 'It has to look perfect.'] },
  { id: 'cake_contest', who: 'judges at a baking contest', img: 'x_cake_contest', pair: 1, opts: ['Smooth, even and exact.', 'Any cake is fine.', 'Fast is what matters.'] },
  { id: 'homework', who: 'a teacher, due tomorrow', img: 'x_homework', pair: 2, opts: ['Done, neat enough, handed in on time.', 'It has to be perfect, even if late.', 'Half done is fine.'] },
  { id: 'science', who: 'visitors at the science fair', img: 'x_science', pair: 2, opts: ['Works every time and explains clearly.', 'A quick sketch is enough.', 'Copy last year’s.'] },
  { id: 'sandcastle', who: 'you, at the beach today', img: 'x_sandcastle', pair: 3, opts: ['Fun to build. The wave can have it.', 'It must last for years.', 'Measure every tower.'] },
  { id: 'house', who: 'a family who will live there for years', img: 'x_house', pair: 3, opts: ['Safe, strong and checked properly.', 'Roughly straight is fine.', 'Build it as fast as possible.'] },
  { id: 'decoy', who: 'everyone, every time', img: 'x_decoy', pair: 0, decoy: true, opts: ['Always do your best on everything.', 'Always do your best on everything.', 'Always do your best on everything.'] },
];
export const PHOTOS = ['photo_1', 'photo_2', 'photo_3', 'photo_4', 'photo_5', 'photo_6'];
