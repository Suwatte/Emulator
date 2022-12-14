import { Source } from "@suwatte/daisuke";
import "./classes";

const emulate = <T extends Source>(c: new () => T): T => {
  const target = new c();
  if (target.onSourceLoaded) {
    target.onSourceLoaded();
  }
  return target;
};

export default emulate;
