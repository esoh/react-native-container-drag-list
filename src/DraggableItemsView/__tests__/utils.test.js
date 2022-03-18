import { getNewPosition } from '../utils';

const rangeMap = [
  {
    rootIndex: 0,
    y: 18.5,
  },
  {
    rootIndex: 1,
    y: 55.5,
  },
  {
    rootIndex: 2,
    y: 92.5,
  },
  {
    container: 'TOP',
    rootIndex: 3,
    y: 123.5,
  },
  {
    childIndex: 0,
    rootIndex: 3,
    y: 154.5,
  },
  {
    childIndex: 1,
    rootIndex: 3,
    y: 191.5,
  },
  {
    container: 'BOTTOM',
    rootIndex: 3,
    y: 235,
  },
  {
    rootIndex: 4,
    y: 278.5,
  },
  {
    container: 'TOP',
    rootIndex: 5,
    y: 309.5,
  },
  {
    childIndex: 0,
    rootIndex: 5,
    y: 340.5,
  },
  {
    container: 'BOTTOM',
    rootIndex: 5,
    y: 384,
  },
];

describe('utils', () => {
  it('calculates new position correctly for a drag up to 0', () => {
    expect(getNewPosition({ rootIndex: 3, childIndex: 1 }, 17, rangeMap)).toEqual(
      expect.objectContaining({
        rootIndex: 0,
      }),
    );
  });

  it('calculates new position correctly for a drag up', () => {
    expect(getNewPosition({ rootIndex: 4 }, 120, rangeMap)).toEqual(
      expect.objectContaining({
        rootIndex: 3,
      }),
    );
  });

  it('calculates new position correctly for a no drag at 0', () => {
    expect(getNewPosition({ rootIndex: 0 }, 0, rangeMap)).toEqual(
      expect.objectContaining({
        rootIndex: 0,
      }),
    );
  });

  it('calculates new position correctly for a no drag at 0, but close to 1', () => {
    expect(getNewPosition({ rootIndex: 0 }, 50, rangeMap)).toEqual(
      expect.objectContaining({
        rootIndex: 0,
      }),
    );
  });

  it('calculates new position correctly for a drag down 1 from 0', () => {
    expect(getNewPosition({ rootIndex: 0 }, 56, rangeMap)).toEqual(
      expect.objectContaining({
        rootIndex: 1,
      }),
    );
  });

  it('calculates new position correctly for a drag down from 0', () => {
    expect(getNewPosition({ rootIndex: 0 }, 236, rangeMap)).toEqual(
      expect.objectContaining({
        rootIndex: 3,
      }),
    );
  });

  it('calculates new position correctly for a drag down into container', () => {
    expect(getNewPosition({ rootIndex: 0 }, 200, rangeMap)).toEqual(
      expect.objectContaining({
        childIndex: 2,
        rootIndex: 2,
      }),
    );
  });

  it('calculates new position correctly for a drag up into container', () => {
    expect(getNewPosition({ rootIndex: 4 }, 130, rangeMap)).toEqual(
      expect.objectContaining({
        rootIndex: 3,
        childIndex: 0,
      }),
    );
  });

  it('calculates new position correctly for a drag to last', () => {
    expect(getNewPosition({ rootIndex: 4 }, 1000, rangeMap)).toEqual(
      expect.objectContaining({
        rootIndex: 5,
      }),
    );
  });

  it('calculates new position correctly for drag down within container', () => {
    expect(getNewPosition({ rootIndex: 3, childIndex: 0 }, 234, rangeMap)).toEqual(
      expect.objectContaining({
        childIndex: 1,
        rootIndex: 3,
      }),
    );
  });

  it('calculates new position correctly for drag down from container to container', () => {
    expect(getNewPosition({ rootIndex: 3, childIndex: 0 }, 341, rangeMap)).toEqual(
      expect.objectContaining({
        childIndex: 1,
        rootIndex: 5,
      }),
    );
  });
});
