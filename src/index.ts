import { Source } from "@suwatte/daisuke";
import "./classes";

const emulate = <T extends Source>(c: new () => T): T => {
  const target = new c();
  if (target.onSourceLoaded) {
    try {
      target.onSourceLoaded();
    } catch (err) {
      console.log(`ERROR: ${err}`);
    }
  }
  return target;
};

export default emulate;
