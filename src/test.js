import 'mocha';
import 'mocha/mocha.css';

const main = async () => {
  mocha.setup('bdd');
  mocha.checkLeaks();
  await import('./utils/index.test.js');
  mocha.run();
}

main();
