import * as migration_20260716_063615_initial from './20260716_063615_initial';

export const migrations = [
  {
    up: migration_20260716_063615_initial.up,
    down: migration_20260716_063615_initial.down,
    name: '20260716_063615_initial'
  },
];
