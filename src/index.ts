import { SuwatteRunner } from "@suwatte/daisuke";
import "./classes";

type ConstructorOrObject<T> = new () => T | T;
function emulate<T extends SuwatteRunner>(c: new () => T): T;
function emulate<T extends SuwatteRunner>(o: T): T;

/**
 * Emulates a runner by either passing the constructor or the object itself
 */
function emulate<T extends SuwatteRunner>(v: ConstructorOrObject<T>): T {
  let target: T;
  if (typeof v === "function") {
    target = new v();
  } else {
    target = v;
  }

  target.onEnvironmentLoaded?.().catch((err) => {
    console.error("onEnvironmentLoaded", `${err}`);
  });

  return target;
}

export default emulate;
