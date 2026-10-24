// Authored waves and difficulty settings.
//
// A wave is [ticks between spawns, group, group, ...]; a group lists enemy
// names followed by how many times to repeat them. Every spawnpoint on the map
// releases each enemy, so maps with more spawnpoints are naturally harder.

// Campaign: each new enemy type gets a wave of its own before it is mixed in.
const campaignWaves = [
    [50, ['weak', 10]],                                          // 1
    [35, ['weak', 20]],                                          // 2
    [30, ['weak', 20], ['strong', 8]],                           // 3
    [25, ['strong', 20]],                                        // 4
    [40, ['fast', 10]],                                          // 5  fast
    [25, ['weak', 'strong', 15], ['fast', 10]],                  // 6
    [20, ['strong', 25], ['fast', 15]],                          // 7
    [35, ['medic', 'strong', 'strong', 6]],                      // 8  medic
    [25, ['strongFast', 15]],                                    // 9
    [20, ['medic', 'strong', 'strong', 10], ['strongFast', 15]], // 10
    [35, ['stronger', 12]],                                      // 11 stronger
    [20, ['strong', 20], ['stronger', 10], ['strongFast', 20]],  // 12
    [25, ['medic', 'stronger', 'stronger', 10]],                 // 13
    [25, ['faster', 12]],                                        // 14 faster
    [50, ['tank', 5]],                                           // 15 tank
    [25, ['tank', 'stronger', 'stronger', 8], ['strongFast', 20]], // 16
    [15, ['faster', 20], ['medic', 'strongFast', 12]],           // 17
    [25, ['tank', 'medic', 12]],                                 // 18
    [40, ['taunt', 3], ['stronger', 20]],                        // 19 taunt
    [50, ['spawner', 2], ['tank', 10]],                          // 20 spawner
    [20, ['tank', 15], ['faster', 20]],                          // 21
    [25, ['taunt', 'tank', 'tank', 8]],                          // 22
    [10, ['faster', 35]],                                        // 23
    [25, ['spawner', 3], ['taunt', 'medic', 'tank', 8]],         // 24
    [20, ['tank', 20], ['faster', 25]],                          // 25
    [20, ['taunt', 'stronger', 'tank', 'stronger', 12], ['faster', 25]], // 26
    [15, ['taunt', 'medic', 'tank', 15], ['strongFast', 40]],    // 27
    [15, ['spawner', 4], ['taunt', 'tank', 'tank', 'tank', 12]], // 28
    [12, ['taunt', 'faster', 'faster', 'faster', 15]],           // 29
    [12, ['spawner', 5], ['taunt', 'tank', 'tank', 'tank', 18], ['faster', 40]] // 30
];

// Tuning levers per difficulty.
//   health:    starting lives
//   cash:      starting money
//   hp:        enemy health multiplier
//   waveCool:  ticks (1/60 s) of calm between waves
const difficulties = {
    easy: { title: 'Easy', health: 60, cash: 100, hp: 0.75, waveCool: 240 },
    normal: { title: 'Normal', health: 40, cash: 75, hp: 1, waveCool: 180 },
    hard: { title: 'Hard', health: 25, cash: 60, hp: 1.3, waveCool: 120 }
};

// Endless mode: extra enemy health per wave after the campaign length.
const endlessHpGrowth = 0.05;

// Bonus cash for calling a wave early: one dollar per this many ticks skipped.
const earlyCallTicks = 30;

// Gold for clearing wave n, per portal on the map (every portal sends the whole
// wave, so maps with more portals need more towers)
const waveBonus = (n, portals) => (10 + 2 * n) * portals;

// Extra starting gold for every portal after the first
const portalCash = 25;
