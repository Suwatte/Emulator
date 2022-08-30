# Suwatte Runner Emulator

### Basic Usage

```typescript
import emulate from "@suwatte/emulator";
import { Target } from "../runners/source";

const source = emulate(Target);

source
  .getContent("")
  .then((v) => {
    console.log(v);
  })
  .catch((err) => {
    console.log(err);
  });

```
