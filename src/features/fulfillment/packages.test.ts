import { describe, expect, it } from 'vitest';
import { fulfillerRemainder, mapPackageItems, waitingLines, type PackableLine } from './packages';

// A mixed order: a mug and two tees from the fulfiller, an ukulele the shop
// ships itself, a donation that ships nothing.
const lines: PackableLine[] = [
  { id: 1, name: 'Mug', quantity: 1, ref: '4001', requires_shipping: 1 },
  { id: 2, name: 'Tee', quantity: 2, ref: '4002', requires_shipping: 1 },
  { id: 3, name: 'Ukulele', quantity: 1, ref: null, requires_shipping: 1 },
  { id: 4, name: 'Freewill donation', quantity: 1, ref: null, requires_shipping: 0 },
];

describe('mapPackageItems', () => {
  it('finds our lines by the id we handed over, else by the unit', () => {
    expect(
      mapPackageItems(
        [
          { externalId: '1', ref: '4001', quantity: 1 },
          { externalId: null, ref: '4002', quantity: 2 },
        ],
        lines,
        new Map(),
      ),
    ).toEqual([
      { orderItemId: 1, quantity: 1 },
      { orderItemId: 2, quantity: 2 },
    ]);
  });

  it('never packs more of a line than the order has left', () => {
    expect(mapPackageItems([{ externalId: '2', ref: '4002', quantity: 3 }], lines, new Map([[2, 1]]))).toEqual([
      { orderItemId: 2, quantity: 1 },
    ]);
    expect(mapPackageItems([{ externalId: null, ref: '9999', quantity: 1 }], lines, new Map())).toEqual([]);
  });
});

describe('waitingLines', () => {
  it('lists what ships and is not in a package yet', () => {
    expect(waitingLines(lines, new Map([[1, 1], [2, 1]])).map((l) => [l.name, l.quantity - l.packed])).toEqual([
      ['Tee', 1],
      ['Ukulele', 1],
    ]);
    expect(waitingLines(lines, new Map([[1, 1], [2, 2], [3, 1]]))).toEqual([]);
  });
});

describe('fulfillerRemainder', () => {
  it('is the fulfiller’s lines no package listed', () => {
    expect(fulfillerRemainder(lines, new Map([[1, 1]]))).toEqual([{ orderItemId: 2, quantity: 2 }]);
  });
});
