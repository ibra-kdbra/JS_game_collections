import stage1 from "./stage1.js";
import stage2 from './stage2.js';
import stage3 from './stage3.js';
import stage4 from './stage4.js';
import stage5 from './stage5.js';
import stage6 from './stage6.js';
import stage7 from './stage7.js';
import stage8 from './stage8.js';

function getStage (stageNum) {
  switch (stageNum) {
    case 1:
      return stage1;
    case 2:
      return stage2;
    case 3:
      return stage3;
    case 4:
      return stage4;
    case 5:
      return stage5;
    case 6:
      return stage6;
    case 7:
      return stage7;
    case 8:
      return stage8;
    default:
      // ...
  }
}

export default getStage;
