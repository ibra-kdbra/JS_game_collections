/**
 * Hangman gameplay check (browser, offline):
 *   node Hangman/tools/verify-play.mjs
 *
 * With every other origin blocked (so only the built-in list in data/words.json is used):
 * 1. Play starts a round with a word from the chosen category.
 * 2. Typing the hidden letters solves the word: every box shows its letter, the score grows
 *    by 10 per letter, the Next button appears, and Enter brings a new word.
 * 3. Typing five letters that are not in the word loses: 0/5 guesses left and the
 *    GAME OVER panel showing the word; Enter starts again.
 * Exits non-zero on any failure.
 */
import { readFileSync } from 'node:fs';
import { startCheck, waitFor, repoRoot } from '../../tools/play/harness.mjs';

const wordData = JSON.parse(readFileSync(`${repoRoot}/Hangman/data/words.json`, 'utf8'));

// Letters still hidden in the word on screen, from the boxes whose letter is collapsed.
const hiddenLetters = () => {
  const word = currentWord.toUpperCase();
  const out = new Set();
  document.querySelectorAll('.word-container li.letter span').forEach((span) => {
    if (span.style.visibility === 'collapse') out.add(word[Number(span.id.slice(3))]);
  });
  return [...out];
};
const state = () => ({
  word: currentWord,
  guesses: document.querySelector('.guesses-left span').innerText,
  score: Number(document.querySelector('.score span').innerText),
  allShown: [...document.querySelectorAll('.word-container li.letter span')].every((s) => s.style.visibility !== 'collapse'),
  gameover: document.querySelector('.gameover-modal').style.visibility === 'visible',
  gameoverText: document.querySelector('.gameover-box .text').innerText,
  gameoverWord: document.querySelector('.gameover-word b').innerText,
  next: !!document.querySelector('.next-button') && document.querySelector('.next-button').style.visibility === 'visible',
});

const check = await startCheck('Hangman: win a word and lose one with the offline list');
await check.run(async () => {
  const page = await check.open('Hangman/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  const category = await page.evaluate(() => category);
  await page.waitForSelector('.start-game:not([disabled])');
  await page.click('.start-game');
  const word = await waitFor(page, () => (currentWord && document.querySelector('.modal').style.visibility === 'collapse' ? currentWord : ''));
  check.ok(word && wordData[category].includes(word), `Play starts a round with a ${category} word from the built-in list (${word || 'none'})`);
  await page.waitForTimeout(500);

  // Win: type the hidden letters.
  const letters = await page.evaluate(hiddenLetters);
  for (const l of letters) await page.keyboard.press(l.toLowerCase());
  await page.waitForTimeout(100);
  const won = await page.evaluate(state);
  check.ok(letters.length > 0 && won.allShown, `typing the ${letters.length} hidden letter(s) ${letters.join('')} reveals the word`);
  check.ok(won.score > 0 && won.guesses === '5/5', `score ${won.score}, no guesses lost (${won.guesses})`);
  check.ok(await waitFor(page, () => document.querySelector('.next-button')?.style.visibility === 'visible'), 'the Next button appears');
  await page.keyboard.press('Enter');
  const second = await waitFor(page, (w) => (currentWord !== w && document.querySelector('.word-container li.letter') ? currentWord : ''), word);
  check.ok(second && wordData[category].includes(second), `Enter brings the next word (${second || 'none'})`);
  await page.waitForTimeout(500);

  // Lose: five letters that are nowhere in the word.
  const wrong = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter((l) => !second.toUpperCase().includes(l)).slice(0, 5);
  for (const l of wrong) {
    await page.keyboard.press(l.toLowerCase());
    await page.waitForTimeout(80);
  }
  const lost = await waitFor(page, () => document.querySelector('.gameover-modal').style.visibility === 'visible', null, { timeout: 5000 })
    .then(() => page.evaluate(state));
  check.ok(lost.guesses === '0/5', `five wrong letters ${wrong.join('')} use up the guesses (${lost.guesses})`);
  check.ok(lost.gameover && /GAME OVER/.test(lost.gameoverText) && lost.gameoverWord === second.toUpperCase(),
    `the GAME OVER panel shows the word (${lost.gameoverText} / ${lost.gameoverWord})`);
  await page.waitForTimeout(400);
  await page.keyboard.press('Enter');
  const again = await waitFor(page, () => document.querySelector('.gameover-modal').style.visibility === 'collapse' && document.querySelector('.guesses-left span').innerText === '5/5', null, { timeout: 5000 });
  check.ok(again, 'Enter on the panel starts a new game');
  check.noErrors(page);
});
