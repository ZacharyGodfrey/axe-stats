const { db, sequentially, sum, average, logError } = require('../helpers');

const analyzeProfile = async (id) => {
  const matches = await db.query(`
    SELECT *
    FROM matches
    WHERE profileId = ? AND processed = 1;
  `, [id]);

  const stats = {
    matchWin: 0,
    matchLoss: 0,
    matchOTL: 0,
    matchTotalScore: 0,

    hatchetRoundWin: 0,
    hatchetRoundLoss: 0,
    hatchetRoundTie: 0,
    hatchetTotalScore: 0,
    hatchetThrowCount: 0,

    hatchetClutchCall: 0,
    hatchetClutchHit: 0,

    hatchetFive: 0,
    hatchetThree: 0,
    hatchetOne: 0,
    hatchetDrop: 0,

    bigAxeRoundWin: 0,
    bigAxeRoundLoss: 0,
    bigAxeTotalScore: 0,
    bigAxeThrowCount: 0,

    bigAxeClutchCall: 0,
    bigAxeClutchHit: 0,

    bigAxeFive: 0,
    bigAxeThree: 0,
    bigAxeOne: 0,
    bigAxeDrop: 0,
  };

  matches.forEach((match) => {
    stats.matchWin += match.matchWin;
    stats.matchLoss += match.matchLoss;
    stats.matchOTL += match.matchOTL;
    stats.matchTotalScore += match.matchTotalScore;

    stats.hatchetRoundWin += match.hatchetRoundWin;
    stats.hatchetRoundLoss += match.hatchetRoundLoss;
    stats.hatchetRoundTie += match.hatchetRoundTie;

    stats.hatchetTotalScore += sum([
      match.hatchetClutchHit * 7,
      match.hatchetFive * 5,
      match.hatchetThree * 3,
      match.hatchetOne * 1,
    ]);

    stats.hatchetThrowCount += sum([
      match.hatchetClutchCall,
      match.hatchetFive,
      match.hatchetThree,
      match.hatchetOne,
      match.hatchetDrop,
    ]);

    stats.hatchetClutchCall += match.hatchetClutchCall;
    stats.hatchetClutchHit += match.hatchetClutchHit;

    stats.hatchetFive += match.hatchetFive;
    stats.hatchetThree += match.hatchetThree;
    stats.hatchetOne += match.hatchetOne;
    stats.hatchetDrop += match.hatchetDrop;

    stats.bigAxeRoundWin += match.bigAxeRoundWin;
    stats.bigAxeRoundLoss += match.bigAxeRoundLoss;

    stats.bigAxeTotalScore += sum([
      match.bigAxeClutchHit * 7,
      match.bigAxeFive * 5,
      match.bigAxeThree * 3,
      match.bigAxeOne * 1,
    ]);

    stats.bigAxeThrowCount += sum([
      match.bigAxeClutchCall,
      match.bigAxeFive,
      match.bigAxeThree,
      match.bigAxeOne,
      match.bigAxeDrop,
    ]);

    stats.bigAxeClutchCall += match.bigAxeClutchCall;
    stats.bigAxeClutchHit += match.bigAxeClutchHit;

    stats.bigAxeFive += match.bigAxeFive;
    stats.bigAxeThree += match.bigAxeThree;
    stats.bigAxeOne += match.bigAxeOne;
    stats.bigAxeDrop += match.bigAxeDrop;
  });

  await db.run(`
    UPDATE profile
    SET ${Object.keys(stats).map(x => `${x} = ?`).join(',\n')}
    WHERE id = ?
  `, [
    ...Object.values(stats),
    id
  ]);
};

(async () => {
  try {
    console.log('Analyze Profiles');

    const profileIds = await db.query(`
      SELECT id
      FROM profiles;
    `);

    await sequentially(profileIds, analyzeProfile);
    await db.disconnect();
  } catch (error) {
    logError(error);

    process.exit(1);
  }
})();